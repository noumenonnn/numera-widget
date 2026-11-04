import { describe, it, expect } from "vitest";
import {
  parseFx,
  parseKraken,
  activePairs,
  parsePrices,
} from "../src/providers";
describe("provider adapters", () => {
  it("retains decimal literals and date for each fiat quote", () => {
    expect(
      parseFx(
        '[{"base":"USD","quote":"RUB","date":"2026-10-30","rate":100.123456789012345678901}]',
        123,
      ).RUB,
    ).toEqual({
      rate: "100.123456789012345678901",
      date: "2026-10-30",
      fetchedAt: 123,
    });
  });
  it("rejects zero and invalid fiat entries while preserving valid neighbours", () => {
    const x = parseFx(
      '[{"base":"USD","quote":"RUB","date":"2026-10-30","rate":0},{"base":"USD","quote":"EUR","date":"2026-10-30","rate":0.8}]',
      123,
    );
    expect(x.RUB).toBeUndefined();
    expect(x.EUR.rate).toBe("0.8");
  });
  it("checks base identity and spot status in exchangeInfo", () => {
    const s = JSON.stringify({
      symbols: [
        {
          symbol: "BTCUSDT",
          baseAsset: "BTC",
          quoteAsset: "USDT",
          status: "TRADING",
          isSpotTradingAllowed: true,
        },
        {
          symbol: "ETHUSDT",
          baseAsset: "OTHER",
          quoteAsset: "USDT",
          status: "TRADING",
          isSpotTradingAllowed: true,
        },
      ],
    });
    expect(activePairs(s)).toEqual(["BTCUSDT"]);
  });
  it("does not accept unrequested or zero prices", () => {
    expect(
      parsePrices(
        '[{"symbol":"BTCUSDT","price":"0"},{"symbol":"ETHUSDT","price":"23"}]',
        ["BTCUSDT"],
      ),
    ).toEqual({});
  });
  it("requires the mapped Kraken pair and an empty error array", () => {
    expect(
      parseKraken('{"error":[],"result":{"USDTZUSD":{"c":["0.99"]}}}'),
    ).toBe("0.99");
    expect(() =>
      parseKraken('{"error":["E"],"result":{"USDTZUSD":{"c":["1"]}}}'),
    ).toThrow();
  });
});
it("rejects wrong quote types and impossible dates", () => {
  expect(() =>
    parseFx('[{"base":"USD","quote":"RUB","date":"2026-99-99","rate":100}]', 1),
  ).toThrow();
  expect(() =>
    parseFx(
      '[{"base":"USD","quote":"RUB","date":"2026-11-02","rate":"100"}]',
      1,
    ),
  ).toThrow();
  expect(
    parsePrices('[{"symbol":"BTCUSDT","price":1.25}]', ["BTCUSDT"]),
  ).toEqual({});
  expect(() =>
    parseKraken('{"error":[],"result":{"USDTZUSD":{"c":[0.99]}}}'),
  ).toThrow();
});
