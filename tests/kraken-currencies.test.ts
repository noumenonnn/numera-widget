import { expect, it } from "vitest";
import { byCode } from "../src/catalog";
import { activePairs, parseKrakenMarket } from "../src/providers";
import { createRateService, FetchError } from "../src/rate-service";
import { convert, rateStatus } from "../src/engine";

const kraken = JSON.stringify({
  error: [],
  result: {
    USDTZUSD: { c: ["0.999"] },
    TONUSDT: { c: ["2.1234567890123456789"] },
    XMRUSDT: { c: ["150"] },
  },
});
const exchange = JSON.stringify({
  symbols: [
    {
      symbol: "BTCUSDT",
      baseAsset: "BTC",
      quoteAsset: "USDT",
      status: "TRADING",
      isSpotTradingAllowed: true,
    },
  ],
});

it("assigns TON and XMR exclusively to Kraken and retains decimal strings", () => {
  expect(parseKrakenMarket(kraken).prices.TON).toBe("2.1234567890123456789");
  expect(activePairs(exchange)).not.toContain("TONUSDT");
  for (const code of ["TON", "XMR"]) {
    expect(byCode(code).pair).toBeUndefined();
    expect(byCode(code).krakenPair).toBe(`${code}USDT`);
  }
});

it("rejects incomplete, zero, numeric and erroneous Kraken payloads", () => {
  const source = JSON.parse(kraken);
  delete source.result.TONUSDT;
  expect(() => parseKrakenMarket(JSON.stringify(source))).toThrow();
  for (const price of ["0", "-1", "NaN", 2]) {
    const source = JSON.parse(kraken);
    source.result.XMRUSDT.c[0] = price;
    expect(() => parseKrakenMarket(JSON.stringify(source))).toThrow();
  }
  expect(() =>
    parseKrakenMarket('{"error":["EGeneral:Unavailable"],"result":{}}'),
  ).toThrow();
});

for (const krakenFirst of [false, true]) {
  it(`merges independent provider responses with Kraken finishing ${krakenFirst ? "first" : "last"}`, async () => {
    const now = Date.parse("2026-11-04T12:00:00Z");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const service = createRateService({
      storage: { load: async () => undefined, save: async () => {} },
      now: () => now,
      jitter: () => 0,
      get: async (url) => {
        if (url.includes("frankfurter"))
          return '[{"base":"USD","quote":"RUB","rate":80,"date":"2026-11-04"}]';
        if (url.includes("exchangeInfo")) return exchange;
        if (url.includes("kraken")) {
          if (!krakenFirst) await gate;
          else release();
          return kraken;
        }
        if (krakenFirst) await gate;
        else release();
        return '[{"symbol":"BTCUSDT","price":"60000"}]';
      },
    });
    const rates = await service.refresh("crypto");
    expect(rates.crypto.BTC).toBe("60000");
    expect(rates.crypto.XMR).toBe("150");
    expect(rates.crypto.TON).toBe("2.1234567890123456789");
    expect(rates.unavailable).not.toContain("TON");
    expect(rates.unavailable).not.toContain("XMR");
    expect(convert("1", byCode("XMR"), byCode("USD"), rates)?.toString()).toBe(
      "149.85",
    );
    expect(convert("1", byCode("XMR"), byCode("RUB"), rates)?.toString()).toBe(
      "11988",
    );
    expect(
      convert("11988", byCode("RUB"), byCode("XMR"), rates)?.toString(),
    ).toBe("1");
    expect(convert("1", byCode("XMR"), byCode("BTC"), rates)?.toString()).toBe(
      "0.0025",
    );
    expect(rateStatus(byCode("XMR"), byCode("BTC"), rates, now)).toBe("ready");
  });
}

it("keeps Kraken quotes working during a Binance outage, caches them, and marks them stale on Kraken failure", async () => {
  let now = Date.parse("2026-11-04T12:00:00Z"),
    blocked = false;
  let saved: unknown;
  const calls: string[] = [];
  const storage = {
    load: async () => saved,
    save: async (data: unknown) => {
      saved = structuredClone(data);
    },
  };
  const get = async (url: string) => {
    calls.push(url);
    if (url.includes("frankfurter"))
      return '[{"base":"USD","quote":"RUB","rate":80,"date":"2026-11-04"}]';
    if (url.includes("binance")) throw new FetchError("HTTP 451");
    if (blocked) throw Error("offline");
    return kraken;
  };
  let service = createRateService({
    storage,
    now: () => now,
    jitter: () => 0,
    get,
  });
  const first = await service.refresh("crypto");
  expect(first.crypto.XMR).toBe("150");
  expect(first.issues?.Binance).toBeDefined();
  expect(first.issues?.Kraken).toBeUndefined();
  expect(rateStatus(byCode("XMR"), byCode("USD"), first, now)).toBe("ready");
  const requests = calls.length;
  service = createRateService({
    storage,
    now: () => now,
    jitter: () => 0,
    get,
  });
  await service.refresh("crypto");
  expect(calls).toHaveLength(requests);
  now += 121000;
  blocked = true;
  const stale = await service.refresh("crypto");
  expect(stale.crypto.XMR).toBe("150");
  expect(stale.cryptoFetchedAt?.XMR).toBe(first.cryptoFetchedAt?.XMR);
  expect(stale.issues?.Kraken).toBeDefined();
  expect(rateStatus(byCode("XMR"), byCode("USD"), stale, now)).toBe("stale");
  expect(service.nextWakeAt("crypto")).toBeGreaterThan(now);
});
