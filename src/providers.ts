import Decimal from "decimal.js";
import { parse, LosslessNumber } from "lossless-json";
import { catalog } from "./catalog";
export function positive(x: unknown): string | null {
  if (
    typeof x !== "string" &&
    typeof x !== "number" &&
    !(x instanceof LosslessNumber)
  )
    return null;
  const value = String(x);
  if (!/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return null;
  try {
    const d = new Decimal(value);
    return d.isFinite() && d.gt(0) ? value : null;
  } catch {
    return null;
  }
}
export function validDate(date: unknown): date is string {
  if (typeof date !== "string" || !/^\d{4}-\d\d-\d\d$/.test(date)) return false;
  const time = Date.parse(date + "T00:00:00Z");
  return (
    Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date
  );
}
export function parseFx(
  text: string,
  fetchedAt: number,
): Record<string, { rate: string; date: string; fetchedAt: number }> {
  const data = parse(text) as Array<{
    base: string;
    quote: string;
    rate: LosslessNumber;
    date: string;
  }>;
  if (!Array.isArray(data)) throw Error("invalid FX");
  const result: Record<
    string,
    { rate: string; date: string; fetchedAt: number }
  > = {};
  for (const v of data) {
    if (!v || typeof v !== "object") continue;
    const rate = v.rate instanceof LosslessNumber ? positive(v.rate) : null;
    if (
      v.base === "USD" &&
      v.quote === "USD" &&
      (!rate || !new Decimal(rate).eq(1))
    )
      throw Error("invalid FX base rate");
    if (
      v.base === "USD" &&
      typeof v.quote === "string" &&
      v.quote !== "USD" &&
      catalog.some((c) => c.kind === "fiat" && c.code === v.quote) &&
      rate &&
      validDate(v.date)
    )
      result[v.quote] = { rate, date: v.date, fetchedAt };
  }
  if (!Object.keys(result).length) throw Error("empty FX");
  return result;
}
export function activePairs(text: string): string[] {
  const data = JSON.parse(text);
  if (!Array.isArray(data?.symbols)) throw Error("invalid exchangeInfo");
  return catalog
    .filter(
      (c) =>
        c.pair &&
        data.symbols.some(
          (x: {
            symbol: string;
            baseAsset: string;
            quoteAsset: string;
            status: string;
            isSpotTradingAllowed: boolean;
          }) =>
            x.symbol === c.pair &&
            x.baseAsset === c.binanceAsset &&
            x.quoteAsset === "USDT" &&
            x.status === "TRADING" &&
            x.isSpotTradingAllowed,
        ),
    )
    .map((c) => c.pair!);
}
export function parsePrices(
  text: string,
  pairs: string[],
): Record<string, string> {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw Error("invalid prices");
  const result: Record<string, string> = {};
  for (const v of data) {
    if (typeof v?.symbol !== "string" || !pairs.includes(v.symbol)) continue;
    const price = typeof v.price === "string" ? positive(v.price) : null;
    if (price) result[v.symbol] = price;
  }
  return result;
}
export function parseKraken(text: string): string {
  const data = JSON.parse(text);
  const raw = data?.result?.USDTZUSD?.c?.[0];
  const result = typeof raw === "string" ? positive(raw) : null;
  if (!Array.isArray(data.error) || data.error.length || !result)
    throw Error("invalid ticker");
  return result;
}
