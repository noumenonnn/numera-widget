import { byCode, type Kind } from "./catalog";
import { convert, parseInput, type Rates } from "./engine";
export type Row = { rowId: string; code: string };
export type Scope = Kind | "converter";
export type Tab = {
  rows: Row[];
  anchor: { code: string; amount: string };
  expanded: boolean;
};
export type State = {
  locale: "ru" | "en";
  theme: "system" | "dark" | "light";
  tab: Kind;
  fiat: Tab;
  crypto: Tab;
  converter: Tab;
};
/** Preserve structural identity across IPC clones and optimistic acknowledgements. */
export function reconcileState(current: State | null, next: State): State {
  if (!current) return next;
  const tab = (kind: Scope): Tab => {
    const old = current[kind],
      incoming = next[kind];
    const rows =
      old.rows.length === incoming.rows.length &&
      old.rows.every(
        (row, i) =>
          row.rowId === incoming.rows[i].rowId &&
          row.code === incoming.rows[i].code,
      )
        ? old.rows
        : incoming.rows;
    const anchor =
      old.anchor.code === incoming.anchor.code &&
      old.anchor.amount === incoming.anchor.amount
        ? old.anchor
        : incoming.anchor;
    return rows === old.rows &&
      anchor === old.anchor &&
      old.expanded === incoming.expanded
      ? old
      : { ...incoming, rows, anchor };
  };
  const fiat = tab("fiat"),
    crypto = tab("crypto");
  const converter = tab("converter");
  return fiat === current.fiat &&
    converter === current.converter &&
    crypto === current.crypto &&
    current.locale === next.locale &&
    current.theme === next.theme &&
    current.tab === next.tab
    ? current
    : { ...next, fiat, crypto, converter };
}
export type Action =
  | { type: "locale"; locale: State["locale"] }
  | { type: "theme"; theme: State["theme"] }
  | { type: "tab"; kind: Kind }
  | { type: "expand"; kind: Scope; expanded: boolean }
  | { type: "add"; kind: Scope; row: Row }
  | { type: "replace"; kind: Scope; rowId: string; code: string }
  | { type: "input"; kind: Scope; rowId: string; code: string; amount: string }
  | { type: "remove"; kind: Scope; rowId: string }
  | { type: "restoreRow"; kind: Scope; row: Row; index: number }
  | { type: "move"; kind: Scope; rowId: string; targetIndex: number }
  | {
      type: "undoReplace";
      kind: Scope;
      rowId: string;
      expected: string;
      previous: string;
      otherRowId?: string;
    }
  | {
      type: "transfer";
      kind: Scope;
      code: string;
      amount: string;
      rowId: string;
    };
// Defaults must keep their identity across a background restart before the first save.
const row = (code: string): Row => ({ rowId: `default-${code}`, code });
export function initial(
  language = typeof navigator === "undefined" ? "en" : navigator.language,
): State {
  return {
    locale: language.toLowerCase().startsWith("ru") ? "ru" : "en",
    theme: "system",
    converter: {
      rows: [row("RUB"), row("USD")],
      anchor: { code: "RUB", amount: "1" },
      expanded: false,
    },
    tab: "fiat",
    fiat: {
      rows: [row("RUB"), row("USD")],
      anchor: { code: "RUB", amount: "1" },
      expanded: false,
    },
    crypto: {
      rows: [row("BTC"), row("USDT")],
      anchor: { code: "BTC", amount: "1" },
      expanded: false,
    },
  };
}
const validCode = (code: unknown, kind: Scope): code is string =>
  typeof code === "string" &&
  !!byCode(code) &&
  (kind === "converter" || byCode(code).kind === kind);
export const validAmount = (x: unknown): x is string =>
  typeof x === "string" &&
  /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(x) &&
  parseInput(x, byCode("USD"), true).status === "valid";
export function restoreState(raw: unknown, language?: string): State {
  const d = initial(language);
  if (!raw || typeof raw !== "object") return d;
  const source = raw as Partial<State>;
  const restoreTab = (x: unknown, kind: Scope): Tab => {
    const fallback = d[kind];
    if (!x || typeof x !== "object") return fallback;
    const v = x as Partial<Tab>;
    if (!Array.isArray(v.rows)) return fallback;
    const ids = new Set<string>(),
      codes = new Set<string>(),
      rows: Row[] = [];
    for (const r of v.rows) {
      if (
        !r ||
        typeof r.rowId !== "string" ||
        !r.rowId ||
        r.rowId.length > 512 ||
        ids.has(r.rowId) ||
        !validCode(r.code, kind) ||
        codes.has(r.code)
      )
        continue;
      ids.add(r.rowId);
      codes.add(r.code);
      rows.push({ rowId: r.rowId, code: r.code });
    }
    for (const item of fallback.rows) {
      if (rows.length >= 2) break;
      if (!codes.has(item.code) && !ids.has(item.rowId)) {
        rows.push(item);
        codes.add(item.code);
        ids.add(item.rowId);
      }
    }
    return {
      rows,
      anchor:
        validCode(v.anchor?.code, kind) && validAmount(v.anchor?.amount)
          ? { code: v.anchor.code, amount: v.anchor.amount }
          : { code: rows[0].code, amount: "1" },
      expanded: typeof v.expanded === "boolean" ? v.expanded : false,
    };
  };
  const fiat = restoreTab(source.fiat, "fiat");
  const crypto = restoreTab(source.crypto, "crypto");
  const primary = source.tab === "crypto" ? crypto : fiat;
  const secondary = source.tab === "crypto" ? fiat : crypto;
  const merged = {
    ...primary,
    rows: [
      ...primary.rows,
      ...secondary.rows.filter(
        (r) =>
          !primary.rows.some((p) => p.code === r.code || p.rowId === r.rowId),
      ),
    ],
  };
  return {
    locale:
      source.locale === "ru" || source.locale === "en"
        ? source.locale
        : d.locale,
    theme:
      source.theme === "dark" ||
      source.theme === "light" ||
      source.theme === "system"
        ? source.theme
        : d.theme,
    tab: source.tab === "fiat" || source.tab === "crypto" ? source.tab : d.tab,
    fiat,
    crypto,
    converter: restoreTab(source.converter || merged, "converter"),
  };
}
export function replaceRow(
  tab: Tab,
  rowId: string,
  code: string,
): { tab: Tab; focus?: string } {
  const i = tab.rows.findIndex((r) => r.rowId === rowId);
  const j = tab.rows.findIndex((r) => r.code === code);
  if (i < 0 || i === j) return { tab };
  if (i > 0 && j === 0) return { tab, focus: tab.rows[0].rowId };
  const rows = tab.rows.map((r) => ({ ...r }));
  const old = rows[i].code;
  rows[i].code = code;
  if (j >= 0) rows[j].code = old;
  return { tab: { ...tab, rows } };
}
function reanchor(tab: Tab, old: Tab, rates: Rates): Tab {
  if (tab.rows.some((r) => r.code === old.anchor.code)) return tab;
  const value = convert(
    old.anchor.amount,
    byCode(old.anchor.code),
    byCode(tab.rows[0].code),
    rates,
  );
  const amount = value?.toString();
  // Retain the exact old anchor if converting it would leave the supported
  // canonical range. Rows may change without destroying the stored amount.
  return amount && validAmount(amount)
    ? { ...tab, anchor: { code: tab.rows[0].code, amount } }
    : tab;
}
export function reduceState(s: State, a: Action, rates: Rates): State {
  if (a.type === "locale")
    return s.locale === a.locale ? s : { ...s, locale: a.locale };
  if (a.type === "theme")
    return s.theme === a.theme ? s : { ...s, theme: a.theme };
  if (a.type === "tab") return s.tab === a.kind ? s : { ...s, tab: a.kind };
  const old = s[a.kind];
  let t: Tab = old;
  switch (a.type) {
    case "expand":
      if (old.expanded === a.expanded) break;
      t = { ...old, expanded: a.expanded };
      break;
    case "add":
      if (
        validCode(a.row.code, a.kind) &&
        !rates.unavailable?.includes(a.row.code) &&
        !old.rows.some((r) => r.code === a.row.code || r.rowId === a.row.rowId)
      )
        t = { ...old, rows: [...old.rows, a.row] };
      break;
    case "replace":
    case "input": {
      if (
        !validCode(a.code, a.kind) ||
        (rates.unavailable?.includes(a.code) &&
          !old.rows.some((r) => r.rowId === a.rowId && r.code === a.code)) ||
        !old.rows.some((r) => r.rowId === a.rowId) ||
        (a.type === "input" && !validAmount(a.amount))
      )
        break;
      const result = replaceRow(old, a.rowId, a.code);
      t = result.tab;
      if (
        a.type === "input" &&
        (t.anchor.code !== a.code || t.anchor.amount !== a.amount)
      )
        t = { ...t, anchor: { code: a.code, amount: a.amount } };
      else if (a.type === "replace") t = reanchor(t, old, rates);
      break;
    }
    case "remove": {
      const i = old.rows.findIndex((r) => r.rowId === a.rowId);
      if (i < 1 || old.rows.length <= 2) break;
      t = reanchor(
        { ...old, rows: old.rows.filter((r) => r.rowId !== a.rowId) },
        old,
        rates,
      );
      break;
    }
    case "restoreRow": {
      if (
        !validCode(a.row.code, a.kind) ||
        old.rows.some((r) => r.rowId === a.row.rowId || r.code === a.row.code)
      )
        break;
      const i = Math.min(old.rows.length, Math.max(1, a.index));
      t = {
        ...old,
        rows: [...old.rows.slice(0, i), a.row, ...old.rows.slice(i)],
      };
      break;
    }
    case "move": {
      const i = old.rows.findIndex((r) => r.rowId === a.rowId);
      if (
        i < 1 ||
        i === a.targetIndex ||
        a.targetIndex < 1 ||
        a.targetIndex >= old.rows.length
      )
        break;
      const rows = [...old.rows],
        [moved] = rows.splice(i, 1);
      rows.splice(a.targetIndex, 0, moved);
      t = { ...old, rows };
      break;
    }
    case "undoReplace": {
      const i = old.rows.findIndex((r) => r.rowId === a.rowId);
      const other = old.rows.find((r) => r.code === a.previous);
      if (
        i < 0 ||
        old.rows[i].code !== a.expected ||
        (a.otherRowId ? other?.rowId !== a.otherRowId : !!other)
      )
        break;
      const result = replaceRow(old, a.rowId, a.previous);
      t = reanchor(result.tab, old, rates);
      break;
    }
    case "transfer": {
      if (
        !validCode(a.code, a.kind) ||
        rates.unavailable?.includes(a.code) ||
        (!old.rows.some((r) => r.code === a.code) &&
          old.rows.some((r) => r.rowId === a.rowId)) ||
        !validAmount(a.amount)
      )
        break;
      const rows = old.rows.some((r) => r.code === a.code)
        ? old.rows
        : [...old.rows, { rowId: a.rowId, code: a.code }];
      return {
        ...s,
        tab: a.kind === "converter" ? s.tab : a.kind,
        [a.kind]: { ...old, rows, anchor: { code: a.code, amount: a.amount } },
      };
    }
  }
  return t === old ? s : { ...s, [a.kind]: t };
}
