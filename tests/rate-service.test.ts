import { describe, it, expect } from "vitest";
import {
  createRateService,
  FetchError,
  type RateStorage,
} from "../src/rate-service";
import { emptyRates, visibleError } from "../src/engine";
const exchange = JSON.stringify({
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
      baseAsset: "ETH",
      quoteAsset: "USDT",
      status: "TRADING",
      isSpotTradingAllowed: true,
    },
  ],
});
const fx = '[{"base":"USD","quote":"RUB","date":"2026-11-02","rate":100}]';
const prices =
  '[{"symbol":"BTCUSDT","price":"50000"},{"symbol":"ETHUSDT","price":"2500"}]';
const kraken = '{"error":[],"result":{"USDTZUSD":{"c":["0.99"]}}}';
it("classifies provider schema errors separately from network failures", async () => {
  const service = createRateService({
    storage: memory(),
    now: () => 1000000,
    jitter: () => 0,
    get: async () => "not-json",
  });
  expect((await service.refresh("fiat")).issues?.Frankfurter.kind).toBe(
    "invalid-payload",
  );
});
it("exposes typed HTTP status and permission failure without parsing UI strings", async () => {
  const http = createRateService({
    storage: memory(),
    now: () => 1000000,
    jitter: () => 0,
    get: async () => {
      throw new FetchError("HTTP 451");
    },
  });
  expect((await http.refresh("fiat")).issues?.Frankfurter).toMatchObject({
    kind: "http",
    status: 451,
  });
  const denied = createRateService({
    storage: memory(),
    now: () => 1000000,
    jitter: () => 0,
    get: async () => {
      throw new FetchError("permission-denied", 0, "permission-denied");
    },
  });
  expect((await denied.refresh("fiat")).issues?.Frankfurter.kind).toBe(
    "permission-denied",
  );
});
it("invalidates permission policy even while the initial cache is loading", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  const service = createRateService({
    storage: {
      load: async () => {
        await gate;
        return {
          rates: { ...emptyRates, fxAt: 1000000 },
          policies: {
            Frankfurter: {
              failures: 1,
              nextAllowedAt: 2000000,
              lastError: "permission-denied",
            },
          },
        };
      },
      save: async () => {},
    },
    now: () => 1000000,
    jitter: () => 0,
    get: async () => {
      calls++;
      return fx;
    },
  });
  const loaded = service.load();
  const invalidated = service.invalidatePermissions();
  release();
  await Promise.all([loaded, invalidated]);
  await service.refresh("fiat");
  expect(calls).toBe(1);
});
it("does not let an in-flight response erase a permission invalidation", async () => {
  let release!: () => void,
    calls = 0;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const service = createRateService({
    storage: memory(),
    now: () => 1000000,
    jitter: () => 0,
    get: async () => {
      calls++;
      await gate;
      return fx;
    },
  });
  const first = service.refresh("fiat");
  await new Promise((resolve) => setTimeout(resolve, 0));
  const invalidated = service.invalidatePermissions();
  release();
  await Promise.all([first, invalidated]);
  await service.refresh("fiat");
  expect(calls).toBe(2);
});
it("preserves a server Retry-After longer than a day across restart", async () => {
  const storage = memory();
  let now = 1000000,
    calls = 0;
  const deps = {
    storage,
    now: () => now,
    jitter: () => 0,
    get: async () => {
      calls++;
      throw new FetchError("HTTP 429", 172800000);
    },
  };
  await createRateService(deps).refresh("fiat");
  now += 3600000;
  const restored = createRateService(deps);
  await restored.refresh("fiat");
  expect(calls).toBe(1);
  expect(restored.nextWakeAt("fiat")).toBe(1000000 + 172800000);
});
it("exposes the actual retry deadline for a fiat consumer", async () => {
  let now = 1000000;
  const service = createRateService({
    storage: memory(),
    now: () => now,
    jitter: () => 0,
    get: async () => {
      throw new FetchError("HTTP 429", 120000);
    },
  });
  await service.refresh("fiat");
  expect(service.nextWakeAt("fiat")).toBe(now + 120000);
  now += 120000;
  await service.refresh("fiat");
  expect(service.nextWakeAt("fiat")).toBe(now + 120000);
});
it("marks a confirmed delisting separately from historical prices", async () => {
  let now = 1000000,
    delisted = false;
  const service = createRateService({
    storage: memory(),
    now: () => now,
    jitter: () => 0,
    get: async (url) => {
      if (url.includes("frankfurter")) return fx;
      if (url.includes("exchangeInfo"))
        return delisted
          ? JSON.stringify({
              symbols: JSON.parse(exchange).symbols.slice(0, 1),
            })
          : exchange;
      if (url.includes("binance")) return prices;
      return kraken;
    },
  });
  await service.refresh("crypto");
  now += 86400001;
  delisted = true;
  const snapshot = await service.refresh("crypto");
  expect(snapshot.unavailable).toContain("ETH");
  expect(snapshot.crypto.ETH).toBe("2500");
});
it("publishes fresh quotes with a distinct storage error if saving fails", async () => {
  const service = createRateService({
    storage: {
      load: async () => ({}),
      save: async () => {
        throw Error("disk");
      },
    },
    now: () => 1000000,
    jitter: () => 0,
    get: async () => fx,
  });
  const snapshot = await service.refresh("fiat");
  expect(snapshot.fx.RUB.rate).toBe("100");
  expect(snapshot.errors?.Storage).toBe("storage-write");
});
it("ignores corrupt policies instead of poisoning refresh", async () => {
  const service = createRateService({
    storage: {
      load: async () => ({
        policies: {
          damaged: null,
          Frankfurter: { failures: -1, nextAllowedAt: Infinity },
        },
        exchange: { at: Infinity, pairs: [null], verified: "yes" },
      }),
      save: async () => {},
    },
    now: () => 1000000,
    jitter: () => 0,
    get: async () => fx,
  });
  expect((await service.refresh("fiat")).fx.RUB.rate).toBe("100");
});
it("starts independent providers before FX completes", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const calls: string[] = [];
  const service = createRateService({
    storage: memory(),
    now: () => 1000000,
    jitter: () => 0,
    get: async (url) => {
      calls.push(url);
      if (url.includes("frankfurter")) {
        await gate;
        return fx;
      }
      if (url.includes("exchangeInfo")) return exchange;
      if (url.includes("binance")) return prices;
      return kraken;
    },
  });
  const pending = service.refresh("crypto");
  await new Promise((resolve) => setTimeout(resolve, 0));
  const independentStarted =
    calls.some((url) => url.includes("kraken")) &&
    calls.some((url) => url.includes("exchangeInfo"));
  release();
  await pending;
  expect(independentStarted).toBe(true);
});
function memory(): RateStorage {
  let data: unknown = {};
  return {
    load: async () => structuredClone(data),
    save: async (x) => {
      data = structuredClone(x);
    },
  };
}
describe("shared rate service", () => {
  it("deduplicates concurrent consumers and caches one atomic snapshot", async () => {
    const calls: string[] = [];
    let n = 1000000;
    const service = createRateService({
      storage: memory(),
      now: () => n,
      jitter: () => 0,
      get: async (url) => {
        calls.push(url);
        if (url.includes("frankfurter")) return fx;
        if (url.includes("exchangeInfo")) return exchange;
        if (url.includes("binance")) return prices;
        return kraken;
      },
    });
    const [a, b] = await Promise.all([
      service.refresh("crypto"),
      service.refresh("crypto"),
    ]);
    expect(calls).toHaveLength(4);
    expect(a).toEqual(b);
    expect(a.crypto.BTC).toBe("50000");
    expect(a.q).toBe("0.99");
    n += 1000;
    await service.refresh("crypto");
    expect(calls).toHaveLength(4);
  });
  it("retains cached prices and preserves Retry-After across restart", async () => {
    let now = 1000000,
      count = 0;
    const storage = memory();
    const get = async (url: string) => {
      count++;
      if (url.includes("frankfurter")) return fx;
      if (url.includes("exchangeInfo")) return exchange;
      if (url.includes("binance")) throw new FetchError("HTTP 429", 300000);
      return kraken;
    };
    let service = createRateService({
      storage,
      now: () => now,
      jitter: () => 0,
      get,
    });
    await service.refresh("crypto");
    const before = count;
    now += 60000;
    service = createRateService({
      storage,
      now: () => now,
      jitter: () => 0,
      get,
    });
    const next = await service.refresh("crypto");
    expect(count - before).toBe(1);
    expect(next.error).toContain("429");
    expect(next.crypto).toEqual(emptyRates.crypto);
  });
  it("updates only confirmed symbols and preserves timestamps of missing prices", async () => {
    let now = 1000000,
      pass = 0;
    const storage = memory();
    const get = async (url: string) => {
      if (url.includes("frankfurter")) return fx;
      if (url.includes("exchangeInfo")) return exchange;
      if (url.includes("binance"))
        return pass ? '[{"symbol":"BTCUSDT","price":"51000"}]' : prices;
      return kraken;
    };
    const service = createRateService({
      storage,
      now: () => now,
      jitter: () => 0,
      get,
    });
    const first = await service.refresh("crypto");
    pass++;
    now += 61000;
    const second = await service.refresh("crypto");
    expect(second.crypto.ETH).toBe("2500");
    expect(second.cryptoFetchedAt?.ETH).toBe(first.cryptoFetchedAt?.ETH);
    expect(second.cryptoFetchedAt?.BTC).toBe(now);
  });
});
it("repairs individual corrupt cache records while retaining usable quotes", async () => {
  const storage: RateStorage = {
    load: async () => ({
      rates: {
        fx: {
          USD: { rate: "-1", date: "bad" },
          RUB: { rate: "100", date: "2026-11-02" },
          EUR: { rate: "invalid", date: "2026-11-02" },
        },
        crypto: { USDT: "7", BTC: "50000", ETH: "NaN" },
        q: "-1",
        fxAt: 1000,
      },
    }),
    save: async () => {},
  };
  const service = createRateService({
    storage,
    now: () => 1000,
    jitter: () => 0,
    get: async () => {
      throw Error("offline");
    },
  });
  const result = await service.load();
  expect(result.fx.USD.rate).toBe("1");
  expect(result.fx.RUB.rate).toBe("100");
  expect(result.fx.EUR).toBeUndefined();
  expect(result.crypto.USDT).toBe("1");
  expect(result.crypto.BTC).toBe("50000");
  expect(result.crypto.ETH).toBeUndefined();
  expect(result.q).toBeUndefined();
});
it("upgrades an in-flight fiat request when a crypto consumer appears", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const calls: string[] = [];
  const service = createRateService({
    storage: memory(),
    now: () => 1000000,
    jitter: () => 0,
    get: async (url) => {
      calls.push(url);
      if (url.includes("frankfurter")) {
        await gate;
        return fx;
      }
      if (url.includes("exchangeInfo")) return exchange;
      if (url.includes("binance")) return prices;
      return kraken;
    },
  });
  const a = service.refresh("fiat");
  await Promise.resolve();
  const b = service.refresh("crypto");
  release();
  await Promise.all([a, b]);
  expect(calls.filter((x) => x.includes("frankfurter"))).toHaveLength(1);
  expect(calls.filter((x) => x.includes("ticker/price"))).toHaveLength(1);
  expect((await service.load()).crypto.BTC).toBe("50000");
});
it("recovers after offline startup without inventing a rate or retrying too early", async () => {
  let now = 1000000,
    online = false,
    calls = 0;
  const service = createRateService({
    storage: memory(),
    now: () => now,
    jitter: () => 0,
    get: async () => {
      calls++;
      if (!online) throw Error("offline");
      return fx;
    },
  });
  const first = await service.refresh("fiat");
  expect(first.fx.RUB).toBeUndefined();
  expect(first.error).toContain("offline");
  online = true;
  now += 59000;
  await service.refresh("fiat");
  expect(calls).toBe(1);
  now += 1001;
  const restored = await service.refresh("fiat");
  expect(calls).toBe(2);
  expect(restored.fx.RUB.rate).toBe("100");
  expect(restored.error).toBeUndefined();
});
it("preserves valid cache when a provider later blocks access", async () => {
  let now = 1000000,
    blocked = false;
  const service = createRateService({
    storage: memory(),
    now: () => now,
    jitter: () => 0,
    get: async () => {
      if (blocked) throw new FetchError("HTTP 451");
      return fx;
    },
  });
  await service.refresh("fiat");
  blocked = true;
  now += 3600001;
  const result = await service.refresh("fiat");
  expect(result.fx.RUB.rate).toBe("100");
  expect(result.error).toContain("HTTP 451");
});
it("discards invalid cached calendar dates", async () => {
  const storage: RateStorage = {
    load: async () => ({
      rates: { fx: { RUB: { rate: "100", date: "2026-02-31" } } },
    }),
    save: async () => {},
  };
  const service = createRateService({
    storage,
    now: () => 1,
    jitter: () => 0,
    get: async () => {
      throw Error("offline");
    },
  });
  expect((await service.load()).fx.RUB).toBeUndefined();
});
it("does not show a crypto-provider error on the fiat tab", async () => {
  const service = createRateService({
    storage: memory(),
    now: () => 1000000,
    jitter: () => 0,
    get: async (url) => {
      if (url.includes("frankfurter")) return fx;
      if (url.includes("exchangeInfo")) return exchange;
      if (url.includes("binance")) throw new FetchError("HTTP 451");
      return kraken;
    },
  });
  expect((await service.refresh("crypto")).error).toContain("Binance");
  expect(visibleError(await service.refresh("fiat"), "fiat")).toBeUndefined();
});
