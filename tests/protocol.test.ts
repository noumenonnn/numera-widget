import { expect, it } from "vitest";
import { isAction, isBackgroundMessage, isPopupMessage } from "../src/protocol";
import { initial } from "../src/state";
it("validates the last-check timestamp in rate snapshots", () => {
  const rates = { fx: {}, crypto: {}, lastCheckedAt: 1000 };
  expect(isBackgroundMessage({ type: "rates", rates })).toBe(true);
  expect(
    isBackgroundMessage({
      type: "rates",
      rates: { ...rates, lastCheckedAt: -1 },
    }),
  ).toBe(false);
  expect(
    isBackgroundMessage({
      type: "rates",
      rates: { ...rates, lastCheckedAt: "now" },
    }),
  ).toBe(false);
});
it("validates the manual refresh flag", () => {
  expect(isPopupMessage({ type: "refresh", kind: "crypto", force: true })).toBe(
    true,
  );
  expect(isPopupMessage({ type: "refresh", kind: "fiat" })).toBe(true);
  expect(
    isPopupMessage({ type: "refresh", kind: "crypto", force: "true" }),
  ).toBe(false);
});
it("accepts the popup heartbeat without accepting unknown messages", () => {
  expect(isPopupMessage({ type: "ping" })).toBe(true);
  expect(isPopupMessage({ type: "unknown" })).toBe(false);
});
it("rejects invalid canonical amounts and unknown currencies at IPC", () => {
  expect(
    isAction({
      type: "input",
      kind: "fiat",
      rowId: "x",
      code: "USD",
      amount: "1 USD",
    }),
  ).toBe(false);
  expect(
    isAction({ type: "replace", kind: "fiat", rowId: "x", code: "FAKE" }),
  ).toBe(false);
});
it("rejects snapshots that would crash rendering", () => {
  const state = initial("en");
  state.fiat.rows[0].code = "FAKE";
  expect(isBackgroundMessage({ type: "state", state, revision: 1 })).toBe(
    false,
  );
  expect(
    isBackgroundMessage({
      type: "rates",
      rates: { fx: {}, crypto: {}, error: 42 },
    }),
  ).toBe(false);
});
it("validates optional ACK flags, quote invariants and timestamps", () => {
  const state = initial("en");
  expect(
    isBackgroundMessage({ type: "state", state, revision: 1, ack: 42 }),
  ).toBe(false);
  expect(
    isBackgroundMessage({
      type: "state",
      state,
      revision: 1,
      duplicate: "yes",
    }),
  ).toBe(false);
  expect(
    isBackgroundMessage({
      type: "rates",
      rates: { fx: { USD: { rate: "2", date: "" } }, crypto: { USDT: "1" } },
    }),
  ).toBe(false);
  expect(
    isBackgroundMessage({
      type: "rates",
      rates: {
        fx: { USD: { rate: "1", date: "" } },
        crypto: { USDT: "1" },
        cryptoFetchedAt: { USDT: Infinity },
      },
    }),
  ).toBe(false);
});
