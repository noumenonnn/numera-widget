import { expect, it, vi } from "vitest";
import { createConnection } from "../src/connection";
import { initial } from "../src/state";
it("reconnects once, ignores old messages and stops on close", () => {
  vi.useFakeTimers();
  const ports: Array<{ emit: (x: unknown) => void; drop: () => void }> = [];
  const receive = vi.fn(),
    disconnected = vi.fn();
  const connect = vi.fn(() => {
    const p = { emit: (() => {}) as (x: unknown) => void, drop: () => {} };
    ports.push(p);
    return {
      postMessage: vi.fn(),
      disconnect: () => p.drop(),
      onMessage: {
        addListener: (fn: typeof p.emit) => {
          p.emit = fn;
        },
      },
      onDisconnect: {
        addListener: (fn: typeof p.drop) => {
          p.drop = fn;
        },
      },
    } as unknown as browser.runtime.Port;
  });
  const connection = createConnection(connect, receive, disconnected);
  ports[0].emit({ type: "state", state: initial("en"), revision: 1 });
  expect(receive.mock.calls[0][1]).toBe(true);
  ports[0].drop();
  expect(connection.send({ type: "refresh", kind: "fiat" })).toBe(false);
  vi.advanceTimersByTime(250);
  expect(connect).toHaveBeenCalledTimes(2);
  ports[0].emit({ type: "state", state: initial("en"), revision: 0 });
  expect(receive).toHaveBeenCalledTimes(1);
  connection.close();
  vi.runAllTimers();
  expect(connect).toHaveBeenCalledTimes(2);
  vi.useRealTimers();
});
