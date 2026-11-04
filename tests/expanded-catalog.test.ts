import { expect, it } from "vitest";
import { byCode } from "../src/catalog";
import { activePairs } from "../src/providers";
import { createRateService } from "../src/rate-service";
import { emptyRates, convert } from "../src/engine";

const addedCrypto =
  "AAVE ADA APE APT ARB AVAX BCH DASH DOGE ETC FIL HBAR INJ LINK LTC LUNA LUNC PEPE SHIB UNI VET XAUT XLM ZEC ZIL".split(
    " ",
  );
const exchange = JSON.stringify({
  symbols: addedCrypto.map((baseAsset) => ({
    symbol: `${baseAsset}USDT`,
    baseAsset,
    quoteAsset: "USDT",
    status: "TRADING",
    isSpotTradingAllowed: true,
  })),
});

it("maps all 25 new crypto assets to their own verified pairs, including LINK and distinct Terra assets", () => {
  expect(activePairs(exchange)).toEqual(
    addedCrypto.map((code) => `${code}USDT`),
  );
  expect(byCode("LINK").name.en).toBe("Chainlink");
  expect(byCode("LUNA").pair).toBe("LUNAUSDT");
  expect(byCode("LUNC").pair).toBe("LUNCUSDT");
  for (const code of [
    "BTG",
    "BUSD",
    "CRO",
    "DAI",
    "GUSD",
    "KAS",
    "LEO",
    "OKB",
    "BGN",
    "MXV",
  ])
    expect(byCode(code)).toBeUndefined();
});

it("refreshes a previous catalog cache before classifying newly added crypto assets", async () => {
  const now = Date.parse("2026-11-04T12:00:00Z");
  const calls: string[] = [];
  let saved: unknown;
  const service = createRateService({
    now: () => now,
    jitter: () => 0,
    storage: {
      load: async () => ({
        rates: { ...emptyRates, cryptoAt: now, fxAt: now, q: "1", qAt: now },
        exchange: { at: now, verified: true, pairs: ["BTCUSDT", "ETHUSDT"] },
      }),
      save: async (data) => {
        saved = structuredClone(data);
      },
    },
    get: async (url) => {
      calls.push(url);
      if (url.includes("exchangeInfo")) return exchange;
      if (url.includes("kraken"))
        return '{"error":[],"result":{"USDTZUSD":{"c":["1"]},"TONUSDT":{"c":["2"]},"XMRUSDT":{"c":["150"]}}}';
      return JSON.stringify(
        addedCrypto.map((code) => ({ symbol: `${code}USDT`, price: "15" })),
      );
    },
  });
  expect((await service.load()).unavailable ?? []).not.toContain("LINK");
  const rates = await service.refresh("crypto");
  expect(calls.some((url) => url.includes("exchangeInfo"))).toBe(true);
  expect(rates.unavailable).not.toContain("LINK");
  expect(rates.crypto.LINK).toBe("15");
  expect(convert("2", byCode("LINK"), byCode("USD"), rates)?.toString()).toBe(
    "30",
  );
  const cached = createRateService({
    now: () => now,
    jitter: () => 0,
    storage: { load: async () => saved, save: async () => {} },
    get: async () => {
      throw Error("Fresh cache should be reused");
    },
  });
  expect((await cached.refresh("crypto")).crypto.LINK).toBe("15");
});
