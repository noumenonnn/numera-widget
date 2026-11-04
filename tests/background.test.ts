import { afterEach, expect, it, vi } from "vitest";
import { initial } from "../src/state";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("distinguishes revoked permission and refreshes after it is granted", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
  let allowed = true;
  let connect!: (port: browser.runtime.Port) => void;
  let message!: (data: unknown) => void;
  let permissionChanged!: () => void;
  const postMessage = vi.fn();
  const fetch = vi.fn(async () => ({
    ok: true,
    text: async () =>
      '[{"base":"USD","quote":"RUB","date":"2026-11-03","rate":100}]',
  }));
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("browser", {
    runtime: {
      onConnect: {
        addListener: (fn: typeof connect) => {
          connect = fn;
        },
      },
    },
    permissions: {
      contains: async () => allowed,
      onAdded: {
        addListener: (fn: () => void) => {
          permissionChanged = fn;
        },
      },
      onRemoved: { addListener: () => {} },
    },
    storage: {
      local: {
        get: async () => ({
          state: initial("en"),
          rates: { fx: {}, crypto: {}, fxAt: Date.now() },
        }),
        set: async () => {},
      },
    },
  });
  vi.resetModules();
  await import("../src/background");
  connect({
    postMessage,
    onMessage: {
      addListener: (fn: typeof message) => {
        message = fn;
      },
    },
    onDisconnect: { addListener: () => {} },
  } as unknown as browser.runtime.Port);
  await vi.advanceTimersByTimeAsync(0);
  message({ type: "refresh", kind: "fiat" });
  await vi.advanceTimersByTimeAsync(0);
  allowed = false;
  permissionChanged();
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).not.toHaveBeenCalled();
  expect(
    postMessage.mock.calls.filter(([m]) => m.type === "rates").at(-1)?.[0].rates
      .errors.Frankfurter,
  ).toContain("permission-denied");
  allowed = true;
  permissionChanged();
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(
    postMessage.mock.calls.filter(([m]) => m.type === "rates").at(-1)?.[0].rates
      .fx.RUB.rate,
  ).toBe("100");
});
it("the real background retries offline fiat at backoff and stops after disconnect", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
  vi.spyOn(Math, "random").mockReturnValue(0);
  let connect!: (port: browser.runtime.Port) => void;
  let message!: (data: unknown) => void;
  let disconnect!: () => void;
  const fetch = vi.fn(async () => {
    throw Error("offline");
  });
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("browser", {
    runtime: {
      onConnect: {
        addListener: (fn: typeof connect) => {
          connect = fn;
        },
      },
    },
    permissions: {
      contains: async () => true,
      onAdded: { addListener: () => {} },
      onRemoved: { addListener: () => {} },
    },
    storage: {
      local: {
        get: async () => ({ state: initial("en") }),
        set: async () => {},
      },
    },
  });
  vi.resetModules();
  await import("../src/background");
  connect({
    postMessage: () => {},
    onMessage: {
      addListener: (fn: typeof message) => {
        message = fn;
      },
    },
    onDisconnect: {
      addListener: (fn: typeof disconnect) => {
        disconnect = fn;
      },
    },
  } as unknown as browser.runtime.Port);
  await vi.advanceTimersByTimeAsync(0);
  message({ type: "refresh", kind: "fiat" });
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(59999);
  expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(fetch).toHaveBeenCalledTimes(2);
  disconnect();
  expect(vi.getTimerCount()).toBe(0);
  await vi.advanceTimersByTimeAsync(3600000);
  expect(fetch).toHaveBeenCalledTimes(2);
});
