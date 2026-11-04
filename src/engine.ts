import Decimal from "decimal.js";
import { catalog, normalize, type Currency, type Kind } from "./catalog";
import type { RateIssue } from "./rate-errors";
Decimal.set({
  precision: 50,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -20,
  toExpPos: 50,
});
export type Rates = {
  issues?: Record<string, RateIssue>;
  unavailable?: string[];
  fx: Record<string, { rate: string; date: string; fetchedAt?: number }>;
  crypto: Record<string, string>;
  cryptoFetchedAt?: Record<string, number>;
  q?: string;
  fxAt?: number;
  cryptoAt?: number;
  qAt?: number;
  error?: string;
  errors?: Record<string, string>;
};
export const emptyRates: Rates = {
  fx: { USD: { rate: "1", date: "" } },
  crypto: { USDT: "1" },
};
type CalculationRates = {
  unavailable?: string[];
  fx: Record<string, { rate: string | Decimal }>;
  crypto: Record<string, string | Decimal>;
  q?: string | Decimal;
};
/** Parse quotes once per snapshot, retaining the original operation order. */
export function prepareCalculationRates(rates: Rates): CalculationRates {
  const exact = (value: string) => {
    try {
      return new Decimal(value);
    } catch {
      return value;
    }
  };
  return {
    unavailable: rates.unavailable,
    fx: Object.fromEntries(
      Object.entries(rates.fx).map(([code, quote]) => [
        code,
        { rate: exact(quote.rate) },
      ]),
    ),
    crypto: Object.fromEntries(
      Object.entries(rates.crypto).map(([code, quote]) => [code, exact(quote)]),
    ),
    q: rates.q === undefined ? undefined : exact(rates.q),
  };
}
export function convertMany(
  amount: string,
  from: Currency,
  targets: Currency[],
  rates: CalculationRates,
) {
  try {
    const exact = new Decimal(amount);
    return new Map(
      targets.map((to) => [to.code, convert(exact, from, to, rates)]),
    );
  } catch {
    return new Map(targets.map((to) => [to.code, null]));
  }
}
export function convert(
  amount: string | Decimal,
  from: Currency,
  to: Currency,
  r: CalculationRates,
): Decimal | null {
  try {
    if (r.unavailable?.includes(from.code) || r.unavailable?.includes(to.code))
      return null;
    const x = amount instanceof Decimal ? amount : new Decimal(amount);
    if (from.code === to.code) return x;
    const fromFx = from.fxCode || from.code;
    const toFx = to.fxCode || to.code;
    if (from.kind === "fiat" && to.kind === "fiat") {
      if (fromFx === toFx) return x;
      if (!r.fx[fromFx] || !r.fx[toFx]) return null;
      return x.mul(r.fx[toFx].rate).div(r.fx[fromFx].rate);
    }
    if (from.kind === "crypto" && to.kind === "crypto") {
      if (!r.crypto[from.code] || !r.crypto[to.code]) return null;
      return x.mul(r.crypto[from.code]).div(r.crypto[to.code]);
    }
    if (from.kind === "crypto" && to.kind === "fiat") {
      if (!r.crypto[from.code] || !r.q || !r.fx[toFx]) return null;
      return x.mul(r.crypto[from.code]).mul(r.q).mul(r.fx[toFx].rate);
    }
    if (from.kind === "fiat" && to.kind === "crypto") {
      if (!r.fx[fromFx] || !r.q || !r.crypto[to.code]) return null;
      return x.div(r.fx[fromFx].rate).div(r.q).div(r.crypto[to.code]);
    }
    return null;
  } catch {
    return null;
  }
}
export function format(x: Decimal | null, locale: "ru" | "en", full = false) {
  if (!x) return "—";
  if (!x.isFinite() || (!x.isZero() && (x.e > 100 || x.e < -100)))
    return "range";
  if (x.isZero()) return "0";
  let s: string;
  if (full) {
    s = x.toSignificantDigits(50).toString();
  } else {
    const dp = Math.max(0, Math.min(18, 7 - x.e));
    const rounded = x.toDecimalPlaces(dp);
    s = rounded.isZero()
      ? x.toSignificantDigits(8).toExponential()
      : rounded.toFixed();
    if (s.length > 60) s = x.toSignificantDigits(8).toExponential();
  }
  const [mant, exp] = s.split("e");
  const [integer, d] = mant.split(".");
  const i = integer.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (
    i + (d ? (locale === "ru" ? "," : ".") + d : "") + (exp ? "e" + exp : "")
  );
}
export function visibleError(r: Rates, kind: Kind): string | undefined {
  if (r.errors) {
    const names =
      kind === "fiat"
        ? ["Frankfurter", "Storage"]
        : ["Frankfurter", "Binance", "Kraken", "Storage"];
    return (
      names
        .filter((name) => r.errors?.[name])
        .map((name) => `${name}: ${r.errors![name]}`)
        .join("; ") || undefined
    );
  }
  if (!r.error) return;
  return (
    r.error
      .split("; ")
      .filter((part) => kind === "crypto" || !/^Binance:|^Kraken:/.test(part))
      .join("; ") || undefined
  );
}
export function rateStatus(
  from: Currency,
  to: Currency,
  r: Rates,
  now = Date.now(),
): "ready" | "stale" | "unavailable" {
  if (!convert("1", from, to, r)) return "unavailable";
  if (from.code === to.code) return "ready";
  if (
    from.kind === "fiat" &&
    to.kind === "fiat" &&
    (from.fxCode || from.code) === (to.fxCode || to.code)
  )
    return "ready";
  let stale = false;
  const checkFiat = (c: Currency) => {
    if (c.code === "USD") return;
    const q = r.fx[c.fxCode || c.code];
    if (!q) {
      stale = true;
      return;
    }
    const checked = q.fetchedAt ?? r.fxAt;
    const date = Date.parse(q.date + "T00:00:00Z");
    if (
      !checked ||
      now - checked > 48 * 3600000 ||
      !Number.isFinite(date) ||
      now - date > 8 * 86400000
    )
      stale = true;
  };
  const checkCrypto = (c: Currency) => {
    if (c.code === "USDT") return;
    const at = r.cryptoFetchedAt ? r.cryptoFetchedAt[c.code] : r.cryptoAt;
    if (!at || now - at > 120000) stale = true;
  };
  if (from.kind === "fiat") checkFiat(from);
  else checkCrypto(from);
  if (to.kind === "fiat") checkFiat(to);
  else checkCrypto(to);
  if (from.kind !== to.kind && (!r.qAt || now - r.qAt > 120000)) stale = true;
  return stale ? "stale" : "ready";
}
export type Parsed =
  | { status: "valid"; amount: string; currency?: Currency }
  | { status: "ambiguous"; amount: string; choices: Currency[] }
  | { status: "pending" | "invalid"; reason: string };
export function parseInput(
  raw: string,
  current: Currency,
  confirmed = false,
): Parsed {
  if (raw.length > 128) return { status: "invalid", reason: "length" };
  const s = raw.normalize("NFKC").replace(/−/g, "-").trim();
  if (!s || s === "-" || /^[+-]?\d[\d\s]*[.,]$/.test(s))
    return { status: "pending", reason: "incomplete" };
  // Identify one complete numeric expression; everything else must be an exact currency token.
  const matches = [
    ...s.matchAll(/[+-]?(?:\d[\d.,\s]*\d|\d)(?:[eE][+-]?\d+)?/g),
  ];
  if (matches.length !== 1) return { status: "invalid", reason: "number" };
  const m = matches[0];
  let n = m[0].trim();
  const before = s.slice(0, m.index),
    after = s.slice((m.index ?? 0) + m[0].length);
  const token = (before + after).trim();
  const tokenHasBoundary =
    /\s$/.test(raw) || (!!before.trim() && !after.trim());
  if (/\s/.test(n)) {
    const parts = n.split(/\s+/);
    if (parts.length > 1 && !/^\d{1,3}$/.test(parts[0].replace(/^[+-]/, "")))
      return { status: "invalid", reason: "group" };
    if (
      parts
        .slice(1)
        .some((x, i) =>
          i < parts.length - 2
            ? !/^\d{3}$/.test(x)
            : !/^\d{3}(?:[.,]\d+)?(?:[eE][+-]?\d+)?$/.test(x),
        )
    )
      return { status: "invalid", reason: "group" };
    n = parts.join("");
  }
  const exp = n.match(/[eE][+-]?\d+$/)?.[0] || "";
  let base = exp ? n.slice(0, -exp.length) : n;
  const dots = (base.match(/\./g) || []).length,
    commas = (base.match(/,/g) || []).length;
  if (dots && commas) {
    const decimal = base.lastIndexOf(".") > base.lastIndexOf(",") ? "." : ",";
    const group = decimal === "." ? "," : ".";
    const chunks = base.split(decimal);
    if (chunks.length !== 2 || !/^\d+$/.test(chunks[1]))
      return { status: "invalid", reason: "group" };
    const groups = chunks[0].split(group);
    if (
      !/^[+-]?\d{1,3}$/.test(groups[0]) ||
      groups.slice(1).some((x) => !/^\d{3}$/.test(x))
    )
      return { status: "invalid", reason: "group" };
    base = groups.join("") + "." + chunks[1];
  } else if (dots > 1 || commas > 1) {
    const sep = dots ? "." : ",";
    const groups = base.split(sep);
    if (
      !/^[+-]?\d{1,3}$/.test(groups[0]) ||
      groups.slice(1).some((x) => !/^\d{3}$/.test(x))
    )
      return { status: "invalid", reason: "group" };
    base = groups.join("");
  } else base = base.replace(",", ".");
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(base))
    return { status: "invalid", reason: "number" };
  const digits = base.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length > 50) return { status: "invalid", reason: "precision" };
  let value: Decimal;
  try {
    value = new Decimal(base + exp);
  } catch {
    return { status: "invalid", reason: "number" };
  }
  if (
    !value.isFinite() ||
    (!value.isZero() && (value.e > 100 || value.e < -100))
  )
    return { status: "invalid", reason: "range" };
  if (!token) return { status: "valid", amount: value.toString() };
  const t = normalize(token);
  const candidates = catalog.filter((c) =>
    [c.code, ...c.aliases, ...c.symbols, c.name.en, c.name.ru].some(
      (a) => normalize(a) === t,
    ),
  );
  if (!candidates.length) return { status: "pending", reason: "currency" };
  if (
    !confirmed &&
    !tokenHasBoundary &&
    catalog.some((c) =>
      [c.code, ...c.aliases, c.name.en, c.name.ru].some(
        (a) => normalize(a) !== t && normalize(a).startsWith(t),
      ),
    )
  )
    return { status: "pending", reason: "confirm" };
  const resolved =
    candidates.length > 1
      ? candidates.filter((c) => c.code === current.code)
      : candidates;
  if (resolved.length === 1)
    return { status: "valid", amount: value.toString(), currency: resolved[0] };
  return { status: "ambiguous", amount: value.toString(), choices: candidates };
}
export const sameKind = (a: Currency, k: Kind) => a.kind === k;
