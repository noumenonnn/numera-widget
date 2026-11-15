import { afterEach, expect, it, vi } from "vitest";
import { initial } from "../src/state";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("converts a tab selection without any popup port and validates the sender", async () => {
  let listener!: (
    message: unknown,
    sender: browser.runtime.MessageSender,
    respond: (value: unknown) => void,
  ) => boolean;
  const set = vi.fn(async () => {});
  vi.stubGlobal("browser", {
    runtime: {
      onMessage: {
        addListener: (fn: typeof listener) => {
          listener = fn;
        },
      },
      onConnect: { addListener: () => {} },
    },
    permissions: {
      contains: async () => true,
      onAdded: { addListener: () => {} },
      onRemoved: { addListener: () => {} },
    },
    storage: {
      local: {
        get: async () => ({
          state: initial("en"),
          rates: {
            fx: {
              USD: { rate: "1", date: "" },
              RUB: { rate: "100", date: new Date().toISOString().slice(0, 10) },
            },
            crypto: {},
            fxAt: Date.now(),
          },
        }),
        set,
      },
    },
  });
  vi.resetModules();
  await import("../src/background");
  const message = { type: "selection-convert", text: "30 USD" };
  const reply = vi.fn();
  expect(listener(message, {}, reply)).toBe(false);
  expect(
    listener(
      { ...message, text: "x".repeat(129) },
      { tab: { id: 1 } as browser.tabs.Tab, url: "https://example.com" },
      reply,
    ),
  ).toBe(false);
  const result = await new Promise((resolve) => {
    expect(
      listener(
        message,
        { tab: { id: 1 } as browser.tabs.Tab, url: "https://example.com" },
        resolve,
      ),
    ).toBe(true);
  });
  expect(result).toEqual({
    source: "30 USD",
    target: "3000 RUB",
    theme: "system",
  });
  expect(set).not.toHaveBeenCalled();
  expect(reply).not.toHaveBeenCalled();
});
it("restores persisted state, rates and action receipts after a worker restart in Chrome", async () => {
  vi.useFakeTimers();
  const data: Record<string, unknown> = {
    state: initial("en"),
    rates: {
      fx: {
        USD: { rate: "1", date: "" },
        RUB: { rate: "100", date: "2026-11-03" },
      },
      crypto: { USDT: "1" },
    },
  };
  let connect!: (port: browser.runtime.Port) => void;
  const save = vi.fn(async (next: Record<string, unknown>) => {
    Object.assign(data, structuredClone(next));
  });
  vi.stubGlobal("browser", undefined);
  vi.stubGlobal("chrome", {
    runtime: {
      onMessage: { addListener: () => {} },
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
    storage: { local: { get: async () => structuredClone(data), set: save } },
  });
  const start = async () => {
    vi.resetModules();
    await import("../src/background");
    let message!: (value: unknown) => void;
    const postMessage = vi.fn();
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
    return { message, postMessage };
  };
  const first = await start();
  const action = {
    type: "action",
    id: "persisted-action",
    action: { type: "theme", theme: "dark" },
  };
  first.message(action);
  await vi.advanceTimersByTimeAsync(0);
  expect(data.stateRevision).toBe(1);
  const restarted = await start();
  expect(
    restarted.postMessage.mock.calls.find(([m]) => m.type === "state")?.[0],
  ).toMatchObject({
    state: { theme: "dark" },
    revision: 1,
  });
  expect(
    restarted.postMessage.mock.calls.find(([m]) => m.type === "rates")?.[0]
      .rates.fx.RUB.rate,
  ).toBe("100");
  restarted.message(action);
  await vi.advanceTimersByTimeAsync(0);
  expect(restarted.postMessage.mock.calls.at(-1)?.[0]).toMatchObject({
    ack: "persisted-action",
    revision: 1,
    duplicate: true,
  });
  expect(save).toHaveBeenCalledTimes(1);
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
      onMessage: { addListener: () => {} },
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
      onMessage: { addListener: () => {} },
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
