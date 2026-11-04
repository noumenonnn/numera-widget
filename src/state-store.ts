import { reduceState, restoreState, type State, type Action } from "./state";
import type { Rates } from "./engine";
type Snapshot = { state: State; revision: number; loadError?: boolean };
type Storage = {
  load: () => Promise<{
    state?: unknown;
    revision?: unknown;
    receipts?: unknown;
  }>;
  save: (state: State, revision: number, receipts?: string[]) => Promise<void>;
};
export function createStateStore(
  storage: Storage,
  rates: () => Rates,
  language?: string,
) {
  let snapshot: Snapshot | undefined;
  let ready: Promise<Snapshot> | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  let receipts: string[] = [];
  const load = () =>
    (ready ??= (async () => {
      try {
        const data = await storage.load();
        receipts = Array.isArray(data.receipts)
          ? data.receipts
              .filter((x): x is string => typeof x === "string")
              .slice(-4096)
          : [];
        snapshot = {
          state: restoreState(data.state, language),
          revision:
            typeof data.revision === "number" &&
            Number.isSafeInteger(data.revision) &&
            data.revision >= 0
              ? data.revision
              : 0,
        };
      } catch {
        snapshot = {
          state: restoreState(undefined, language),
          revision: 0,
          loadError: true,
        };
      }
      return snapshot;
    })());
  const dispatch = (
    action: Action,
    id?: string,
  ): Promise<Snapshot & { applied: boolean; duplicate?: boolean }> => {
    const result = queue.then(async () => {
      // A fallback is display-only: never write over data we could not read.
      if (snapshot?.loadError) ready = undefined;
      const current = await load();
      if (current.loadError) throw Error("storage-read");
      if (id && receipts.includes(id))
        return { ...current, applied: false, duplicate: true };
      if (
        (action.type === "input" || action.type === "replace") &&
        !current.state[action.kind].rows.some(
          (row) => row.rowId === action.rowId,
        )
      )
        throw Error("state-conflict: row no longer exists; edit was not saved");
      const state = reduceState(current.state, action, rates());
      if (state === current.state) {
        if (id) {
          const nextReceipts = [...receipts, id].slice(-4096);
          await storage.save(current.state, current.revision, nextReceipts);
          receipts = nextReceipts;
        }
        return { ...current, applied: false };
      }
      const next = { state, revision: current.revision + 1 };
      const nextReceipts = id ? [...receipts, id].slice(-4096) : receipts;
      await storage.save(next.state, next.revision, nextReceipts);
      receipts = nextReceipts;
      snapshot = next;
      ready = Promise.resolve(next);
      return { ...next, applied: true };
    });
    queue = result.catch(() => undefined);
    return result;
  };
  return { load, dispatch };
}
