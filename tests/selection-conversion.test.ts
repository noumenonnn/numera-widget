import { expect, it, vi } from "vitest";
import {
  parseSelection,
  createSelectionConverter,
} from "../src/selection-conversion";
import { initial } from "../src/state";
import type { Rates } from "../src/engine";

it.each([
  ["30 USD", "30", "USD"],
  ["$30", "30", "USD"],
  ["30 долларов", "30", "USD"],
  ["1 234,56 €", "1234.56", "EUR"],
  ["EUR 1,234.56", "1234.56", "EUR"],
  ["30₽", "30", "RUB"],
  ["0.25 BTC", "0.25", "BTC"],
  ["¥300", "300", "JPY"],
  ["Sale -32% $31.44", "31.44", "USD"],
  ["Price: $30", "30", "USD"],
  ["Цена товара: 1 234,56 € со скидкой", "1234.56", "EUR"],
  ["Only USD 31.44 today", "31.44", "USD"],
  ["Скидка 32%, цена 30 долларов", "30", "USD"],
])("parses explicit selection %s", (text, amount, code) => {
  expect(parseSelection(text)).toMatchObject({ amount, code });
});
it.each([
  "30",
  "USD",
  "30 USD 40 EUR",
  "12 34 USD",
  "Was $40, now $30",
  "Sale -32% 31.44",
  "30 kr",
  "x".repeat(129),
])("ignores non-price or ambiguous selection %s", (text) =>
  expect(parseSelection(text)).toBeNull(),
);
const rates: Rates = {
  fx: {
    USD: { rate: "1", date: new Date().toISOString().slice(0, 10) },
    RUB: { rate: "81.684", date: new Date().toISOString().slice(0, 10) },
  },
  crypto: {},
  fxAt: Date.now(),
};
it("preserves meaningful crypto precision when the main currency is BTC", async () => {
  const state = initial("en");
  state.converter.rows[0].code = "BTC";
  const quote = createSelectionConverter({
    state: async () => state,
    load: async () => ({
      ...rates,
      crypto: { BTC: "100000", USDT: "1" },
      cryptoAt: Date.now(),
      q: "1",
      qAt: Date.now(),
    }),
    refresh: async () => {
      throw new Error("fresh quotes should not refresh");
    },
  });
  expect(await quote("0.014 BTC")).toMatchObject({ target: "0.014 BTC" });
  expect(await quote("1400 USD")).toMatchObject({ target: "0.014 BTC" });
});
it("uses persisted main currency and exact quotes without opening a popup", async () => {
  const state = initial("en");
  state.theme = "dark";
  const refresh = vi.fn(async () => rates);
  const quote = createSelectionConverter({
    state: async () => state,
    load: async () => rates,
    refresh,
  });
  expect(await quote("30 USD")).toEqual({
    source: "30 USD",
    target: "2450.52 RUB",
    theme: "dark",
  });
  expect(refresh).not.toHaveBeenCalled();
  state.converter.rows[0].code = "USD";
  expect(await quote("81.684 RUB")).toMatchObject({ target: "1 USD" });
});
it("refreshes missing rates on demand and returns no invented quote on failure", async () => {
  const refresh = vi.fn(async () => rates);
  const quote = createSelectionConverter({
    state: async () => initial(),
    load: async () => ({ fx: {}, crypto: {} }),
    refresh,
  });
  expect(await quote("30 USD")).toMatchObject({ target: "2450.52 RUB" });
  expect(refresh).toHaveBeenCalledWith("fiat");
  expect(await quote("30 EUR")).toBeNull();
  expect(await quote("30")).toBeNull();
});
