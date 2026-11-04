import { expect, it } from "vitest";
import { catalog, byCode } from "../src/catalog";
import {
  convert,
  convertMany,
  prepareCalculationRates,
  type Rates,
} from "../src/engine";
const rates: Rates = {
  fx: Object.fromEntries(
    catalog
      .filter((c) => c.kind === "fiat")
      .map((c, i) => [
        c.code,
        {
          rate:
            c.code === "USD"
              ? "1"
              : `${i + 1}.123456789012345678901234567890123456789`,
          date: "2026-11-03",
        },
      ]),
  ),
  crypto: Object.fromEntries(
    catalog
      .filter((c) => c.kind === "crypto")
      .map((c, i) => [
        c.code,
        c.code === "USDT"
          ? "1"
          : `${i + 1}.987654321098765432109876543210987654321`,
      ]),
  ),
  q: "0.999123456789012345678901234567890123456789",
};
it.each(["RUB", "USD", "BTC", "USDT"])(
  "batch conversion preserves all 50-digit operations for %s",
  (code) => {
    const prepared = prepareCalculationRates(rates);
    for (const amount of [
      "-12345678901234567890123456789012345678901234567890",
      "1e-100",
      "1e100",
      "0",
    ]) {
      const values = convertMany(amount, byCode(code), catalog, prepared);
      for (const currency of catalog)
        expect(values.get(currency.code)?.toString() ?? null).toBe(
          convert(amount, byCode(code), currency, rates)?.toString() ?? null,
        );
    }
  },
);
it("keeps unavailable and bad records local to their rows", () => {
  const bad = {
    ...rates,
    fx: { ...rates.fx, EUR: { rate: "bad", date: "" } },
    unavailable: ["ETH"],
  };
  const values = convertMany(
    "12",
    byCode("USD"),
    catalog,
    prepareCalculationRates(bad),
  );
  expect(values.get("EUR")).toBeNull();
  expect(values.get("ETH")).toBeNull();
  expect(values.get("RUB")).not.toBeNull();
});
