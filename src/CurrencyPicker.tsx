import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import {
  animate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "motion/react";
import { normalize, type Currency } from "./catalog";
import { currencyGroup, pickerCurrencies } from "./currency-groups";
import type { Scope, Row, State } from "./state";
import { createWheelInput } from "./wheel-input";
import { tr } from "./i18n";
import { easeOut } from "./motion";
export type Picker = {
  kind: Scope;
  target?: string;
  returnView: "main" | "settings";
};
export function CurrencyPicker({
  picker,
  rows,
  locale,
  unavailable,
  onChoose,
  onClose,
}: {
  picker: Picker;
  rows: Row[];
  locale: State["locale"];
  unavailable?: string[];
  onChoose: (currency: Currency) => void;
  onClose: () => void;
}) {
  const t = tr[locale];
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(() => {
    const list = pickerCurrencies;
    const current = rows.find((row) => row.rowId === picker.target)?.code;
    return Math.max(
      0,
      picker.target
        ? list.findIndex((currency) => currency.code === current)
        : list.findIndex(
            (currency) => !rows.some((row) => row.code === currency.code),
          ),
    );
  });
  const position = useMotionValue(index);
  const [paintedPosition, setPaintedPosition] = useState(index);
  const targetPosition = useRef(index);
  const animation = useRef<ReturnType<typeof animate> | null>(null);
  const reducedMotion = useReducedMotion();
  useMotionValueEvent(position, "change", setPaintedPosition);
  useEffect(() => () => animation.current?.stop(), []);
  const search = useRef<HTMLInputElement>(null);
  const wheelGesture = useRef<{
    pointerId: number;
    y: number;
    start: number;
    moved: boolean;
  } | null>(null);
  const wheelMoved = useRef(false);
  const wheelInput = useRef(createWheelInput());
  useEffect(() => {
    const timer = setTimeout(() => search.current?.focus(), 40);
    return () => clearTimeout(timer);
  }, []);
  const options = picker
    ? pickerCurrencies
        .filter(
          (c) =>
            !query ||
            [c.code, c.name.ru, c.name.en, ...c.aliases].some((v) =>
              normalize(v).includes(normalize(query)),
            ),
        )
        .sort((a, b) => {
          const q = normalize(query);
          const rank = (c: Currency) =>
            normalize(c.code) === q
              ? 0
              : [c.name.ru, c.name.en].some((n) => normalize(n).startsWith(q))
                ? 1
                : 2;
          return rank(a) - rank(b);
        })
    : [];
  const safeIndex = Math.min(index, Math.max(0, options.length - 1));
  const wrap = (value: number) =>
    options.length
      ? ((value % options.length) + options.length) % options.length
      : 0;
  const moveTo = (next: number, immediate = false, settle = false) => {
    targetPosition.current = next;
    setIndex(wrap(Math.round(next)));
    if (immediate || reducedMotion) {
      animation.current?.stop();
      position.set(next);
    } else
      animation.current = animate(
        position,
        next,
        settle
          ? { type: "spring", duration: 0.5, bounce: 0.2 }
          : { duration: 0.16, ease: easeOut },
      );
  };
  const stepWheel = (steps: number, immediate = false) => {
    if (options.length < 2) return;
    moveTo(targetPosition.current + steps, immediate);
  };

  return (
    <>
      <header className="picker-header">
        <button
          className="icon back"
          aria-label={t.back}
          onClick={() => onClose()}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="search">
          <input
            ref={search}
            role="combobox"
            aria-label={t.search}
            aria-expanded="true"
            aria-controls="currency-options"
            aria-activedescendant={
              options[safeIndex]
                ? `option-${options[safeIndex].code}`
                : undefined
            }
            placeholder={t.search}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              moveTo(0, true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                stepWheel(1, true);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                stepWheel(-1, true);
              } else if (e.key === "Home") {
                e.preventDefault();
                moveTo(0, true);
              } else if (e.key === "End") {
                e.preventDefault();
                moveTo(options.length - 1, true);
              } else if (e.key === "PageDown") {
                e.preventDefault();
                stepWheel(5, true);
              } else if (e.key === "PageUp") {
                e.preventDefault();
                stepWheel(-5, true);
              } else if (e.key === "Enter" && options[safeIndex])
                onChoose(options[safeIndex]);
            }}
          />
        </div>
      </header>
      <div
        className="wheel"
        id="currency-options"
        role="listbox"
        aria-label={t.search}
        onWheel={(e) => {
          const steps = wheelInput.current(
            e.deltaY,
            e.deltaMode,
            performance.now(),
          );
          if (steps) stepWheel(steps);
        }}
        onPointerDown={(e) => {
          if (e.button !== 0 || !e.isPrimary || wheelGesture.current) return;
          animation.current?.stop();
          wheelMoved.current = false;
          wheelGesture.current = {
            pointerId: e.pointerId,
            y: e.clientY,
            start: position.get(),
            moved: false,
          };
        }}
        onPointerMove={(e) => {
          const g = wheelGesture.current;
          if (!g || g.pointerId !== e.pointerId) return;
          const delta = e.clientY - g.y;
          if (Math.abs(delta) > 8) {
            if (!g.moved) {
              g.moved = true;
              wheelMoved.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
            }
            const next = g.start - delta / 42;
            moveTo(next, true);
          }
        }}
        onPointerUp={(e) => {
          const g = wheelGesture.current;
          if (!g || g.pointerId !== e.pointerId) return;
          if (g.moved) {
            const next = Math.round(g.start - (e.clientY - g.y) / 42);
            moveTo(next, false, true);
            setTimeout(() => {
              wheelMoved.current = false;
            }, 0);
          } else moveTo(Math.round(position.get()), false, true);
          wheelGesture.current = null;
        }}
        onPointerCancel={() => {
          moveTo(Math.round(position.get()), false, true);
          wheelGesture.current = null;
          wheelMoved.current = false;
        }}
        onKeyDown={(e) => {
          if (e.target === search.current) return;
          if (e.key === "Escape") onClose();
          else if (e.key === "ArrowDown") {
            e.preventDefault();
            stepWheel(1, true);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            stepWheel(-1, true);
          } else if (e.key === "Home") {
            e.preventDefault();
            moveTo(0, true);
          } else if (e.key === "End") {
            e.preventDefault();
            moveTo(options.length - 1, true);
          } else if (e.key === "Enter" && options[safeIndex])
            onChoose(options[safeIndex]);
        }}
      >
        {options[safeIndex] && (
          <div className="wheel-category" aria-live="polite" aria-atomic="true">
            {currencyGroup(options[safeIndex])[locale === "ru" ? "ru" : "name"]}
          </div>
        )}
        {options.length ? (
          Array.from(
            { length: Math.min(11, options.length) },
            (_, j) =>
              Math.round(paintedPosition) +
              j -
              Math.floor((Math.min(11, options.length) - 1) / 2),
          ).map((slot) => {
            const offset = slot - paintedPosition;
            const angle = (offset * Math.PI) / 10;
            const depth = Math.max(0, Math.cos(angle));
            const n = wrap(slot);
            const c = options[n];
            const exists = rows.some((r) => r.code === c.code);
            return (
              <button
                role="option"
                id={`option-${c.code}`}
                aria-selected={n === safeIndex}
                disabled={
                  (!picker.target && exists) || unavailable?.includes(c.code)
                }
                key={slot}
                className={n === safeIndex ? "selected" : ""}
                style={{
                  transform: `translateY(calc(-50% + ${Math.sin(angle) * 156}px)) rotateX(${Math.max(-85, Math.min(85, -offset * 23))}deg) scale(${0.65 + depth * 0.35})`,
                  opacity: depth ** 8,
                  pointerEvents: depth > 0.15 ? "auto" : "none",
                }}
                onClick={() => {
                  if (!wheelMoved.current) onChoose(c);
                }}
              >
                <img src={c.icon} alt="" />
                <span>{c.name[locale]}</span>
                <small>{c.code}</small>
                {exists && <Check size={18} aria-label={t.added} />}
              </button>
            );
          })
        ) : (
          <p>{t.empty}</p>
        )}
      </div>
    </>
  );
}
