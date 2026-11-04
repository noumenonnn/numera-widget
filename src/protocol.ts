import { validAmount, type Action, type State, type Scope } from "./state";
import type { Rates } from "./engine";
import { byCode, type Kind } from "./catalog";
import { positive, validDate } from "./providers";
import { isRateIssue } from "./rate-errors";
import Decimal from "decimal.js";

const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const text = (x: unknown): x is string =>
  typeof x === "string" && x.length > 0 && x.length <= 512;
const kind = (x: unknown): x is Kind => x === "fiat" || x === "crypto";
const code = (x: unknown, group: Scope) =>
  typeof x === "string" &&
  !!byCode(x) &&
  (group === "converter" || byCode(x).kind === group);
const row = (x: unknown, group: Scope) =>
  object(x) && text(x.rowId) && code(x.code, group);
export function isAction(x: unknown): x is Action {
  if (!object(x)) return false;
  if (x.type === "locale") return x.locale === "ru" || x.locale === "en";
  if (x.type === "theme")
    return (
      typeof x.theme === "string" &&
      ["system", "light", "dark"].includes(x.theme)
    );
  if (!kind(x.kind) && x.kind !== "converter") return false;
  switch (x.type) {
    case "tab":
      return kind(x.kind);
    case "expand":
      return typeof x.expanded === "boolean";
    case "add":
      return row(x.row, x.kind);
    case "restoreRow":
      return (
        row(x.row, x.kind) &&
        Number.isSafeInteger(x.index) &&
        Number(x.index) >= 1
      );
    case "remove":
      return text(x.rowId);
    case "move":
      return text(x.rowId) && Number.isSafeInteger(x.targetIndex);
    case "replace":
      return text(x.rowId) && code(x.code, x.kind);
    case "input":
    case "transfer":
      return text(x.rowId) && code(x.code, x.kind) && validAmount(x.amount);
    case "undoReplace":
      return (
        text(x.rowId) &&
        code(x.expected, x.kind) &&
        code(x.previous, x.kind) &&
        (x.otherRowId === undefined || text(x.otherRowId))
      );
    default:
      return false;
  }
}
export type PopupMessage =
  | { type: "refresh"; kind: Kind }
  | { type: "action"; id: string; action: Action };
export function isPopupMessage(x: unknown): x is PopupMessage {
  return (
    object(x) &&
    ((x.type === "refresh" && kind(x.kind)) ||
      (x.type === "action" && text(x.id) && isAction(x.action)))
  );
}
export type BackgroundMessage =
  | { type: "rate-status"; refreshing: boolean }
  | { type: "rates"; rates: Rates; nextWakeAt?: number }
  | {
      type: "state" | "save-error";
      state: State;
      revision: number;
      ack?: string;
      applied?: boolean;
      loadError?: boolean;
      duplicate?: boolean;
    };
export function isBackgroundMessage(x: unknown): x is BackgroundMessage {
  if (!object(x)) return false;
  if (x.type === "rate-status") return typeof x.refreshing === "boolean";
  if (x.type === "rates")
    return (
      validRates(x.rates) &&
      (x.nextWakeAt === undefined ||
        (typeof x.nextWakeAt === "number" &&
          Number.isFinite(x.nextWakeAt) &&
          x.nextWakeAt >= 0 &&
          x.nextWakeAt <= 8640000000000000))
    );
  if (x.type !== "state" && x.type !== "save-error") return false;
  if (
    !Number.isSafeInteger(x.revision) ||
    Number(x.revision) < 0 ||
    (x.ack !== undefined && !text(x.ack)) ||
    [x.applied, x.loadError, x.duplicate].some(
      (value) => value !== undefined && typeof value !== "boolean",
    ) ||
    !object(x.state)
  )
    return false;
  const s = x.state;
  return (
    (s.locale === "ru" || s.locale === "en") &&
    kind(s.tab) &&
    typeof s.theme === "string" &&
    ["dark", "light", "system"].includes(s.theme) &&
    [s.fiat, s.crypto, s.converter].every(
      (tab, i) =>
        object(tab) &&
        Array.isArray(tab.rows) &&
        tab.rows.length >= 2 &&
        tab.rows.every((entry) =>
          row(entry, i === 0 ? "fiat" : i === 1 ? "crypto" : "converter"),
        ) &&
        new Set(tab.rows.map((entry) => entry.rowId)).size ===
          tab.rows.length &&
        new Set(tab.rows.map((entry) => entry.code)).size === tab.rows.length &&
        typeof tab.expanded === "boolean" &&
        object(tab.anchor) &&
        code(
          tab.anchor.code,
          i === 0 ? "fiat" : i === 1 ? "crypto" : "converter",
        ) &&
        validAmount(tab.anchor.amount),
    )
  );
}
function validRates(x: unknown): x is Rates {
  if (!object(x) || !object(x.fx) || !object(x.crypto)) return false;
  const time = (value: unknown) =>
    value === undefined ||
    (typeof value === "number" && Number.isFinite(value) && value >= 0);
  return (
    Object.entries(x.fx).every(
      ([key, quote]) =>
        code(key, "fiat") &&
        object(quote) &&
        typeof quote.rate === "string" &&
        !!positive(quote.rate) &&
        typeof quote.date === "string" &&
        (key === "USD"
          ? new Decimal(quote.rate).eq(1)
          : validDate(quote.date)) &&
        time(quote.fetchedAt),
    ) &&
    Object.entries(x.crypto).every(
      ([key, value]) =>
        code(key, "crypto") &&
        typeof value === "string" &&
        !!positive(value) &&
        (key !== "USDT" || new Decimal(value).eq(1)),
    ) &&
    (x.q === undefined || (typeof x.q === "string" && !!positive(x.q))) &&
    [x.fxAt, x.cryptoAt, x.qAt].every(time) &&
    (x.cryptoFetchedAt === undefined ||
      (object(x.cryptoFetchedAt) &&
        Object.entries(x.cryptoFetchedAt).every(
          ([key, value]) =>
            code(key, "crypto") && typeof value === "number" && time(value),
        ))) &&
    (x.error === undefined || typeof x.error === "string") &&
    (x.issues === undefined ||
      (object(x.issues) && Object.values(x.issues).every(isRateIssue))) &&
    (x.errors === undefined ||
      (object(x.errors) &&
        Object.values(x.errors).every((value) => typeof value === "string"))) &&
    (x.unavailable === undefined ||
      (Array.isArray(x.unavailable) &&
        x.unavailable.every((value) => code(value, "crypto"))))
  );
}
