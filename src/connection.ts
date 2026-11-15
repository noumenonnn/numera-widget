import {
  isBackgroundMessage,
  type BackgroundMessage,
  type PopupMessage,
} from "./protocol";

type Port = Pick<
  browser.runtime.Port,
  "postMessage" | "disconnect" | "onMessage" | "onDisconnect"
>;
/** Reconnect only while mounted. A fresh snapshot precedes replay by the caller. */
export function createConnection(
  connect: () => Port,
  receive: (message: BackgroundMessage, fresh: boolean) => void,
  disconnected: () => void,
) {
  let port: Port | undefined,
    closed = false,
    attempts = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let snapshotTimer: ReturnType<typeof setTimeout> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const retry = () => {
    clearInterval(heartbeat);
    if (closed) return;
    disconnected();
    if (attempts < 5)
      timer = setTimeout(open, Math.min(5000, 250 * 2 ** attempts++));
  };
  const open = () => {
    if (closed || port) return;
    clearTimeout(timer);
    let p: Port;
    try {
      p = connect();
    } catch {
      retry();
      return;
    }
    port = p;
    let fresh = true;
    snapshotTimer = setTimeout(() => {
      if (port === p) {
        port = undefined;
        p.disconnect();
        retry();
      }
    }, 8000);
    p.onMessage.addListener((raw: unknown) => {
      if (port !== p || !isBackgroundMessage(raw)) return;
      const first =
        fresh && (raw.type === "state" || raw.type === "save-error");
      if (first) {
        fresh = false;
        attempts = 0;
        clearTimeout(snapshotTimer);
        // A port alone does not keep a Chrome MV3 worker alive. Send traffic
        // only while the popup is mounted so its rate timer can still run.
        heartbeat = setInterval(() => send({ type: "ping" }), 20000);
      }
      receive(raw, first);
    });
    p.onDisconnect.addListener(() => {
      if (port !== p) return;
      port = undefined;
      clearTimeout(snapshotTimer);
      retry();
    });
  };
  const send = (message: PopupMessage) => {
    if (!port) return false;
    try {
      port.postMessage(message);
      return true;
    } catch {
      const p = port;
      port = undefined;
      clearTimeout(snapshotTimer);
      p.disconnect();
      retry();
      return false;
    }
  };
  open();
  return {
    send,
    reconnect: () => {
      attempts = 0;
      open();
    },
    close: () => {
      closed = true;
      clearInterval(heartbeat);
      clearTimeout(timer);
      clearTimeout(snapshotTimer);
      const p = port;
      port = undefined;
      p?.disconnect();
    },
  };
}
