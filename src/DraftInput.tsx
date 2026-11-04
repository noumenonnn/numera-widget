import { useRef } from "react";
import { byCode } from "./catalog";
import type { Row, State } from "./state";
import { tr } from "./i18n";

/** Owns focus/confirmation state; durable edits remain in the background queue. */
export function DraftInput({
  row,
  locale,
  value,
  invalid,
  loading,
  issue,
  inactive,
  getFormatted,
  onDraft,
  onFocus,
  onApply,
  onClearProblem,
}: {
  row: Row;
  locale: State["locale"];
  value: string;
  invalid: boolean;
  loading: boolean;
  issue: boolean;
  inactive: boolean;
  getFormatted: (full?: boolean) => string;
  onDraft: (value: string) => void;
  onFocus: (rowId: string | null) => void;
  onApply: (value: string, confirmed?: boolean) => void;
  onClearProblem: () => void;
}) {
  const dirty = useRef(false),
    precise = useRef("");
  const t = tr[locale],
    currency = byCode(row.code);
  return (
    <input
      id={row.rowId}
      data-input={row.rowId}
      type="text"
      inputMode="decimal"
      title={inactive ? t.inactive : undefined}
      aria-describedby={
        invalid ? `input-hint error-${row.rowId}` : "input-hint"
      }
      aria-keyshortcuts="Alt+P"
      aria-invalid={invalid}
      aria-label={loading ? `${currency.name[locale]}: Loading` : undefined}
      value={value}
      onFocus={() => {
        dirty.current = false;
        onFocus(row.rowId);
        if (!issue) {
          precise.current = getFormatted(true);
          const display = getFormatted();
          onDraft(["—", t.resultRange].includes(display) ? "" : display);
        }
      }}
      onChange={(event) => {
        dirty.current = true;
        onDraft(event.target.value);
        onApply(event.target.value);
      }}
      onBlur={(event) => {
        if (dirty.current && event.currentTarget.value)
          onApply(event.currentTarget.value, true);
        dirty.current = false;
        onFocus(null);
      }}
      onKeyDown={(event) => {
        const input = event.currentTarget;
        if (
          event.altKey &&
          event.key.toLowerCase() === "p" &&
          !dirty.current &&
          !issue
        ) {
          event.preventDefault();
          if (
            precise.current &&
            !["—", t.resultRange].includes(precise.current)
          ) {
            onDraft(precise.current);
            requestAnimationFrame(() => input.select());
          }
        }
        if (event.key === "Enter") {
          if (dirty.current || issue) onApply(input.value, true);
          dirty.current = false;
          input.blur();
        }
        if (event.key === "Escape") {
          dirty.current = false;
          onDraft(getFormatted(true));
          onClearProblem();
          input.blur();
        }
      }}
    />
  );
}
