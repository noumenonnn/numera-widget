import { expect, it } from "vitest";
import {
  initial,
  reduceState,
  restoreState,
  reconcileState,
} from "../src/state";
import { emptyRates } from "../src/engine";
import { parseFx } from "../src/providers";

it.each(["1,5", "1 USD", "1 000"])(
  "rejects noncanonical persisted/action amount %s",
  (amount) => {
    const state = initial("en");
    const raw = structuredClone(state);
    raw.fiat.anchor.amount = amount;
    expect(restoreState(raw).fiat.anchor.amount).toBe("1");
    expect(
      reduceState(
        state,
        {
          type: "input",
          kind: "fiat",
          rowId: state.fiat.rows[0].rowId,
          code: "RUB",
          amount,
        },
        emptyRates,
      ),
    ).toBe(state);
  },
);
it("preserves state identity for no-op actions", () => {
  const s = initial("en");
  for (const action of [
    { type: "theme", theme: s.theme },
    { type: "locale", locale: s.locale },
    { type: "tab", kind: s.tab },
    { type: "expand", kind: "fiat", expanded: false },
    {
      type: "input",
      kind: "fiat",
      rowId: s.fiat.rows[0].rowId,
      ...s.fiat.anchor,
    },
    { type: "move", kind: "fiat", rowId: s.fiat.rows[1].rowId, targetIndex: 1 },
  ] as const)
    expect(reduceState(s, action, emptyRates)).toBe(s);
});
it("rejects FX data that changes the USD identity", () => {
  expect(() =>
    parseFx('[{"base":"USD","quote":"USD","rate":2,"date":"2026-11-02"}]', 1),
  ).toThrow();
});
it("does not render an unchanged ACK and shares unchanged rows", () => {
  const state = initial("en");
  expect(reconcileState(state, structuredClone(state))).toBe(state);
  const changed = structuredClone(state);
  changed.fiat.anchor.amount = "12";
  const next = reconcileState(state, changed);
  expect(next.fiat.rows).toBe(state.fiat.rows);
  expect(next.crypto).toBe(state.crypto);
  expect(next.fiat.anchor.amount).toBe("12");
});
