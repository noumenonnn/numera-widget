// Injected only into an isolated test copy; never shipped in the release ZIP.
(() => {
  const connect = browser.runtime.connect.bind(browser.runtime);
  const control = {
    phase: null,
    actionId: null,
    peerAction: null,
    connections: 0,
    events: [],
  };
  window.numeraFault = control;
  const peer = (action) => {
    const p = connect({ name: "recovery-peer" });
    let sent = false;
    p.onMessage.addListener((m) => {
      if (!sent && m.type === "state") {
        sent = true;
        p.postMessage({ type: "action", id: crypto.randomUUID(), action });
      } else if (m.ack) {
        control.events.push({ type: "peer-ack", revision: m.revision });
        p.disconnect();
      }
    });
  };
  browser.runtime.connect = (options) => {
    const p = connect(options);
    if (options?.name !== "popup") return p;
    control.connections++;
    const listeners = [];
    let ended = false;
    const lost = () => {
      if (ended) return;
      ended = true;
      control.events.push({ type: "disconnect" });
      for (const listener of listeners) listener();
    };
    p.onDisconnect.addListener(lost);
    const injectDisconnect = () => {
      p.disconnect();
      queueMicrotask(lost);
    };
    return {
      disconnect: () => p.disconnect(),
      postMessage(m) {
        if (m.type === "action") {
          control.actionId = m.id;
          if (control.phase === "before-send") {
            control.phase = null;
            control.events.push({ type: "before-send", id: m.id });
            injectDisconnect();
            throw Error("Injected disconnect before send");
          }
        }
        p.postMessage(m);
      },
      onDisconnect: { addListener: (listener) => listeners.push(listener) },
      onMessage: {
        addListener(listener) {
          p.onMessage.addListener((m) => {
            const own = m.ack && m.ack === control.actionId;
            if (own && control.phase === "before-ack") {
              control.phase = null;
              control.events.push({
                type: "before-ack",
                id: m.ack,
                revision: m.revision,
              });
              if (control.peerAction) peer(control.peerAction);
              injectDisconnect();
              return;
            }
            listener(m);
            if (own && control.phase === "after-ack") {
              control.phase = null;
              control.events.push({
                type: "after-ack",
                id: m.ack,
                revision: m.revision,
              });
              injectDisconnect();
            }
          });
        },
      },
    };
  };
})();
