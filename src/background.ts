import { emptyRates, type Rates } from "./engine";
import type { Kind } from "./catalog";
import { createRateService, FetchError } from "./rate-service";
import { createStateStore } from "./state-store";
import { isPopupMessage, type BackgroundMessage } from "./protocol";
import { extensionApi } from "./browser-api";
import {
  createSelectionConverter,
  isSelectionRequest,
} from "./selection-conversion";
let rates: Rates = structuredClone(emptyRates);
const ports = new Set<browser.runtime.Port>();
let refreshes = 0;
const consumers = new Map<browser.runtime.Port, Kind>();
let wake: ReturnType<typeof setTimeout> | undefined;
function schedule() {
  clearTimeout(wake);
  if (!consumers.size) return;
  const kind = [...consumers.values()].includes("crypto") ? "crypto" : "fiat";
  wake = setTimeout(
    () => refresh(kind),
    Math.min(
      2147000000,
      Math.max(1000, rateService.nextWakeAt(kind) - Date.now()),
    ),
  );
}
function refresh(kind: Kind, force = false) {
  refreshes++;
  broadcast({ type: "rate-status", refreshing: true });
  void rateService
    .refresh(kind, force)
    .then((snapshot) => {
      rates = snapshot;
      broadcast({
        type: "rates",
        rates,
        nextWakeAt: rateService.nextWakeAt(kind),
      });
    })
    .catch((error: unknown) => {
      console.error("rate refresh", error);
      broadcast({
        type: "rates",
        rates: {
          ...rates,
          lastCheckedAt: Date.now(),
          error: "Refresh failed",
          issues: {
            ...rates.issues,
            Internal: {
              kind: "internal",
              detail: String(error).slice(0, 4096),
            },
          },
        },
      });
    })
    .finally(() => {
      if (!--refreshes) broadcast({ type: "rate-status", refreshing: false });
      schedule();
    });
}
async function get(url: string) {
  const origin = new URL(url).origin + "/*";
  if (!(await extensionApi.permissions.contains({ origins: [origin] })))
    throw new FetchError("permission-denied", 0, "permission-denied");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
    if (!res.ok) {
      const h = res.headers.get("retry-after");
      const delay = h
        ? /^\d+$/.test(h)
          ? Number(h) * 1000
          : Math.max(0, Date.parse(h) - Date.now())
        : 0;
      throw new FetchError(
        `HTTP ${res.status}`,
        Number.isFinite(delay) ? delay : 0,
        "http",
        res.status,
      );
    }
    const text = await res.text();
    if (!(await extensionApi.permissions.contains({ origins: [origin] })))
      throw new FetchError("permission-denied", 0, "permission-denied");
    return text;
  } catch (error) {
    if (error instanceof FetchError && error.reason === "permission-denied")
      throw error;
    if (!(await extensionApi.permissions.contains({ origins: [origin] })))
      throw new FetchError("permission-denied", 0, "permission-denied");
    if (error instanceof FetchError) throw error;
    throw new FetchError(
      controller.signal.aborted ? "timeout" : "offline",
      0,
      controller.signal.aborted ? "timeout" : "offline",
    );
  } finally {
    clearTimeout(timer);
  }
}
const rateService = createRateService({
  storage: {
    load: async () =>
      extensionApi.storage.local.get(["rates", "policies", "exchange"]),
    save: async (data) => extensionApi.storage.local.set(data),
  },
  get,
  now: () => Date.now(),
  jitter: () => Math.random() * 5000,
});
const stateStore = createStateStore(
  {
    load: async () => {
      const data = await extensionApi.storage.local.get([
        "state",
        "stateRevision",
        "actionReceipts",
      ]);
      return {
        state: data.state,
        revision: data.stateRevision,
        receipts: data.actionReceipts,
      };
    },
    save: async (state, revision, receipts) => {
      await extensionApi.storage.local.set({
        state,
        stateRevision: revision,
        actionReceipts: receipts,
        schemaVersion: 1,
        catalogVersion: 1,
      });
    },
  },
  () => rates,
);
const permissionChanged = () => {
  void rateService.invalidatePermissions().then(() => {
    if (consumers.size)
      refresh([...consumers.values()].includes("crypto") ? "crypto" : "fiat");
  });
};
const selectionConvert = createSelectionConverter({
  state: async () => {
    const snapshot = await stateStore.load();
    if (snapshot.loadError) throw new Error("selection-settings-unavailable");
    return snapshot.state;
  },
  load: () => rateService.load(),
  refresh: async (kind) => {
    rates = await rateService.refresh(kind);
    broadcast({ type: "rates", rates });
    return rates;
  },
});
// A one-shot message wakes Chrome's worker without keeping it alive between selections.
extensionApi.runtime.onMessage.addListener(
  (message: unknown, sender, respond) => {
    if (
      !isSelectionRequest(message) ||
      !sender.tab ||
      !/^https?:\/\//.test(sender.url ?? "")
    )
      return false;
    void selectionConvert(message.text).then(respond, () => respond(null));
    return true;
  },
);
extensionApi.permissions.onAdded.addListener(permissionChanged);
extensionApi.permissions.onRemoved.addListener(permissionChanged);
function send(port: browser.runtime.Port, data: BackgroundMessage) {
  try {
    port.postMessage(data);
  } catch {
    /* popup closed */
  }
}
function broadcast(data: BackgroundMessage) {
  for (const p of ports) send(p, data);
}
extensionApi.runtime.onConnect.addListener((port) => {
  ports.add(port);
  port.onDisconnect.addListener(() => {
    ports.delete(port);
    consumers.delete(port);
    schedule();
  });
  port.onMessage.addListener((raw: unknown) => {
    if (!isPopupMessage(raw)) return;
    const m = raw;
    if (m.type === "refresh") {
      if (m.kind !== "fiat" && m.kind !== "crypto") return;
      consumers.set(port, m.kind);
      refresh(m.kind, m.force);
    }
    if (m.type === "action")
      void stateStore
        .dispatch(m.action, m.id)
        .then((snapshot) =>
          broadcast({ type: "state", ...snapshot, ack: m.id }),
        )
        .catch(async () => {
          const snapshot = await stateStore.load();
          send(port, { type: "save-error", ...snapshot, ack: m.id });
        });
  });
  void rateService.load().then((snapshot) => {
    rates = snapshot;
    send(port, { type: "rates", rates });
  });
  void stateStore.load().then((snapshot) =>
    send(port, {
      type: snapshot.loadError ? "save-error" : "state",
      ...snapshot,
    }),
  );
});
