import { expect, it } from "vitest";
import { initial, reduceState, restoreState } from "../src/state";
import { catalog, rateTable } from "../src/catalog";
import { currencyGroup, pickerCurrencies } from "../src/currency-groups";
import { emptyRates, convert } from "../src/engine";
import { byCode } from "../src/catalog";
import { isAction, isBackgroundMessage } from "../src/protocol";

it("migrates both legacy lists, preserving the active anchor and unique row IDs", () => {
  const legacy = initial("en");
  legacy.tab = "crypto";
  const stored: Partial<typeof legacy> = { ...legacy };
  delete stored.converter;
  const migrated = restoreState(stored);
  expect(migrated.converter.rows.map((r) => r.code)).toEqual([
    "BTC",
    "USDT",
    "RUB",
    "USD",
  ]);
  expect(migrated.converter.anchor).toEqual(legacy.crypto.anchor);
  expect(restoreState(migrated).converter).toEqual(migrated.converter);
  expect(
    isBackgroundMessage({ type: "state", state: migrated, revision: 1 }),
  ).toBe(true);
});

it("accepts crypto as the single base and preserves it across reloads and undo", () => {
  const original = initial("en");
  const rowId = original.converter.rows[0].rowId;
  const action = {
    type: "replace",
    kind: "converter",
    rowId,
    code: "BTC",
  } as const;
  expect(isAction(action)).toBe(true);
  const next = reduceState(original, action, emptyRates);
  expect(restoreState(next).converter.rows[0].code).toBe("BTC");
  const undone = reduceState(
    next,
    {
      type: "undoReplace",
      kind: "converter",
      rowId,
      expected: "BTC",
      previous: "RUB",
    },
    emptyRates,
  );
  expect(undone.converter.rows).toEqual(original.converter.rows);
});

it("converts mixed rows from the same exact amount", () => {
  const rates = {
    ...emptyRates,
    fx: {
      USD: { rate: "1", date: "" },
      RUB: { rate: "100", date: "2026-11-04" },
    },
    crypto: { BTC: "60000", USDT: "1" },
    q: "1",
  };
  const state = initial("en");
  const next = reduceState(
    state,
    {
      type: "input",
      kind: "converter",
      rowId: state.converter.rows[1].rowId,
      code: "BTC",
      amount: "2",
    },
    rates,
  );
  expect(next.converter.anchor).toEqual({ code: "BTC", amount: "2" });
  expect(
    convert("12000000", byCode("RUB"), byCode("BTC"), rates)?.toString(),
  ).toBe("2");
  expect(convert("2", byCode("BTC"), byCode("RUB"), rates)?.toString()).toBe(
    "12000000",
  );
});

it("groups every supported currency once and lists exactly three crypto quotes", () => {
  expect(pickerCurrencies).toHaveLength(catalog.length);
  for (const currency of pickerCurrencies)
    expect(currencyGroup(currency)).toBeDefined();
  expect(rateTable.filter((code) => byCode(code).kind === "crypto")).toEqual([
    "BTC",
    "ETH",
    "USDT",
  ]);
  expect(
    isAction({ type: "replace", kind: "converter", rowId: "x", code: "FAKE" }),
  ).toBe(false);
});
