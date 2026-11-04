import { expect, it } from "vitest";
import { byCode } from "../src/catalog";
import { currencyGroup } from "../src/currency-groups";
import {
  convert,
  convertMany,
  emptyRates,
  prepareCalculationRates,
  rateStatus,
} from "../src/engine";
import { parseFx } from "../src/providers";
import { initial, reduceState, restoreState } from "../src/state";

const oceania = "FJD NZD PGK SBD TVD VUV WST XPF".split(" ");
const caribbean = "AWG BBD BMD BSD CUP DOP HTG JMD KYD TTD".split(" ");
const now = Date.parse("2026-11-04T12:00:00Z");
const rates = {
  ...emptyRates,
  fx: {
    ...emptyRates.fx,
    AUD: { rate: "1.5", date: "2026-11-04", fetchedAt: now },
  },
  crypto: { ...emptyRates.crypto, BTC: "60000" },
  cryptoAt: now,
  q: "1",
  qAt: now,
};

it("offers every screenshot currency in its region and preserves it as the base", () => {
  for (const [codes, group] of [
    [oceania, "Oceania"],
    [caribbean, "Caribbean"],
  ] as const) {
    for (const code of codes) {
      expect(currencyGroup(byCode(code)).name).toBe(group);
      const state = initial("en");
      const next = reduceState(
        state,
        {
          type: "replace",
          kind: "converter",
          rowId: state.converter.rows[0].rowId,
          code,
        },
        rates,
      );
      expect(restoreState(next).converter.rows[0].code).toBe(code);
    }
  }
});

it("accepts provider quotes for all 17 directly supported currencies", () => {
  const codes = [...oceania, ...caribbean].filter((code) => code !== "TVD");
  const quotes = parseFx(
    JSON.stringify(
      codes.map((quote) => ({
        base: "USD",
        quote,
        rate: 2,
        date: "2026-11-04",
      })),
    ),
    now,
  );
  expect(Object.keys(quotes)).toEqual(codes);
  for (const code of codes)
    expect(
      convert("1", byCode("USD"), byCode(code), {
        ...emptyRates,
        fx: { ...emptyRates.fx, ...quotes },
      })?.toString(),
    ).toBe("2");
});

it("values TVD through AUD in both directions and in batch and crypto conversions", () => {
  expect(byCode("TVD").name.en).toContain("AUD 1:1");
  expect(convert("10", byCode("TVD"), byCode("USD"), rates)?.toString()).toBe(
    convert("10", byCode("AUD"), byCode("USD"), rates)?.toString(),
  );
  expect(convert("10", byCode("USD"), byCode("TVD"), rates)?.toString()).toBe(
    "15",
  );
  expect(convert("2", byCode("BTC"), byCode("TVD"), rates)?.toString()).toBe(
    "180000",
  );
  expect(
    convert("180000", byCode("TVD"), byCode("BTC"), rates)?.toString(),
  ).toBe("2");
  expect(
    convertMany(
      "10",
      byCode("USD"),
      [byCode("TVD")],
      prepareCalculationRates(rates),
    )
      .get("TVD")
      ?.toString(),
  ).toBe("15");
});

it("uses AUD freshness for TVD and reports a missing AUD quote", () => {
  expect(rateStatus(byCode("TVD"), byCode("USD"), rates, now)).toBe("ready");
  expect(
    rateStatus(byCode("USD"), byCode("TVD"), rates, now + 9 * 86400000),
  ).toBe("stale");
  expect(rateStatus(byCode("USD"), byCode("TVD"), emptyRates, now)).toBe(
    "unavailable",
  );
  expect(
    convert("123.45", byCode("TVD"), byCode("AUD"), emptyRates)?.toString(),
  ).toBe("123.45");
  expect(rateStatus(byCode("TVD"), byCode("AUD"), emptyRates, now)).toBe(
    "ready",
  );
});
