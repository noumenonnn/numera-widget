import { describe, it, expect } from "vitest";
import { createStateStore } from "../src/state-store";
import { initial } from "../src/state";
import { emptyRates } from "../src/engine";
describe("background state store", () => {
  it("reports an edit against fallback rows as unsaved after recovering different row IDs", async () => {
    const saved = initial("en");
    saved.fiat.rows[0].rowId = "previous-installation-row";
    saved.fiat.anchor.amount = "987.65";
    let read = 0,
      writes = 0;
    const store = createStateStore(
      {
        load: async () => {
          if (!read++) throw Error("read");
          return { state: saved, revision: 12 };
        },
        save: async () => {
          writes++;
        },
      },
      () => emptyRates,
      "en",
    );
    const fallback = await store.load();
    await expect(
      store.dispatch(
        {
          type: "input",
          kind: "fiat",
          rowId: fallback.state.fiat.rows[0].rowId,
          code: "RUB",
          amount: "12",
        },
        "edit",
      ),
    ).rejects.toThrow("state-conflict");
    expect(writes).toBe(0);
    expect((await store.load()).state.fiat.anchor.amount).toBe("987.65");
  });
  it("can replay the first edit after an empty-storage background restarts", async () => {
    const storage = { load: async () => ({}), save: async () => {} };
    const first = await createStateStore(
      storage,
      () => emptyRates,
      "en",
    ).load();
    const restarted = createStateStore(storage, () => emptyRates, "en");
    const result = await restarted.dispatch(
      {
        type: "input",
        kind: "fiat",
        rowId: first.state.fiat.rows[0].rowId,
        code: "RUB",
        amount: "12",
      },
      "edit",
    );
    expect(result.applied).toBe(true);
    expect(result.state.fiat.anchor.amount).toBe("12");
  });
  it("remembers a no-op receipt so replay cannot undo a later client's change", async () => {
    let data: { state?: unknown; revision?: unknown; receipts?: unknown } = {};
    const storage = {
      load: async () => data,
      save: async (state: unknown, revision: number, receipts?: string[]) => {
        data = { state, revision, receipts };
      },
    };
    let store = createStateStore(storage, () => emptyRates, "en");
    expect(
      (await store.dispatch({ type: "theme", theme: "system" }, "noop"))
        .applied,
    ).toBe(false);
    await store.dispatch({ type: "theme", theme: "dark" }, "later");
    store = createStateStore(storage, () => emptyRates, "en");
    expect(
      (await store.dispatch({ type: "theme", theme: "system" }, "noop")).state
        .theme,
    ).toBe("dark");
  });
  it("does not replay an acknowledged action after a restart", async () => {
    let data: { state?: unknown; revision?: unknown; receipts?: unknown } = {};
    const storage = {
      load: async () => data,
      save: async (state: unknown, revision: number, receipts?: string[]) => {
        data = { state, revision, receipts };
      },
    };
    let store = createStateStore(storage, () => emptyRates, "en");
    await store.dispatch({ type: "theme", theme: "dark" }, "client:1");
    await store.dispatch({ type: "theme", theme: "light" }, "client:2");
    store = createStateStore(storage, () => emptyRates, "en");
    const result = await store.dispatch(
      { type: "theme", theme: "dark" },
      "client:1",
    );
    expect(result.state.theme).toBe("light");
    expect(result.revision).toBe(2);
  });
  it("serializes writes and merges actions from different clients", async () => {
    let saved = initial("en");
    let revision = 0;
    const store = createStateStore(
      {
        load: async () => ({ state: saved, revision }),
        save: async (s, r) => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          saved = s;
          revision = r;
        },
      },
      () => emptyRates,
      "en",
    );
    const [a, b] = await Promise.all([
      store.dispatch({ type: "theme", theme: "dark" }),
      store.dispatch({ type: "locale", locale: "ru" }),
    ]);
    expect(a.revision).toBe(1);
    expect(b.revision).toBe(2);
    expect(saved.theme).toBe("dark");
    expect(saved.locale).toBe("ru");
  });
  it("does not confirm or retain an action when storage rejects", async () => {
    let reject = true;
    const store = createStateStore(
      {
        load: async () => ({ state: initial("en"), revision: 0 }),
        save: async () => {
          if (reject) throw Error("disk");
        },
      },
      () => emptyRates,
      "en",
    );
    await expect(
      store.dispatch({ type: "theme", theme: "dark" }),
    ).rejects.toThrow("disk");
    reject = false;
    const x = await store.dispatch({ type: "locale", locale: "ru" });
    expect(x.revision).toBe(1);
    expect(x.state.theme).toBe("system");
  });
});
it("reports stale undo after another client changes the same row", async () => {
  const state = initial("en");
  const rowId = state.fiat.rows[0].rowId;
  const store = createStateStore(
    { load: async () => ({ state, revision: 0 }), save: async () => {} },
    () => emptyRates,
    "en",
  );
  await store.dispatch({ type: "replace", kind: "fiat", rowId, code: "EUR" });
  await store.dispatch({ type: "replace", kind: "fiat", rowId, code: "GBP" });
  const result = await store.dispatch({
    type: "undoReplace",
    kind: "fiat",
    rowId,
    expected: "EUR",
    previous: "RUB",
  });
  expect(result.applied).toBe(false);
  expect(result.state.fiat.rows[0].code).toBe("GBP");
});
it("opens with usable defaults and signals failed storage reads", async () => {
  const store = createStateStore(
    {
      load: async () => {
        throw Error("read failed");
      },
      save: async () => {
        throw Error("write failed");
      },
    },
    () => emptyRates,
    "en",
  );
  const snapshot = await store.load();
  expect(snapshot.loadError).toBe(true);
  expect(snapshot.state.fiat.rows.map((r) => r.code)).toEqual(["RUB", "USD"]);
  await expect(
    store.dispatch({ type: "theme", theme: "dark" }),
  ).rejects.toThrow("read");
});

it("retries a failed read before merging actions from two clients", async () => {
  const saved = initial("en");
  saved.fiat.anchor.amount = "987.65";
  let reads = 0;
  let result = saved;
  const store = createStateStore(
    {
      load: async () => {
        if (++reads === 1) throw Error("read");
        return { state: saved, revision: 42 };
      },
      save: async (state) => {
        result = state;
      },
    },
    () => emptyRates,
    "en",
  );
  expect((await store.load()).loadError).toBe(true);
  const snapshots = await Promise.all([
    store.dispatch({ type: "theme", theme: "dark" }),
    store.dispatch({ type: "locale", locale: "ru" }),
  ]);
  expect(result.fiat).toEqual(saved.fiat);
  expect(result.theme).toBe("dark");
  expect(result.locale).toBe("ru");
  expect(snapshots[1].revision).toBe(44);
});
