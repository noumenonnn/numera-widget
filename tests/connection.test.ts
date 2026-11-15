import { afterEach, expect, it, vi } from "vitest";
import { createConnection } from "../src/connection";
import { initial } from "../src/state";
afterEach(() => vi.useRealTimers());

it("keeps an idle popup connection alive and cancels heartbeats on disconnect and close", () => {
  vi.useFakeTimers();
  const ports: Array<{
    postMessage: ReturnType<typeof vi.fn>;
    emit: (x: unknown) => void;
    drop: () => void;
  }> = [];
  const connect = () => {
    const p = {
      postMessage: vi.fn(),
      emit: (() => {}) as (x: unknown) => void,
      drop: () => {},
    };
    ports.push(p);
    return {
      postMessage: p.postMessage,
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
  };
  const connection = createConnection(connect, vi.fn(), vi.fn());
  const snapshot = { type: "state", state: initial("en"), revision: 1 };
  ports[0].emit(snapshot);
  vi.advanceTimersByTime(60000);
  expect(ports[0].postMessage.mock.calls).toEqual([
    [{ type: "ping" }],
    [{ type: "ping" }],
    [{ type: "ping" }],
  ]);
  ports[0].drop();
  vi.advanceTimersByTime(250);
  ports[1].emit(snapshot);
  vi.advanceTimersByTime(20000);
  expect(ports[0].postMessage).toHaveBeenCalledTimes(3);
  expect(ports[1].postMessage).toHaveBeenCalledWith({ type: "ping" });
  connection.close();
  expect(vi.getTimerCount()).toBe(0);
});

it("reconnects when a heartbeat cannot be sent", () => {
  vi.useFakeTimers();
  let emit!: (x: unknown) => void;
  const disconnect = vi.fn();
  const connect = vi.fn(
    () =>
      ({
        postMessage: () => {
          throw new Error("worker stopped");
        },
        disconnect,
        onMessage: {
          addListener: (fn: typeof emit) => {
            emit = fn;
          },
        },
        onDisconnect: { addListener: () => {} },
      }) as unknown as browser.runtime.Port,
  );
  const connection = createConnection(connect, vi.fn(), vi.fn());
  emit({ type: "state", state: initial("en"), revision: 1 });
  vi.advanceTimersByTime(20000);
  expect(disconnect).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(250);
  expect(connect).toHaveBeenCalledTimes(2);
  connection.close();
  expect(vi.getTimerCount()).toBe(0);
});
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
