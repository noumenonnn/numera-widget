import { describe, it, expect } from "vitest";
import { byCode } from "../src/catalog";
import { parseInput, convert, format, type Rates } from "../src/engine";
import { replaceRow } from "../src/state";
const r: Rates = {
  fx: {
    USD: { rate: "1", date: "2026-01-01" },
    RUB: { rate: "100", date: "2026-01-01" },
    EUR: { rate: ".8", date: "2026-01-01" },
  },
  crypto: { BTC: "50000", ETH: "2500", USDT: "1" },
  q: ".99",
};
describe("decimal conversion", () => {
  it("uses a single anchor and real USDT/USD bridge", () => {
    expect(convert("1000", byCode("RUB"), byCode("USD"), r)?.toString()).toBe(
      "10",
    );
    expect(convert("1000", byCode("RUB"), byCode("EUR"), r)?.toString()).toBe(
      "8",
    );
    expect(convert("2", byCode("BTC"), byCode("ETH"), r)?.toString()).toBe(
      "40",
    );
    expect(convert("2", byCode("BTC"), byCode("RUB"), r)?.toString()).toBe(
      "9900000",
    );
  });
  it("does not invent the bridge", () =>
    expect(
      convert("1", byCode("BTC"), byCode("RUB"), { ...r, q: undefined }),
    ).toBeNull());
  it("does not round tiny nonzero to zero", () =>
    expect(
      format(convert("1e-30", byCode("BTC"), byCode("BTC"), r), "en"),
    ).not.toBe("0"));
});
describe("input grammar", () => {
  for (const [input, amount] of [
    ["1,234", "1.234"],
    ["1.234", "1.234"],
    ["1,234.56", "1234.56"],
    ["1.234,56", "1234.56"],
    ["1 234,56", "1234.56"],
    ["1e-8 BTC", "0.00000001"],
  ])
    it(input, () => {
      const x = parseInput(input, byCode("RUB"), true);
      expect(x.status).toBe("valid");
      if (x.status === "valid") expect(x.amount).toBe(amount);
    });
  it("recognizes aliases and symbols", () => {
    for (const input of ["1 руб.", "1₽", "1 rub", "1 RUB", "₽1"]) {
      const x = parseInput(input, byCode("RUB"), true);
      expect(x.status).toBe("valid");
      if (x.status === "valid") expect(x.currency?.code).toBe("RUB");
    }
  });
  it("waits for prefix completion", () =>
    expect(parseInput("1 USD", byCode("RUB")).status).toBe("pending"));
  it("does not partially parse expressions", () =>
    expect(parseInput("1+2 RUB", byCode("RUB"), true).status).not.toBe(
      "valid",
    ));
  it("asks for ambiguous symbol", () =>
    expect(parseInput("$1", byCode("RUB"), true).status).toBe("ambiguous"));
});
describe("row identity", () => {
  it("protects first row and swaps ordinary rows", () => {
    const tab = {
      rows: [
        { rowId: "a", code: "RUB" },
        { rowId: "b", code: "USD" },
        { rowId: "c", code: "EUR" },
      ],
      anchor: { code: "RUB", amount: "1" },
      expanded: false,
    };
    expect(replaceRow(tab, "b", "RUB").focus).toBe("a");
    expect(replaceRow(tab, "b", "EUR").tab.rows).toEqual([
      { rowId: "a", code: "RUB" },
      { rowId: "b", code: "EUR" },
      { rowId: "c", code: "USD" },
    ]);
  });
});
it("full precision text for an extremely small value is accepted by the parser", () => {
  const x = convert(
    "1.234567890123456789012345678901234567890123456789e-99",
    byCode("BTC"),
    byCode("BTC"),
    r,
  );
  const rendered = format(x, "en", true);
  expect(rendered.length).toBeLessThanOrEqual(128);
  const parsed = parseInput(rendered, byCode("BTC"), true);
  expect(parsed.status).toBe("valid");
});
import { rateStatus } from "../src/engine";
describe("rate freshness", () => {
  const now = Date.parse("2026-11-02T12:00:00Z");
  const base: Rates = {
    fx: {
      USD: { rate: "1", date: "2026-11-02", fetchedAt: now },
      RUB: { rate: "100", date: "2026-11-02", fetchedAt: now },
    },
    crypto: { BTC: "50000", ETH: "2500", USDT: "1" },
    cryptoFetchedAt: { BTC: now, ETH: now - 121000 },
    cryptoAt: now,
    q: "0.99",
    qAt: now - 121000,
    fxAt: now,
  };
  it("marks an old component even when the latest batch is fresh", () =>
    expect(rateStatus(byCode("BTC"), byCode("ETH"), base, now)).toBe("stale"));
  it("marks the bridge when crypto-fiat q is old", () =>
    expect(rateStatus(byCode("BTC"), byCode("RUB"), base, now)).toBe("stale"));
  it("returns unavailable when the bridge is missing", () =>
    expect(
      rateStatus(byCode("BTC"), byCode("RUB"), { ...base, q: undefined }, now),
    ).toBe("unavailable"));
  it("shows old fiat dates without treating a weekend as an error", () => {
    expect(
      rateStatus(
        byCode("USD"),
        byCode("RUB"),
        {
          ...base,
          fx: {
            ...base.fx,
            RUB: { rate: "100", date: "2026-10-30", fetchedAt: now },
          },
        },
        now,
      ),
    ).toBe("ready");
    expect(
      rateStatus(
        byCode("USD"),
        byCode("RUB"),
        {
          ...base,
          fx: {
            ...base.fx,
            RUB: { rate: "100", date: "2026-10-20", fetchedAt: now },
          },
        },
        now,
      ),
    ).toBe("stale");
  });
});
it("accepts a prefix currency token before the amount when it has a boundary", () => {
  const result = parseInput("USD 1", byCode("RUB"));
  expect(result.status).toBe("valid");
  if (result.status === "valid") expect(result.currency?.code).toBe("USD");
});
it("resolves a shared symbol against the current expanded currency", () => {
  const result = parseInput("$1", byCode("MXN"), true);
  expect(result.status).toBe("valid");
  if (result.status === "valid") expect(result.currency?.code).toBe("MXN");
});
