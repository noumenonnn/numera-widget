import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Settings,
  RefreshCcw,
  Plus,
  ChevronsUpDown,
  ChevronsDownUp,
  Sun,
  Moon,
  Monitor,
  X,
} from "lucide-react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import "@fontsource-variable/geist";
import "./style.css";
import { catalog, byCode, rateTable, type Currency } from "./catalog";
import {
  convert,
  convertMany,
  prepareCalculationRates,
  emptyRates,
  format,
  parseInput,
  rateStatus,
  type Rates,
  type Parsed,
} from "./engine";
import {
  reconcileState,
  reduceState,
  type Action,
  type Scope,
  type State,
  type Row,
} from "./state";
import { createConnection } from "./connection";
import { tr } from "./i18n";
import { RateNotice } from "./RateNotice";
import { CurrencyPicker, type Picker } from "./CurrencyPicker";
import { Toast, type Notice } from "./Toast";
import {
  CurrencyRow,
  CurrencyRows,
  RowInputsProvider,
  sameRowContext,
  type RowContext,
} from "./CurrencyRow";
import { CurrencyCard } from "./CurrencyCard";
import { DraftInput } from "./DraftInput";
import { usePaintedSnapshot } from "./use-painted-snapshot";
function App() {
  const [state, setState] = useState<State | null>(null),
    [rates, setRates] = useState<Rates>(emptyRates),
    [fetching, setFetching] = useState(true),
    [connectionLost, setConnectionLost] = useState(false),
    [nextWakeAt, setNextWakeAt] = useState(0),
    [view, setView] = useState<"main" | "settings" | "picker">("main"),
    [picker, setPicker] = useState<Picker | null>(null),
    [draft, setDraft] = useState<Record<string, string>>({}),
    [focus, setFocus] = useState<string | null>(null),
    [problems, setProblems] = useState<Record<string, Parsed>>({}),
    [notice, setNotice] = useState<Notice | null>(null);
  const port = useRef<ReturnType<typeof createConnection> | null>(null),
    stateRef = useRef<State | null>(null),
    confirmed = useRef<{ state: State; revision: number } | null>(null),
    pendingActions = useRef<Array<{ id: string; action: Action }>>([]),
    ratesRef = useRef<Rates>(rates),
    returnFocus = useRef<string | null>(null),
    scrollRef = useRef<HTMLElement>(null),
    gesture = useRef<{
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
    } | null>(null),
    [swipe, setSwipe] = useState<Record<string, number>>({}),
    [drag, setDrag] = useState<{
      id: string;
      targetIndex: number;
      offset: number;
    } | null>(null);
  stateRef.current = state;
  ratesRef.current = rates;
  const activeKind = state ? "converter" : undefined;
  const activeAnchor = state ? state.converter.anchor : undefined;
  const locale = state?.locale;
  const anchorCode = activeAnchor?.code;
  const activeRows = state?.converter.rows;
  const allAdded = useMemo(() => {
    const present = new Set(activeRows?.map((row) => row.code));
    return catalog.every((currency) => present.has(currency.code));
  }, [activeRows]);
  const calculationRates = useMemo(
    () => prepareCalculationRates(rates),
    [rates],
  );
  const statuses = useMemo(() => {
    if (!anchorCode) return new Map<string, ReturnType<typeof rateStatus>>();
    return new Map(
      catalog.map((currency) => [
        currency.code,
        rateStatus(byCode(anchorCode), currency, rates),
      ]),
    );
  }, [anchorCode, rates]);
  const values = useMemo(() => {
    if (!activeAnchor) return new Map<string, ReturnType<typeof convert>>();
    const anchor = activeAnchor;
    return convertMany(
      anchor.amount,
      byCode(anchor.code),
      catalog,
      calculationRates,
    );
  }, [activeAnchor, calculationRates]);
  const exactView = useRef({
    values,
    locale: locale || ("en" as State["locale"]),
  });
  exactView.current = { values, locale: locale || "en" };
  const inputCache = useRef(
    new Map<
      string,
      {
        code: string;
        locale: State["locale"];
        kind: Scope;
        value: string;
        loading: boolean;
        inactive: boolean;
        element: React.ReactElement;
      }
    >(),
  );
  const paintedValues = usePaintedSnapshot(values);
  const cardCache = useRef(
    new Map<
      string,
      { context: RowContext; problem?: Parsed; element: React.ReactElement }
    >(),
  );
  const rowChildren = useRef<React.ReactElement[]>([]);
  const paintedText = useMemo(
    () =>
      new Map(
        [...paintedValues].map(([code, value]) => {
          const text = format(value, locale || "en");
          return [
            code,
            text === "range" ? tr[locale || "en"].resultRange : text,
          ];
        }),
      ),
    [paintedValues, locale],
  );
  useEffect(() => {
    const connection = createConnection(
      () => browser.runtime.connect({ name: "popup" }),
      (msg, fresh) => {
        if (fresh) setConnectionLost(false);
        if (msg.type === "rate-status") {
          setFetching(!!msg.refreshing);
          return;
        }
        if (msg.type === "rates") {
          setNextWakeAt(msg.nextWakeAt || 0);
          ratesRef.current = msg.rates;
          setRates(msg.rates);
          return;
        }
        if (msg.type === "state" || msg.type === "save-error") {
          const acknowledged = msg.ack
            ? pendingActions.current.find((x) => x.id === msg.ack)
            : undefined;
          if (msg.ack)
            pendingActions.current = pendingActions.current.filter(
              (x) => x.id !== msg.ack,
            );
          if (!confirmed.current || msg.revision >= confirmed.current.revision)
            confirmed.current = { state: msg.state, revision: msg.revision };
          let next = confirmed.current.state;
          for (const item of pendingActions.current)
            next = reduceState(next, item.action, ratesRef.current);
          next = reconcileState(stateRef.current, next);
          stateRef.current = next;
          setState(next);
          if (msg.type === "save-error")
            setNotice({ text: tr[next.locale].saveError });
          else if (
            msg.applied === false &&
            !msg.duplicate &&
            acknowledged &&
            ["undoReplace", "restoreRow"].includes(acknowledged.action.type)
          )
            setNotice({ text: tr[next.locale].undoUnavailable });
        }
        if (fresh && (msg.type === "state" || msg.type === "save-error")) {
          if (!msg.loadError)
            for (const item of pendingActions.current)
              connection.send({ type: "action", ...item });
          connection.send({
            type: "refresh",
            kind: "crypto",
          });
        }
      },
      () => {
        setConnectionLost(true);
        setFetching(false);
        const messages = tr[stateRef.current?.locale || "en"];
        setNotice({
          text: messages.connectionError,
          actionLabel: messages.retry,
          undo: () => port.current?.reconnect(),
        });
      },
    );
    port.current = connection;
    return () => {
      port.current = null;
      connection.close();
    };
  }, []);
  useEffect(() => {
    if (locale) document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    if (!activeKind) return;
    setFetching(true);
    port.current?.send({ type: "refresh", kind: "crypto" });
    const online = () => {
      port.current?.reconnect();
      port.current?.send({ type: "refresh", kind: "crypto" });
    };
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [activeKind]);
  useEffect(() => {
    if (view === "settings") {
      const id = window.setTimeout(
        () => document.getElementById("settings-heading")?.focus(),
        190,
      );
      return () => clearTimeout(id);
    }
  }, [view]);
  useEffect(() => {
    const cancel = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (gesture.current) {
        if (gesture.current.hold) clearTimeout(gesture.current.hold);
        gesture.current = null;
        setSwipe({});
        setDrag(null);
        return;
      }
      if (view === "settings") {
        setView("main");
        setTimeout(
          () =>
            document
              .querySelector<HTMLElement>('[data-focus-id=\"settings\"]')
              ?.focus(),
          220,
        );
      } else if (view === "picker" && picker) {
        setView(picker.returnView);
        const id = returnFocus.current;
        if (id)
          setTimeout(
            () =>
              document
                .querySelector<HTMLElement>(`[data-focus-id=\"${id}\"]`)
                ?.focus(),
            220,
          );
      }
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [view, picker]);
  const dispatch = (action: Action): boolean => {
    const current = stateRef.current;
    if (!current) return false;
    const next = reduceState(current, action, ratesRef.current);
    if (
      next === current &&
      (action.type === "undoReplace" || action.type === "restoreRow")
    ) {
      setNotice({ text: tr[current.locale].undoUnavailable });
      return false;
    }
    if (next === current) return false;
    const id = crypto.randomUUID();
    pendingActions.current.push({ id, action });
    stateRef.current = next;
    setState(next);
    try {
      if (!port.current?.send({ type: "action", id, action })) {
        setNotice({
          text: tr[current.locale].connectionError,
          actionLabel: tr[current.locale].retry,
          undo: () => port.current?.reconnect(),
        });
        return false;
      }
      return true;
    } catch {
      setNotice({ text: tr[current.locale].saveError });
      return false;
    }
  };
  if (!state) {
    const messages =
      tr[navigator.language.toLowerCase().startsWith("ru") ? "ru" : "en"];
    return (
      <div className="app" data-theme="system">
        <main className="settings-list">
          <p role="status">
            {connectionLost ? messages.connectionError : messages.connecting}
          </p>
          {connectionLost && (
            <button onClick={() => port.current?.reconnect()}>
              {messages.retry}
            </button>
          )}
        </main>
      </div>
    );
  }
  const t = tr[state.locale],
    tab = state.converter;
  const updatedAt =
    rates.fxAt && rates.cryptoAt
      ? Math.min(rates.fxAt, rates.cryptoAt)
      : undefined;
  const setViewPicker = (request: Picker) => {
    returnFocus.current =
      (document.activeElement as HTMLElement)?.dataset.focusId || null;
    setPicker(request);
    setView("picker");
  };
  const closePicker = (view: "main" | "settings") => {
    setView(view);
    const id = returnFocus.current;
    if (id)
      setTimeout(
        () =>
          document
            .querySelector<HTMLElement>(`[data-focus-id=\"${id}\"]`)
            ?.focus(),
        220,
      );
  };
  const updateRow = (
    kind: Scope,
    rowId: string,
    code: string,
    amount?: string,
  ) => {
    const current = stateRef.current;
    if (!current) return;
    const old = current[kind];
    const i = old.rows.findIndex((r) => r.rowId === rowId);
    if (i > 0 && old.rows[0].code === code)
      setTimeout(
        () =>
          document
            .querySelector<HTMLInputElement>(
              `[data-input="${old.rows[0].rowId}"]`,
            )
            ?.focus(),
        0,
      );
    dispatch(
      amount === undefined
        ? { type: "replace", kind, rowId, code }
        : { type: "input", kind, rowId, code, amount },
    );
  };
  const choose = (c: Currency) => {
    if (!picker) return;
    const p = picker;
    const before = stateRef.current![p.kind];
    if (rates.unavailable?.includes(c.code)) return;
    if (!p.target) {
      if (before.rows.some((r) => r.code === c.code)) return;
      dispatch({
        type: "add",
        kind: p.kind,
        row: { rowId: crypto.randomUUID(), code: c.code },
      });
    } else {
      const current = before.rows.find((r) => r.rowId === p.target);
      const other = before.rows.find((r) => r.code === c.code);
      const changedIds = [p.target, ...(other ? [other.rowId] : [])];
      setDraft((previous) =>
        Object.fromEntries(
          Object.entries(previous).filter(([id]) => !changedIds.includes(id)),
        ),
      );
      setProblems((previous) =>
        Object.fromEntries(
          Object.entries(previous).filter(([id]) => !changedIds.includes(id)),
        ),
      );
      updateRow(p.kind, p.target, c.code);
      if (
        current &&
        before.rows[0].rowId === p.target &&
        current.code !== c.code
      ) {
        const rowId = p.target,
          previous = current.code;
        setNotice({
          text: `${t.fiat} — ${c.code}`,
          undo: () =>
            dispatch({
              type: "undoReplace",
              kind: p.kind,
              rowId,
              expected: c.code,
              previous,
              otherRowId: other?.rowId,
            }),
        });
      }
    }
    closePicker(p.returnView);
  };
  const shake = (element: HTMLElement | null) => {
    if (!element) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.animate([{ opacity: 1 }, { opacity: 0.45 }, { opacity: 1 }], {
        duration: 260,
        easing: "ease-out",
      });
      return;
    }
    element.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-5px)" },
        { transform: "translateX(5px)" },
        { transform: "translateX(-3px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 260, easing: "ease-out" },
    );
  };
  const apply = (row: Row, text: string, confirmedInput = false) => {
    const result = parseInput(text, byCode(row.code), confirmedInput);
    setProblems((x) => ({ ...x, [row.rowId]: result }));
    if (result.status !== "valid") {
      if (
        (confirmedInput && result.status !== "ambiguous") ||
        (result.status === "invalid" &&
          problems[row.rowId]?.status !== "invalid")
      )
        shake(document.getElementById(row.rowId));
      return;
    }
    const c = result.currency || byCode(row.code);

    const current = stateRef.current?.converter;
    const target = current?.rows.find((r) => r.rowId === row.rowId);
    const other = current?.rows.find((r) => r.code === c.code);
    if (
      target &&
      current?.rows[0].rowId === row.rowId &&
      target.code !== c.code
    ) {
      const kind = "converter",
        previous = target.code;
      setNotice({
        text: `${t.fiat} — ${c.code}`,
        undo: () =>
          dispatch({
            type: "undoReplace",
            kind,
            rowId: row.rowId,
            expected: c.code,
            previous,
            otherRowId: other?.rowId,
          }),
      });
    }
    updateRow("converter", row.rowId, c.code, result.amount);
  };
  const remove = (row: Row) => {
    const i = tab.rows.findIndex((r) => r.rowId === row.rowId);
    if (i === 0) {
      shake(document.getElementById(row.rowId));
      setNotice({ text: t.pinned });
      return;
    }
    if (tab.rows.length <= 2) {
      shake(document.getElementById(row.rowId));
      setNotice({ text: t.min });
      return;
    }
    const kind = "converter";
    const keyboardFocus = document
      .getElementById(row.rowId)
      ?.closest(".card")
      ?.contains(document.activeElement);
    const focusRow = (id: string) =>
      requestAnimationFrame(() => document.getElementById(id)?.focus());
    dispatch({ type: "remove", kind, rowId: row.rowId });
    if (keyboardFocus)
      focusRow(tab.rows[i + 1]?.rowId || tab.rows[i - 1].rowId);
    setNotice({
      text: `${row.code} ${state.locale === "ru" ? "удалён" : "removed"}`,
      undo: () => {
        const applied = dispatch({ type: "restoreRow", kind, row, index: i });
        if (applied) focusRow(row.rowId);
        return applied;
      },
    });
  };
  const move = (i: number, delta: number) => {
    const row = tab.rows[i];
    if (row)
      dispatch({
        type: "move",
        kind: "converter",
        rowId: row.rowId,
        targetIndex: i + delta,
      });
  };
  const val = (code: string) => values.get(code) ?? null;
  const rate = (code: string) =>
    convert("1", byCode(tab.rows[0].code), byCode(code), rates);
  const show = (v: ReturnType<typeof convert>, full = false) => {
    const s = format(v, state.locale, full);
    return s === "range" ? t.resultRange : s;
  };
  const quote = (v: ReturnType<typeof convert>) =>
    !v && fetching ? <span className="loading-text">Loading</span> : show(v);
  const inputs = new Map<string, React.ReactElement>();
  const previousInputs = inputCache.current;
  inputCache.current = new Map();
  const previousCards = cardCache.current;
  cardCache.current = new Map();
  const stableRowChildren = (next: React.ReactElement[]) => {
    const previous = rowChildren.current;
    if (
      previous.length === next.length &&
      next.every((element, index) => element === previous[index])
    )
      return previous;
    rowChildren.current = next;
    return next;
  };
  const exactText = (code: string, full = false) => {
    const view = exactView.current;
    const text = format(view.values.get(code) ?? null, view.locale, full);
    return text === "range" ? tr[view.locale].resultRange : text;
  };
  return (
    <MotionConfig reducedMotion="user">
      <RowInputsProvider value={inputs}>
        <div className="app" data-theme={state.theme} data-view={view}>
          <motion.div
            key={view}
            className="surface"
            initial={{ y: 6 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            {view === "main" ? (
              <>
                <header>
                  <h1 id="converter-heading">{t.converter}</h1>
                  <button
                    className="icon refresh"
                    aria-label={t.refresh}
                    title={t.refresh}
                    disabled={fetching || connectionLost}
                    aria-busy={fetching}
                    onClick={() =>
                      port.current?.send({ type: "refresh", kind: "crypto" })
                    }
                  >
                    <RefreshCcw size={18} />
                  </button>
                  <button
                    className="icon settings"
                    data-focus-id="settings"
                    aria-label={t.settings}
                    onClick={() => setView("settings")}
                  >
                    <Settings size={18} />
                  </button>
                </header>
                <main
                  aria-labelledby="converter-heading"
                  id="currency-panel"
                  className="scroll"
                  ref={scrollRef}
                >
                  <div className={"rows " + (drag ? "drag-active" : "")}>
                    <CurrencyRows key="converter">
                      {stableRowChildren(
                        tab.rows.map((row, i) => {
                          const c = byCode(row.code),
                            p = problems[row.rowId],
                            cardProblem = p?.status === "valid" ? undefined : p,
                            active = focus === row.rowId,
                            status = statuses.get(c.code)!,
                            issue = !!p && p.status !== "valid",
                            invalid =
                              p?.status === "invalid" ||
                              (!active && p?.status === "pending"),
                            errorMessage =
                              invalid &&
                              p &&
                              (p.status === "invalid" || p.status === "pending")
                                ? (t.errors as Record<string, string>)[
                                    p.reason
                                  ] || t.invalid
                                : "",
                            loadingValue =
                              fetching && !val(row.code) && !active && !issue,
                            originalDragIndex = drag
                              ? tab.rows.findIndex((r) => r.rowId === drag.id)
                              : -1,
                            displacement =
                              drag &&
                              drag.id !== row.rowId &&
                              originalDragIndex < drag.targetIndex &&
                              i > originalDragIndex &&
                              i <= drag.targetIndex
                                ? -1
                                : drag &&
                                    drag.id !== row.rowId &&
                                    originalDragIndex > drag.targetIndex &&
                                    i >= drag.targetIndex &&
                                    i < originalDragIndex
                                  ? 1
                                  : 0;
                          const inputValue =
                            active || issue
                              ? (draft[row.rowId] ?? show(val(row.code), true))
                              : loadingValue
                                ? ""
                                : (paintedText.get(row.code) ??
                                  show(val(row.code)));
                          const cached = previousInputs.get(row.rowId);
                          if (
                            !active &&
                            !issue &&
                            cached &&
                            cached.code === row.code &&
                            cached.locale === state.locale &&
                            cached.kind === "converter" &&
                            cached.value === inputValue &&
                            cached.loading === loadingValue &&
                            cached.inactive ===
                              !!rates.unavailable?.includes(row.code)
                          ) {
                            inputs.set(row.rowId, cached.element);
                            inputCache.current.set(row.rowId, cached);
                          } else {
                            const element = (
                              <DraftInput
                                row={row}
                                locale={state.locale}
                                value={inputValue}
                                invalid={invalid}
                                loading={loadingValue}
                                issue={issue}
                                inactive={!!rates.unavailable?.includes(c.code)}
                                getFormatted={(full) =>
                                  exactText(row.code, full)
                                }
                                onFocus={setFocus}
                                onDraft={(value) =>
                                  setDraft((previous) => ({
                                    ...previous,
                                    [row.rowId]: value,
                                  }))
                                }
                                onApply={(value, confirmed) =>
                                  apply(row, value, confirmed)
                                }
                                onClearProblem={() =>
                                  setProblems((previous) => {
                                    const next = { ...previous };
                                    delete next[row.rowId];
                                    return next;
                                  })
                                }
                              />
                            );
                            inputs.set(row.rowId, element);
                            if (!active && !issue)
                              inputCache.current.set(row.rowId, {
                                code: row.code,
                                locale: state.locale,
                                kind: "converter",
                                value: inputValue,
                                loading: loadingValue,
                                inactive: !!rates.unavailable?.includes(
                                  row.code,
                                ),
                                element,
                              });
                          }
                          const context: RowContext = {
                            rows: tab.rows,
                            code: row.code,
                            index: i,
                            locale: state.locale,
                            kind: "converter",
                            fetching,
                            status,
                            active,
                            inactive: !!rates.unavailable?.includes(row.code),
                            displacement,
                            offsetX: swipe[row.rowId] || 0,
                            dragId: drag?.id,
                            dragTarget: drag?.targetIndex,
                            dragOffset: drag?.offset,
                            step: gesture.current?.step,
                          };
                          const cachedCard = previousCards.get(row.rowId);
                          if (
                            cachedCard &&
                            cachedCard.problem === cardProblem &&
                            sameRowContext(cachedCard.context, context)
                          ) {
                            cardCache.current.set(row.rowId, cachedCard);
                            return cachedCard.element;
                          }
                          const element = (
                            <CurrencyRow
                              key={row.rowId}
                              problem={cardProblem}
                              context={context}
                              render={() => (
                                <CurrencyCard
                                  row={row}
                                  i={i}
                                  rows={tab.rows}
                                  locale={state.locale}
                                  kind="converter"
                                  p={cardProblem}
                                  active={active}
                                  status={status}
                                  invalid={invalid}
                                  errorMessage={errorMessage}
                                  loadingValue={loadingValue}
                                  offsetX={swipe[row.rowId] || 0}
                                  drag={drag}
                                  displacement={displacement}
                                  gesture={gesture}
                                  setSwipe={setSwipe}
                                  setDrag={setDrag}
                                  remove={remove}
                                  move={move}
                                  shake={shake}
                                  setNotice={setNotice}
                                  dispatch={dispatch}
                                  updateRow={updateRow}
                                  setProblems={setProblems}
                                  setFocus={setFocus}
                                  setViewPicker={setViewPicker}
                                  fetching={fetching}
                                  inactive={
                                    !!rates.unavailable?.includes(c.code)
                                  }
                                />
                              )}
                            />
                          );
                          cardCache.current.set(row.rowId, {
                            context,
                            problem: cardProblem,
                            element,
                          });
                          return element;
                        }),
                      )}
                    </CurrencyRows>
                  </div>
                  <p id="input-hint" className="sr-only">
                    {t.hint}
                  </p>
                  <p id="row-controls" className="sr-only">
                    {t.rowControls}
                  </p>
                  <button
                    className="add"
                    data-focus-id="add"
                    aria-label={t.add}
                    disabled={allAdded}
                    title={allAdded ? t.allAdded : undefined}
                    aria-describedby={
                      allAdded ? "catalog-exhausted" : undefined
                    }
                    onClick={() =>
                      setViewPicker({ kind: "converter", returnView: "main" })
                    }
                  >
                    <Plus size={24} />
                  </button>
                  {allAdded && (
                    <p id="catalog-exhausted" className="network">
                      {t.allAdded}
                    </p>
                  )}
                  <button
                    className="rate"
                    aria-expanded={tab.expanded}
                    aria-controls="rate-list"
                    onClick={() =>
                      dispatch({
                        type: "expand",
                        kind: "converter",
                        expanded: !tab.expanded,
                      })
                    }
                  >
                    <span>
                      1 {tab.rows[0].code} = {quote(rate(tab.rows[1].code))}{" "}
                      {tab.rows[1].code}
                    </span>
                    {tab.expanded ? (
                      <ChevronsDownUp size={18} />
                    ) : (
                      <ChevronsUpDown size={18} />
                    )}
                  </button>
                  <AnimatePresence initial={false}>
                    {tab.expanded && (
                      <motion.div
                        id="rate-list"
                        className="rate-list"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{
                          duration: 0.2,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        onAnimationComplete={() => {
                          window.setTimeout(() => {
                            const current = stateRef.current;
                            const scroller = scrollRef.current;
                            if (current?.converter.expanded && scroller)
                              scroller.scrollTo({
                                top: scroller.scrollHeight,
                                behavior: matchMedia(
                                  "(prefers-reduced-motion: reduce)",
                                ).matches
                                  ? "auto"
                                  : "smooth",
                              });
                          }, 120);
                        }}
                        style={{ overflow: "hidden" }}
                      >
                        {rateTable.map((code) => {
                          const status = rateStatus(
                            byCode(tab.rows[0].code),
                            byCode(code),
                            rates,
                          );
                          const date =
                            byCode(code).kind === "fiat"
                              ? rates.fx[code]?.date
                              : undefined;
                          return (
                            <div
                              key={code}
                              title={[
                                date,
                                status === "stale"
                                  ? t.stale
                                  : status === "unavailable"
                                    ? t.unavailable
                                    : "",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            >
                              <img src={byCode(code).icon} alt="" />
                              <span className="rate-currency-name">
                                {byCode(code).name[state.locale]}{" "}
                                <small>{code}</small>
                              </span>
                              {status === "stale" && (
                                <span
                                  className="table-status"
                                  role="img"
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
                              <strong>{quote(rate(code))}</strong>
                            </div>
                          );
                        })}
                        {updatedAt && (
                          <small>
                            {t.updated}:{" "}
                            {new Date(updatedAt).toLocaleString(
                              state.locale === "ru" ? "ru-RU" : "en-US",
                            )}
                          </small>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <RateNotice
                    rates={rates}
                    kind="crypto"
                    locale={state.locale}
                    nextWakeAt={nextWakeAt}
                    onDenied={() => setNotice({ text: t.permissionDenied })}
                    onRetry={() => {
                      port.current?.reconnect();
                      port.current?.send({
                        type: "refresh",
                        kind: "crypto",
                      });
                    }}
                  />
                </main>
              </>
            ) : null}
            {view === "settings" ? (
              <>
                <header className="settings-header">
                  <h1 id="settings-heading" tabIndex={-1}>
                    {t.settings}
                  </h1>
                  <button
                    className="icon"
                    onClick={() => {
                      setView("main");
                      setTimeout(
                        () =>
                          document
                            .querySelector<HTMLElement>(
                              '[data-focus-id=\"settings\"]',
                            )
                            ?.focus(),
                        220,
                      );
                    }}
                    aria-label={t.back}
                  >
                    <X size={18} />
                  </button>
                </header>
                <main className="settings-list">
                  <div>
                    <span>{t.language}</span>
                    <div className="segmented">
                      {(["ru", "en"] as const).map((l) => (
                        <button
                          key={l}
                          aria-pressed={state.locale === l}
                          onClick={() =>
                            dispatch({ type: "locale", locale: l })
                          }
                        >
                          {l.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span>{t.theme}</span>
                    <div className="segmented">
                      {(
                        [
                          { id: "light", Icon: Sun },
                          { id: "system", Icon: Monitor },
                          { id: "dark", Icon: Moon },
                        ] as const
                      ).map(({ id, Icon }) => (
                        <button
                          key={id}
                          aria-label={
                            state.locale === "ru"
                              ? (
                                  {
                                    light: "Светлая",
                                    dark: "Тёмная",
                                    system: "Системная",
                                  } as const
                                )[id]
                              : (
                                  {
                                    light: "Light",
                                    dark: "Dark",
                                    system: "System",
                                  } as const
                                )[id]
                          }
                          aria-pressed={state.theme === id}
                          onClick={() => dispatch({ type: "theme", theme: id })}
                        >
                          <Icon size={18} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span>{t.fiat}</span>
                    <button
                      className="currency"
                      data-focus-id="default-converter"
                      onClick={() =>
                        setViewPicker({
                          kind: "converter",
                          target: state.converter.rows[0].rowId,
                          returnView: "settings",
                        })
                      }
                    >
                      <img
                        src={byCode(state.converter.rows[0].code).icon}
                        alt=""
                      />
                      {state.converter.rows[0].code}
                      <ChevronsUpDown size={18} />
                    </button>
                  </div>
                </main>
                <div className="brand">
                  <img src="icons/numera-128.png" alt="" /> Numera{" "}
                  <span>v{browser.runtime.getManifest().version}</span>
                </div>
              </>
            ) : null}
            {view === "picker" && picker && (
              <CurrencyPicker
                picker={picker}
                rows={state[picker.kind].rows}
                locale={state.locale}
                unavailable={rates.unavailable}
                onChoose={choose}
                onClose={() => closePicker(picker.returnView)}
              />
            )}
          </motion.div>
          {notice && (
            <Toast
              notice={notice}
              setNotice={setNotice}
              undoLabel={t.undo}
              dismissLabel={t.dismiss}
            />
          )}
        </div>
      </RowInputsProvider>
    </MotionConfig>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
