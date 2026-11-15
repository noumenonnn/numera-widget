import { byCode, catalog, type Kind } from "./catalog";
import { convert, format, parseInput, rateStatus, type Rates } from "./engine";
import type { State } from "./state";

export type SelectionQuote = {
  source: string;
  target: string;
  theme: State["theme"];
};

const escapeRegex = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const currencyTokens = [
  ...new Set(
    catalog
      .flatMap((currency) => [
        currency.code,
        ...currency.aliases,
        ...currency.symbols,
        currency.name.en,
        currency.name.ru,
      ])
      .map((token) => token.normalize("NFKC")),
  ),
].sort((a, b) => b.length - a.length);
const tokenPattern = currencyTokens
  .map(
    (token) =>
      (/^\p{L}/u.test(token) ? "(?<![\\p{L}_])" : "") +
      escapeRegex(token).replace(/\s+/g, "\\s+") +
      (/\p{L}$/u.test(token) ? "(?![\\p{L}_])" : ""),
  )
  .join("|");
const numberPattern = "[+-]?(?:\\d[\\d.,\\s]*\\d|\\d)(?:[eE][+-]?\\d+)?";
const beforeCurrency = new RegExp(`(${numberPattern})\\s*$`, "u");
const afterCurrency = new RegExp(`^\\s*(${numberPattern})`, "u");

/** Find one explicit price inside a selection; unrelated numbers (e.g. discounts)
 * do not count, and multiple prices remain ambiguous rather than guessing. */
export function parseSelection(text: string) {
  if (text.length > 128 || !/\d/.test(text)) return null;
  const normalized = text.normalize("NFKC").replace(/−/g, "-").trim();
  // A whole amount with a country is safe only when it resolves unambiguously.
  // A crypto current currency prevents a multi-fiat country from being guessed.
  const whole = parseInput(normalized, byCode("BTC"), true);
  if (whole.status === "valid" && whole.currency)
    return { amount: whole.amount, code: whole.currency.code };
  const candidates = new Map<string, { amount: string; code: string }>();
  for (const match of normalized.matchAll(new RegExp(tokenPattern, "giu"))) {
    const token = match[0];
    const start = match.index!;
    const end = start + token.length;
    const prefix = normalized.slice(0, start).match(beforeCurrency);
    const suffix = normalized.slice(end).match(afterCurrency);
    const add = (
      amount: string,
      numberStart: number,
      numberEnd: number,
      side: "before" | "after",
    ) => {
      // Check only the edge away from this currency token. Sentence punctuation
      // is allowed, but partial numbers, word fragments and percentages are not.
      if (
        side === "before" &&
        /[\p{L}\d_.,]/u.test(normalized[numberStart - 1] ?? "")
      )
        return;
      if (
        side === "after" &&
        /^(?:[\p{L}\d_%]|[.,]\d)/u.test(normalized.slice(numberEnd))
      )
        return;
      const parsed = parseInput(
        `${amount} ${token}`,
        byCode(token === "¥" ? "JPY" : "USD"),
        true,
      );
      if (parsed.status === "valid" && parsed.currency)
        candidates.set(`${numberStart}:${numberEnd}:${parsed.currency.code}`, {
          amount: parsed.amount,
          code: parsed.currency.code,
        });
    };
    if (prefix)
      add(prefix[1], prefix.index!, prefix.index! + prefix[1].length, "before");
    if (suffix) {
      const numberStart = end + suffix[0].length - suffix[1].length;
      add(suffix[1], numberStart, numberStart + suffix[1].length, "after");
    }
  }
  return candidates.size === 1 ? [...candidates.values()][0] : null;
}

export function createSelectionConverter(deps: {
  state: () => Promise<State>;
  load: () => Promise<Rates>;
  refresh: (kind: Kind) => Promise<Rates>;
}) {
  return async (text: string): Promise<SelectionQuote | null> => {
    const selected = parseSelection(text);
    if (!selected) return null;
    const state = await deps.state();
    const from = byCode(selected.code);
    const to = byCode(state.converter.rows[0].code);
    let rates = await deps.load();
    if (rateStatus(from, to, rates) !== "ready")
      rates = await deps.refresh(
        from.kind === "crypto" || to.kind === "crypto" ? "crypto" : "fiat",
      );
    const result = convert(selected.amount, from, to, rates);
    if (!result) return null;
    // Match the compact Figma format: dot decimals and up to two fractional digits
    // for ordinary prices, retaining meaningful digits for tiny crypto amounts.
    const display =
      to.kind === "fiat" && (result.abs().gte("0.01") || result.isZero())
        ? result.toDecimalPlaces(2).toFixed()
        : format(result, "en").replaceAll(" ", "");
    if (display === "range") return null;
    return {
      source: `${selected.amount} ${from.code}`,
      target: `${display} ${to.code}`,
      theme: state.theme,
    };
  };
}

export function isSelectionRequest(
  value: unknown,
): value is { type: "selection-convert"; text: string } {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return (
    m.type === "selection-convert" &&
    typeof m.text === "string" &&
    m.text.length <= 128
  );
}
