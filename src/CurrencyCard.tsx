import type { Dispatch, SetStateAction, RefObject } from "react";
import { motion } from "motion/react";
import { ChevronsUpDown } from "lucide-react";
import { byCode } from "./catalog";
import type { Scope, Row, State, Action } from "./state";
import type { Parsed } from "./engine";
import { RowInput } from "./CurrencyRow";
import { gestureOutcome } from "./gestures";
import { tr } from "./i18n";
import type { Notice } from "./Toast";
import type { Picker } from "./CurrencyPicker";
type Set<T> = Dispatch<SetStateAction<T>>;
type Drag = { id: string; targetIndex: number; offset: number };
type Gesture = {
  id: string;
  index: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  width: number;
  step: number;
  axis: "x" | "y" | null;
  pointerType: string;
  armed: boolean;
  hold?: number;
};
export function CurrencyCard({
  row,
  i,
  rows,
  locale,
  kind,
  p,
  active,
  status,
  invalid,
  errorMessage,
  loadingValue,
  offsetX,
  drag,
  displacement,
  gesture,
  setSwipe,
  setDrag,
  remove,
  move,
  shake,
  setNotice,
  dispatch,
  updateRow,
  setProblems,
  setFocus,
  setViewPicker,
  fetching,
  inactive,
}: {
  row: Row;
  i: number;
  rows: Row[];
  locale: State["locale"];
  kind: Scope;
  p?: Parsed;
  active: boolean;
  status: "ready" | "stale" | "unavailable";
  invalid: boolean;
  errorMessage: string;
  loadingValue: boolean;
  offsetX: number;
  drag: Drag | null;
  displacement: number;
  gesture: RefObject<Gesture | null>;
  fetching: boolean;
  inactive: boolean;
  setSwipe: Set<Record<string, number>>;
  setDrag: Set<Drag | null>;
  remove: (row: Row) => void;
  move: (index: number, delta: number) => void;
  shake: (element: HTMLElement | null) => void;
  setNotice: Set<Notice | null>;
  dispatch: (action: Action) => boolean;
  updateRow: (
    kind: Scope,
    rowId: string,
    code: string,
    amount?: string,
  ) => void;
  setProblems: Set<Record<string, Parsed>>;
  setFocus: Set<string | null>;
  setViewPicker: (picker: Picker) => void;
}) {
  const c = byCode(row.code),
    t = tr[locale];
  return (
    <motion.div
      key={row.rowId}
      className="card-wrap"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18 }}
    >
      {Boolean(offsetX) && (
        <div className="swipe-action">
          <button
            onClick={() => {
              remove(row);
              setSwipe({});
            }}
          >
            {t.delete}
          </button>
        </div>
      )}
      <div
        className={"card " + (drag?.id === row.rowId ? "dragging" : "")}
        style={{
          translate: `${offsetX || 0}px 0`,
          transform: `translateY(${drag?.id === row.rowId ? drag.offset : displacement * (gesture.current?.step || 90)}px)`,
          cursor:
            i === 0 ? "default" : drag?.id === row.rowId ? "grabbing" : "grab",
        }}
        onDragStart={(e) => e.preventDefault()}
        role={i > 0 ? "group" : undefined}
        tabIndex={i > 0 ? 0 : undefined}
        aria-label={i > 0 ? `${c.code}: ${c.name[locale]}` : undefined}
        aria-describedby={i > 0 ? "row-controls" : undefined}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
            e.preventDefault();
            move(i, e.key === "ArrowUp" ? -1 : 1);
          } else if (e.key === "Delete") {
            e.preventDefault();
            remove(row);
          }
        }}
        onPointerDown={(e) => {
          if (
            (e.target as HTMLElement).closest("input,button,summary,label") ||
            e.button !== 0
          )
            return;
          if (e.pointerType === "mouse") e.preventDefault();
          const original = rows.findIndex((x) => x.rowId === row.rowId);
          const g = {
            id: row.rowId,
            index: original,
            x: e.clientX,
            y: e.clientY,
            dx: 0,
            dy: 0,
            width: e.currentTarget.getBoundingClientRect().width,
            step: e.currentTarget.getBoundingClientRect().height + 8,
            axis: null as "x" | "y" | null,
            pointerType: e.pointerType,
            armed: e.pointerType !== "touch",
            hold: undefined as number | undefined,
          };
          gesture.current = g;
          if (e.pointerType === "touch")
            g.hold = window.setTimeout(() => {
              if (gesture.current === g) g.armed = true;
            }, 350);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (!g || g.id !== row.rowId) return;
          g.dx = e.clientX - g.x;
          g.dy = e.clientY - g.y;
          if (!g.axis && Math.max(Math.abs(g.dx), Math.abs(g.dy)) > 8) {
            g.axis = Math.abs(g.dx) > Math.abs(g.dy) ? "x" : "y";
            if (g.hold && g.axis === "x") clearTimeout(g.hold);
          }
          if (g.axis === "x" && g.index > 0) {
            setDrag(null);
            setSwipe({
              [row.rowId]: Math.max(-g.width, Math.min(0, g.dx)),
            });
          } else if (g.axis === "y" && g.index > 0 && g.armed) {
            const outcome = gestureOutcome({
              ...g,
              count: rows.length,
            });
            const targetIndex =
              outcome.type === "move" ? outcome.targetIndex : g.index;
            setDrag({
              id: g.id,
              targetIndex,
              offset: g.dy,
            });
          }
        }}
        onPointerUp={() => {
          const g = gesture.current;
          if (!g || g.id !== row.rowId) return;
          if (g.hold) clearTimeout(g.hold);
          const outcome = gestureOutcome({
            ...g,
            count: rows.length,
          });
          gesture.current = null;
          setDrag(null);
          if (
            g.axis === "x" &&
            -g.dx >= g.width * 0.25 &&
            (g.index === 0 || rows.length <= 2)
          ) {
            setSwipe({});
            shake(document.getElementById(row.rowId));
            setNotice({
              text: g.index === 0 ? t.pinned : t.min,
            });
            return;
          }
          if (outcome.type === "delete") {
            setSwipe({});
            remove(row);
          } else if (outcome.type === "reveal") setSwipe({ [row.rowId]: -84 });
          else {
            setSwipe({});
            if (outcome.type === "move" && g.armed)
              dispatch({
                type: "move",
                kind: kind,
                rowId: g.id,
                targetIndex: outcome.targetIndex,
              });
          }
        }}
        onPointerCancel={() => {
          if (gesture.current?.hold) clearTimeout(gesture.current.hold);
          gesture.current = null;
          setSwipe({});
          setDrag(null);
        }}
        onLostPointerCapture={() => {
          if (gesture.current?.id === row.rowId) {
            if (gesture.current.hold) clearTimeout(gesture.current.hold);
            gesture.current = null;
            setSwipe({});
            setDrag(null);
          }
        }}
      >
        <div className="quantity">
          <label title={c.name[locale]} htmlFor={row.rowId}>
            {c.name[locale]}
          </label>
          {status === "stale" && (
            <span
              className="quote-status"
              role="img"
              title={
                status === "stale"
                  ? t.stale
                  : fetching
                    ? t.loading
                    : t.unavailable
              }
              aria-label={
                status === "stale"
                  ? t.stale
                  : fetching
                    ? t.loading
                    : t.unavailable
              }
            >
              •
            </span>
          )}
          <RowInput rowId={row.rowId} />
          {loadingValue && (
            <span className="loading-value" aria-hidden="true">
              Loading
            </span>
          )}
          {invalid && (
            <span
              id={`error-${row.rowId}`}
              role="tooltip"
              className="input-tooltip"
            >
              {errorMessage}
            </span>
          )}
        </div>
        <button
          className="currency"
          data-focus-id={row.rowId}
          onClick={() =>
            setViewPicker({
              kind: kind,
              target: row.rowId,
              returnView: "main",
            })
          }
          aria-label={`${c.code}, ${c.name[locale]}`}
        >
          <img src={c.icon} alt="" />
          <span>{c.code}</span>
          <ChevronsUpDown size={18} />
        </button>
      </div>
      {p && p.status === "ambiguous" && (
        <div className="error" role={active ? undefined : "status"}>
          {p.choices.map((x) => (
            <button
              key={x.code}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                updateRow(kind, row.rowId, x.code, p.amount);
                setProblems((prev) => ({
                  ...prev,
                  [row.rowId]: {
                    status: "valid",
                    amount: p.amount,
                    currency: x,
                  },
                }));
              }}
            >
              {x.code}
            </button>
          ))}
        </div>
      )}
      {inactive && (
        <span className="error" role="status">
          {t.inactive}
        </span>
      )}
      {invalid && !active && (
        <span className="sr-only" role="status">
          {t.invalid}
        </span>
      )}
      {p?.status === "valid" &&
        p.currency &&
        kind !== "converter" &&
        p.currency.kind !== kind && (
          <button
            className="error"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const c = p.currency!;
              const kind = c.kind;
              dispatch({
                type: "transfer",
                kind,
                code: c.code,
                amount: p.amount,
                rowId: crypto.randomUUID(),
              });
              setFocus(null);
            }}
          >
            {t.switch}
          </button>
        )}
    </motion.div>
  );
}
