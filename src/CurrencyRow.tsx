import {
  createContext,
  memo,
  useContext,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from "react";
import type { Parsed } from "./engine";
import type { Row, State } from "./state";
import type { Kind } from "./catalog";
import { AnimatePresence } from "motion/react";

export type RowContext = {
  rows: Row[];
  code: string;
  index: number;
  locale: State["locale"];
  kind: Kind;
  fetching: boolean;
  status: string;
  active: boolean;
  inactive: boolean;
  displacement: number;
  offsetX: number;
  dragId?: string;
  dragTarget?: number;
  dragOffset?: number;
  step?: number;
};
export const sameRowContext = (previous: RowContext, next: RowContext) =>
  (Object.keys(previous) as Array<keyof RowContext>).every((key) =>
    Object.is(previous[key], next[key]),
  );
export const CurrencyRows = memo(function CurrencyRows({
  children,
}: {
  children: ReactElement[];
}) {
  return <AnimatePresence initial={false}>{children}</AnimatePresence>;
});

// Amounts update immediately through context. The static card and Motion layout
// need only reconcile when its structure, status, focus or gesture changes.
type InputStore = ReturnType<typeof createInputStore>;
function createInputStore(initial: ReadonlyMap<string, ReactElement>) {
  let inputs = initial;
  const listeners = new Map<string, Set<() => void>>();
  return {
    get: (id: string) => inputs.get(id),
    subscribe(id: string, listener: () => void) {
      const group = listeners.get(id) || new Set();
      group.add(listener);
      listeners.set(id, group);
      return () => {
        group.delete(listener);
        if (!group.size) listeners.delete(id);
      };
    },
    publish(next: ReadonlyMap<string, ReactElement>) {
      const previous = inputs;
      inputs = next;
      for (const [id, group] of listeners)
        if (previous.get(id) !== next.get(id))
          for (const notify of [...group]) notify();
    },
  };
}
const InputContext = createContext<InputStore | null>(null);
export function RowInputsProvider({
  value,
  children,
}: {
  value: ReadonlyMap<string, ReactElement>;
  children: ReactNode;
}) {
  const [store] = useState(() => createInputStore(value));
  // Publish during the commit, before paint. Unchanged inactive inputs do not
  // reconcile just because a different row received a keystroke.
  useLayoutEffect(() => store.publish(value), [store, value]);
  return (
    <InputContext.Provider value={store}>{children}</InputContext.Provider>
  );
}
export function RowInput({ rowId }: { rowId: string }) {
  const store = useContext(InputContext)!;
  return (
    useSyncExternalStore(
      (notify) => store.subscribe(rowId, notify),
      () => store.get(rowId),
    ) ?? null
  );
}
export const CurrencyRow = memo(
  function CurrencyRow({
    render,
  }: {
    render: () => ReactNode;
    context: RowContext;
    problem?: Parsed;
  }) {
    return render();
  },
  (previous, next) =>
    previous.problem === next.problem &&
    sameRowContext(previous.context, next.context),
);
