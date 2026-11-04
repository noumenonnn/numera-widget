import { describe, it, expect } from "vitest";
import {
  initial,
  reduceState,
  restoreState,
  validAmount,
  type State,
} from "../src/state";
import { isBackgroundMessage } from "../src/protocol";
import { emptyRates, type Rates } from "../src/engine";
const snapshot: Rates = {
  ...emptyRates,
  fx: {
    USD: { rate: "1", date: "2026-01-01" },
    RUB: { rate: "100", date: "2026-01-01" },
    EUR: { rate: "0.8", date: "2026-01-01" },
  },
};
function fixture(): State {
  const s = initial("en");
  s.fiat.rows = [
    { rowId: "a", code: "RUB" },
    { rowId: "b", code: "USD" },
    { rowId: "c", code: "EUR" },
  ];
  return s;
}
describe("canonical state operations", () => {
  it("keeps duplicate transfer IDs and oversized stored IDs out of snapshots", () => {
    const s = initial("en");
    expect(
      reduceState(
        s,
        {
          type: "transfer",
          kind: "crypto",
          rowId: s.crypto.rows[0].rowId,
          code: "ETH",
          amount: "1",
        },
        snapshot,
      ),
    ).toBe(s);
    s.fiat.rows[0].rowId = "x".repeat(513);
    expect(
      isBackgroundMessage({
        type: "state",
        state: restoreState(s),
        revision: 1,
      }),
    ).toBe(true);
  });
  it("preserves the original anchor when reanchoring would exceed the canonical range", () => {
    const s = initial("en");
    s.fiat.anchor = { code: "RUB", amount: "1e-100" };
    const next = reduceState(
      s,
      {
        type: "replace",
        kind: "fiat",
        rowId: s.fiat.rows[0].rowId,
        code: "EUR",
      },
      snapshot,
    );
    expect(next.fiat.rows[0].code).toBe("EUR");
    expect(next.fiat.anchor).toEqual(s.fiat.anchor);
    expect(validAmount(next.fiat.anchor.amount)).toBe(true);
    expect(
      isBackgroundMessage({ type: "state", state: next, revision: 2 }),
    ).toBe(true);
    expect(restoreState(next).fiat.anchor).toEqual(s.fiat.anchor);
  });
  it("combines concurrent changes to different settings without overwriting", () => {
    let s = fixture();
    s = reduceState(s, { type: "theme", theme: "dark" }, snapshot);
    s = reduceState(s, { type: "locale", locale: "ru" }, snapshot);
    expect(s.theme).toBe("dark");
    expect(s.locale).toBe("ru");
  });
  it("moves an anchor at full precision when its row is removed", () => {
    let s = fixture();
    s.fiat.anchor = { code: "USD", amount: "1.234567890123456789" };
    s = reduceState(s, { type: "remove", kind: "fiat", rowId: "b" }, snapshot);
    expect(s.fiat.anchor).toEqual({
      code: "RUB",
      amount: "123.4567890123456789",
    });
  });
  it("keeps an invisible anchor if rates are unavailable", () => {
    let s = fixture();
    s.fiat.anchor = { code: "USD", amount: "1" };
    s = reduceState(
      s,
      { type: "remove", kind: "fiat", rowId: "b" },
      emptyRates,
    );
    expect(s.fiat.anchor).toEqual({ code: "USD", amount: "1" });
  });
  it("protects pinned row and minimum pair even for stale commands", () => {
    let s = fixture();
    s = reduceState(s, { type: "remove", kind: "fiat", rowId: "a" }, snapshot);
    expect(s.fiat.rows).toHaveLength(3);
    s = reduceState(s, { type: "remove", kind: "fiat", rowId: "c" }, snapshot);
    s = reduceState(s, { type: "remove", kind: "fiat", rowId: "b" }, snapshot);
    expect(s.fiat.rows.map((x) => x.code)).toEqual(["RUB", "USD"]);
  });
  it("does not undo a currency change after the target row changed again", () => {
    let s = fixture();
    s = reduceState(
      s,
      { type: "replace", kind: "fiat", rowId: "a", code: "CAD" },
      snapshot,
    );
    s = reduceState(
      s,
      { type: "replace", kind: "fiat", rowId: "a", code: "GBP" },
      snapshot,
    );
    const before = structuredClone(s);
    s = reduceState(
      s,
      {
        type: "undoReplace",
        kind: "fiat",
        rowId: "a",
        expected: "CAD",
        previous: "RUB",
        otherRowId: undefined,
      },
      snapshot,
    );
    expect(s).toEqual(before);
  });
  it("restores a deleted row without overwriting a newer amount", () => {
    let s = fixture();
    s = reduceState(s, { type: "remove", kind: "fiat", rowId: "c" }, snapshot);
    s = reduceState(
      s,
      { type: "input", kind: "fiat", rowId: "b", code: "USD", amount: "12" },
      snapshot,
    );
    s = reduceState(
      s,
      {
        type: "restoreRow",
        kind: "fiat",
        row: { rowId: "c", code: "EUR" },
        index: 2,
      },
      snapshot,
    );
    expect(s.fiat.rows.map((x) => x.code)).toEqual(["RUB", "USD", "EUR"]);
    expect(s.fiat.anchor).toEqual({ code: "USD", amount: "12" });
  });
  it("repairs a corrupt tab while preserving valid preferences and the other tab", () => {
    const s = fixture();
    const restored = restoreState(
      {
        ...s,
        locale: "ru",
        fiat: {
          rows: [{ rowId: "x", code: "FAKE" }],
          anchor: { code: "FAKE", amount: "1" },
        },
      },
      "en",
    );
    expect(restored.locale).toBe("ru");
    expect(restored.fiat.rows.map((x) => x.code)).toEqual(["RUB", "USD"]);
    expect(restored.crypto).toEqual(s.crypto);
  });
});
it("rejects out-of-range persisted or incoming anchors", () => {
  const state = initial("en");
  const restored = restoreState(
    {
      ...state,
      fiat: { ...state.fiat, anchor: { code: "RUB", amount: "1e999" } },
    },
    "en",
  );
  expect(restored.fiat.anchor.amount).toBe("1");
  const next = reduceState(
    state,
    {
      type: "input",
      kind: "fiat",
      rowId: state.fiat.rows[0].rowId,
      code: "RUB",
      amount: "1e999",
    },
    emptyRates,
  );
  expect(next.fiat.anchor.amount).toBe("1");
});
it("recovers valid rows when a single stored row is corrupt", () => {
  const state = fixture();
  const raw = structuredClone(state);
  raw.fiat.rows.splice(1, 0, { rowId: "broken", code: "FAKE" });
  const restored = restoreState(raw, "en");
  expect(restored.fiat.rows.map((row) => row.code)).toEqual([
    "RUB",
    "USD",
    "EUR",
  ]);
  expect(restored.fiat.rows.map((row) => row.rowId)).toEqual(["a", "b", "c"]);
});
