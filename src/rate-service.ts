import { catalog, type Kind } from "./catalog";
import { emptyRates, type Rates } from "./engine";
import {
  FetchError,
  PayloadError,
  isRateIssue,
  issueFromError,
  migrateRateIssue,
  visibleRateProblems,
  type RateIssue,
} from "./rate-errors";
export { FetchError } from "./rate-errors";
import {
  activePairs,
  parseFx,
  parseKrakenMarket,
  parsePrices,
  positive,
  validDate,
} from "./providers";
type Policy = {
  failures: number;
  nextAllowedAt: number;
  lastError?: string;
  issue?: RateIssue;
};
type Data = {
  rates: Rates;
  policies: Record<string, Policy>;
  exchange: {
    at: number;
    pairs: string[];
    verified?: boolean;
    catalogKey?: string;
  };
};
export type RateStorage = {
  load: () => Promise<unknown>;
  save: (data: Data) => Promise<void>;
};
export function createRateService(deps: {
  storage: RateStorage;
  get: (url: string) => Promise<string>;
  now: () => number;
  jitter: () => number;
}) {
  const catalogKey = catalog
    .map(
      (currency) =>
        currency.pair ||
        currency.krakenPair ||
        currency.fxCode ||
        currency.code,
    )
    .join(",");
  const krakenCurrencies = catalog.filter((currency) => currency.krakenPair);
  const krakenUpdatedAt = (rates: Rates) => {
    const times = [
      rates.qAt,
      ...krakenCurrencies.map(
        (currency) => rates.cryptoFetchedAt?.[currency.code],
      ),
    ];
    return times.every((at) => at !== undefined)
      ? Math.min(...(times as number[]))
      : undefined;
  };
  let data: Data = {
    rates: structuredClone(emptyRates),
    policies: {},
    exchange: { at: 0, pairs: [] },
  };
  let ready: Promise<Rates> | undefined,
    pending: Promise<Rates> | undefined,
    pendingKind: Kind | undefined;
  const load = async () => {
    ready ??= (async () => {
      let raw: Partial<Data> | undefined;
      try {
        raw = (await deps.storage.load()) as Partial<Data> | undefined;
      } catch {
        data.rates.error = "Storage: storage-read";
        data.rates.errors = { Storage: "storage-read" };
        data.rates.issues = {
          Storage: {
            kind: "storage-read",
            detail: "Could not read rate cache",
          },
        };
        return data.rates;
      }
      const time = (x: unknown): x is number =>
        typeof x === "number" &&
        Number.isFinite(x) &&
        x >= 0 &&
        x <= 8640000000000000;
      const candidate = raw?.rates;
      if (candidate && typeof candidate === "object") {
        const restored: Rates = structuredClone(emptyRates);
        const time = (x: unknown): number | undefined =>
          typeof x === "number" &&
          Number.isFinite(x) &&
          x >= 0 &&
          x <= deps.now()
            ? x
            : undefined;
        if (candidate.fx && typeof candidate.fx === "object")
          for (const [code, q] of Object.entries(candidate.fx)) {
            if (
              code === "USD" ||
              !catalog.some((c) => c.kind === "fiat" && c.code === code) ||
              !q ||
              typeof q !== "object"
            )
              continue;
            const value = positive(q.rate);
            if (value && validDate(q.date))
              restored.fx[code] = {
                rate: value,
                date: q.date,
                fetchedAt: time(q.fetchedAt),
              };
          }
        if (candidate.crypto && typeof candidate.crypto === "object")
          for (const [code, value] of Object.entries(candidate.crypto)) {
            if (
              code === "USDT" ||
              !catalog.some((c) => c.kind === "crypto" && c.code === code)
            )
              continue;
            const price = positive(value);
            if (price) restored.crypto[code] = price;
          }
        const q = positive(candidate.q);
        if (q) restored.q = q;
        restored.fxAt = time(candidate.fxAt);
        restored.cryptoAt = time(candidate.cryptoAt);
        restored.qAt = time(candidate.qAt);
        if (
          candidate.cryptoFetchedAt &&
          typeof candidate.cryptoFetchedAt === "object"
        ) {
          restored.cryptoFetchedAt = {};
          for (const [code, value] of Object.entries(
            candidate.cryptoFetchedAt,
          )) {
            const at = time(value);
            if (at !== undefined && restored.crypto[code])
              restored.cryptoFetchedAt[code] = at;
          }
        }
        if (typeof candidate.error === "string")
          restored.error = candidate.error;
        if (candidate.errors && typeof candidate.errors === "object")
          restored.errors = Object.fromEntries(
            Object.entries(candidate.errors).filter(
              ([name, v]) =>
                ["Frankfurter", "Binance", "Kraken", "Storage"].includes(
                  name,
                ) && typeof v === "string",
            ),
          );
        data.rates = restored;
        restored.issues = Object.fromEntries(
          visibleRateProblems(restored, "crypto").map(({ provider, issue }) => [
            provider,
            issue,
          ]),
        );
        if (candidate.issues && typeof candidate.issues === "object")
          for (const [name, issue] of Object.entries(candidate.issues))
            if (
              ["Frankfurter", "Binance", "Kraken", "Storage"].includes(name) &&
              isRateIssue(issue)
            )
              restored.issues[name] = issue;
      }
      if (raw?.policies && typeof raw.policies === "object") {
        for (const name of ["Frankfurter", "Binance", "Kraken"]) {
          const p = raw.policies[name];
          if (
            p &&
            typeof p === "object" &&
            Number.isSafeInteger(p.failures) &&
            p.failures >= 0 &&
            time(p.nextAllowedAt) &&
            (p.lastError === undefined || typeof p.lastError === "string")
          )
            data.policies[name] = {
              failures: p.failures,
              nextAllowedAt: p.nextAllowedAt,
              lastError: p.lastError?.slice(0, 4096),
              issue: p.lastError
                ? {
                    ...(isRateIssue(p.issue)
                      ? p.issue
                      : migrateRateIssue(p.lastError)),
                    retryAt: p.nextAllowedAt,
                  }
                : undefined,
            };
        }
      }
      if (
        raw?.exchange &&
        Array.isArray(raw.exchange.pairs) &&
        time(raw.exchange.at) &&
        raw.exchange.at <= deps.now() &&
        typeof raw.exchange.verified === "boolean" &&
        raw.exchange.catalogKey === catalogKey &&
        raw.exchange.pairs.every(
          (pair) =>
            typeof pair === "string" && catalog.some((c) => c.pair === pair),
        )
      )
        data.exchange = raw.exchange;
      // A catalog update must discover new crypto pairs and quotes immediately, while
      // provider backoff still applies. Never mark new assets delisted using an old catalog.
      if (!data.exchange.verified) {
        data.rates.cryptoAt = undefined;
        data.rates.unavailable = undefined;
      }
      if (data.exchange.verified)
        data.rates.unavailable = catalog
          .filter((c) => c.pair && !data.exchange.pairs.includes(c.pair))
          .map((c) => c.code);
      return data.rates;
    })();
    await ready;
    return data.rates;
  };
  async function attempt<T>(
    name: string,
    work: () => Promise<T>,
  ): Promise<T | undefined> {
    const policy = data.policies[name];
    if (policy && policy.nextAllowedAt > deps.now()) return;
    try {
      const value = await work();
      data.policies[name] = { failures: 0, nextAllowedAt: 0 };
      return value;
    } catch (e) {
      const count = (policy?.failures || 0) + 1,
        delay = [60000, 120000, 300000][Math.min(count - 1, 2)] + deps.jitter();
      const retryAt = Math.min(
        8640000000000000,
        deps.now() +
          Math.max(delay, e instanceof FetchError ? e.retryAfter : 0),
      );
      data.policies[name] = {
        failures: count,
        nextAllowedAt: retryAt,
        lastError: String(e).slice(0, 4096),
        issue: {
          ...issueFromError(e),
          retryAt,
        },
      };
      return undefined;
    }
  }
  async function read<T>(url: string, decode: (text: string) => T): Promise<T> {
    const text = await deps.get(url);
    try {
      return decode(text);
    } catch (error) {
      throw new PayloadError(String(error));
    }
  }
  async function refresh(kind: Kind): Promise<Rates> {
    await load();
    if (pending) {
      const previous = pendingKind;
      const result = await pending;
      return kind === "crypto" && previous === "fiat" ? refresh(kind) : result;
    }
    pendingKind = kind;
    pending = (async () => {
      const now = deps.now(),
        old = data.rates,
        next: Rates = { ...old };
      const tasks: Promise<void>[] = [];
      tasks.push(
        (async () => {
          if (!old.fxAt || now - old.fxAt >= 3600000) {
            const fx = await attempt("Frankfurter", async () =>
              read("https://api.frankfurter.dev/v2/rates?base=usd", (text) =>
                parseFx(text, deps.now()),
              ),
            );
            if (fx) {
              next.fx = { ...old.fx, ...fx };
              next.fxAt = deps.now();
            }
          }
        })(),
      );
      if (kind === "crypto") {
        tasks.push(
          (async () => {
            if (!old.cryptoAt || now - old.cryptoAt >= 60000) {
              const quotes = await attempt("Binance", async () => {
                if (
                  !data.exchange.verified ||
                  !data.exchange.at ||
                  now - data.exchange.at >= 86400000
                )
                  data.exchange = {
                    at: deps.now(),
                    pairs: await read(
                      "https://data-api.binance.vision/api/v3/exchangeInfo",
                      activePairs,
                    ),
                    verified: true,
                    catalogKey,
                  };
                const pairs = data.exchange.pairs;
                next.unavailable = catalog
                  .filter((c) => c.pair && !pairs.includes(c.pair))
                  .map((c) => c.code);
                const prices = await read(
                  `https://data-api.binance.vision/api/v3/ticker/price?symbols=${encodeURIComponent(JSON.stringify(pairs))}`,
                  (text) => parsePrices(text, pairs),
                );
                const values: Record<string, string> = {},
                  times: Record<string, number> = {};
                let count = 0;
                for (const c of catalog) {
                  const price = c.pair && prices[c.pair];
                  if (price) {
                    values[c.code] = price;
                    times[c.code] = deps.now();
                    count++;
                  }
                }
                if (!count) throw new PayloadError("empty prices");
                return { values, times };
              });
              if (quotes) {
                next.crypto = { ...next.crypto, ...quotes.values };
                next.cryptoFetchedAt = {
                  ...next.cryptoFetchedAt,
                  ...quotes.times,
                };
                next.cryptoAt = deps.now();
              }
            }
          })(),
        );
        tasks.push(
          (async () => {
            const updatedAt = krakenUpdatedAt(old);
            if (updatedAt === undefined || now - updatedAt >= 60000) {
              const quotes = await attempt("Kraken", async () =>
                read(
                  `https://api.kraken.com/0/public/Ticker?pair=${["USDTUSD", ...krakenCurrencies.map((currency) => currency.krakenPair)].join(",")}`,
                  parseKrakenMarket,
                ),
              );
              if (quotes) {
                const at = deps.now();
                next.q = quotes.q;
                next.qAt = at;
                next.crypto = { ...next.crypto, ...quotes.prices };
                next.cryptoFetchedAt = {
                  ...next.cryptoFetchedAt,
                  ...Object.fromEntries(
                    Object.keys(quotes.prices).map((code) => [code, at]),
                  ),
                };
              }
            }
          })(),
        );
      }
      await Promise.all(tasks);
      next.errors = Object.fromEntries(
        Object.entries(data.policies)
          .filter(([, p]) => p.lastError)
          .map(([name, p]) => [name, p.lastError!]),
      );
      next.issues = Object.fromEntries(
        Object.entries(data.policies)
          .filter(([, policy]) => policy.lastError)
          .map(([name, policy]) => [
            name,
            policy.issue || migrateRateIssue(policy.lastError!),
          ]),
      );
      next.error =
        Object.entries(next.errors)
          .map(([name, error]) => `${name}: ${error}`)
          .join("; ") || undefined;
      data = { ...data, rates: next };
      try {
        await deps.storage.save(data);
      } catch {
        next.errors = { ...next.errors, Storage: "storage-write" };
        next.issues = {
          ...next.issues,
          Storage: {
            kind: "storage-write",
            detail: "Could not save rate cache",
          },
        };
        next.error = [next.error, "Storage: storage-write"]
          .filter(Boolean)
          .join("; ");
      }
      return next;
    })();
    try {
      return await pending;
    } finally {
      pending = undefined;
      pendingKind = undefined;
    }
  }
  const nextWakeAt = (kind: Kind) => {
    const deadline = (name: string, at: number | undefined, ttl: number) =>
      Math.max(
        at === undefined ? deps.now() : at + ttl,
        data.policies[name]?.nextAllowedAt || 0,
      );
    return Math.min(
      deadline("Frankfurter", data.rates.fxAt, 3600000),
      ...(kind === "crypto"
        ? [
            deadline("Binance", data.rates.cryptoAt, 60000),
            deadline("Kraken", krakenUpdatedAt(data.rates), 60000),
          ]
        : []),
    );
  };
  const invalidatePermissions = async () => {
    await load();
    // Wait for the old snapshot before invalidating it; otherwise it can restore
    // a fresh TTL after the permission event and suppress the required check.
    if (pending) await pending.catch(() => undefined);
    data.rates = {
      ...data.rates,
      fxAt: undefined,
      cryptoAt: undefined,
      qAt: undefined,
    };
    for (const p of Object.values(data.policies))
      if (
        p.issue?.kind === "permission-denied" ||
        (!p.issue && p.lastError?.includes("permission-denied"))
      )
        p.nextAllowedAt = 0;
  };
  return { load, refresh, nextWakeAt, invalidatePermissions };
}
