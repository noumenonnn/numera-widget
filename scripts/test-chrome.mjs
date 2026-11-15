import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Use Chromium or Chrome for Testing: branded Chrome no longer accepts
// --load-extension. A fresh, ignored profile never touches the user's browser.
assert.ok(
  process.env.NUMERA_CHROME,
  "Set NUMERA_CHROME to a Chromium or Chrome for Testing executable (see scripts/README.md).",
);
await mkdir(".test-tools", { recursive: true });
const profile = await mkdtemp(resolve(".test-tools/chrome-"));
const output = resolve(process.env.NUMERA_TEST_OUTPUT || "reports/chrome");
await mkdir(output, { recursive: true });
const extension = resolve(profile, "extension");
await cp("dist-chrome", extension, { recursive: true });
await writeFile(
  resolve(extension, "seed.html"),
  "<!doctype html><title>Numera test seed</title>",
);
const child = spawn(
  process.env.NUMERA_CHROME,
  [
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-component-update",
    "--remote-debugging-pipe",
    `--user-data-dir=${resolve(profile, "profile")}`,
    "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost",
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
  ],
  { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"], windowsHide: true },
);

// CDP over pipes uses Node's built-in streams; no driver or download required.
let nextId = 0,
  buffer = "",
  stderr = "";
const pending = new Map();
const listeners = new Set();
child.stderr.on("data", (chunk) => {
  stderr = (stderr + chunk).slice(-12000);
});
child.stdio[4].setEncoding("utf8");
child.stdio[4].on("data", (chunk) => {
  buffer += chunk;
  let end;
  while ((end = buffer.indexOf("\0")) >= 0) {
    const message = JSON.parse(buffer.slice(0, end));
    buffer = buffer.slice(end + 1);
    if (message.id) {
      const request = pending.get(message.id);
      if (request) {
        pending.delete(message.id);
        clearTimeout(request.timer);
        if (message.error)
          request.reject(new Error(JSON.stringify(message.error)));
        else request.resolve(message.result);
      }
    } else for (const listener of listeners) listener(message);
  }
});
const failPending = (error) => {
  for (const request of pending.values()) {
    clearTimeout(request.timer);
    request.reject(error);
  }
  pending.clear();
};
child.on("error", failPending);
child.on("exit", () => failPending(new Error(`Browser exited: ${stderr}`)));
function cdp(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timed out: ${method}\n${stderr}`));
    }, 15000);
    pending.set(id, { resolve, reject, timer });
    child.stdio[3].write(
      JSON.stringify({ id, method, params, sessionId }) + "\0",
    );
  });
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(read, description, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await read();
    if (result) return result;
    await pause(100);
  }
  throw new Error(`Timed out: ${description}`);
}
const errors = [];
const versions = new Map();
listeners.add((message) => {
  if (message.method === "Runtime.exceptionThrown")
    errors.push(message.params.exceptionDetails);
  if (message.method === "ServiceWorker.workerVersionUpdated")
    for (const version of message.params.versions)
      versions.set(version.versionId, version);
});
const results = {
  generatedAt: new Date().toISOString(),
  scenarios: [],
  profile,
};
try {
  results.browser = await cdp("Browser.getVersion");
  const worker = await until(async () => {
    const candidates = (await cdp("Target.getTargets")).targetInfos.filter(
      (target) =>
        target.type === "service_worker" &&
        target.url.endsWith("/background.js"),
    );
    for (const target of candidates) {
      const { sessionId: probe } = await cdp("Target.attachToTarget", {
        targetId: target.targetId,
        flatten: true,
      });
      try {
        const result = await cdp(
          "Runtime.evaluate",
          {
            expression: `chrome.runtime.getManifest().homepage_url === 'https://github.com/noumenonnn/numera-widget'`,
            returnByValue: true,
          },
          probe,
        );
        if (result.result.value) return target;
      } finally {
        await cdp("Target.detachFromTarget", { sessionId: probe });
      }
    }
  }, "extension service worker registration");
  const base = new URL(".", worker.url).href;
  const { targetId } = await cdp("Target.createTarget", {
    url: `${base}seed.html`,
  });
  const { sessionId } = await cdp("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  await cdp("Runtime.enable", {}, sessionId);
  await cdp("ServiceWorker.enable", {}, sessionId);
  async function evaluate(expression) {
    const response = await cdp(
      "Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    );
    assert.ok(
      !response.exceptionDetails,
      JSON.stringify(response.exceptionDetails),
    );
    return response.result.value;
  }
  await until(
    () =>
      evaluate(
        `location.href.startsWith(${JSON.stringify(base)}) && !!(globalThis.browser ?? globalThis.chrome)?.storage`,
      ),
    "extension document API",
  );
  // DNS is disabled for this isolated browser. Quotes are deterministic fixtures.
  await cdp("Network.enable", {}, sessionId);
  await cdp(
    "Network.setBlockedURLs",
    {
      urls: [
        "https://api.frankfurter.dev/*",
        "https://data-api.binance.vision/*",
        "https://api.kraken.com/*",
      ],
    },
    sessionId,
  );
  await evaluate(`(async () => {
    const api = globalThis.browser ?? globalThis.chrome;
    const rows = codes => codes.map(code => ({ rowId: 'r-' + code, code }));
    const tab = codes => ({ rows: rows(codes), anchor: { code: codes[0], amount: '1' }, expanded: false });
    await api.storage.local.set({
      state: { locale: 'en', theme: 'dark', tab: 'fiat', fiat: tab(['USD','RUB']), crypto: tab(['BTC','USDT']), converter: tab(['USD','RUB','BTC','USDT']) },
      stateRevision: 0,
      rates: { fx: { USD: { rate: '1', date: '' }, RUB: { rate: '100', date: '2026-11-04', fetchedAt: Date.now() } }, crypto: { USDT: '1', BTC: '50000' }, fxAt: Date.now(), cryptoAt: Date.now(), q: '1', qAt: Date.now() },
      policies: {},
    });
  })()`);
  const navigatePopup = async () => {
    await cdp("Page.navigate", { url: `${base}popup.html` }, sessionId);
    await until(
      () =>
        evaluate(
          `!!document.querySelector('.settings') && document.querySelectorAll('input[data-input]').length >= 2`,
        ),
      "popup rendering",
    );
  };
  await navigatePopup();
  assert.equal(
    await evaluate(`document.querySelector('.app').dataset.theme`),
    "dark",
  );
  results.scenarios.push(
    "MV3 module worker and popup load with persisted fixture rates",
  );
  // Exercise the real input path rather than dispatching an action directly.
  await evaluate(`(() => {
    const input = document.querySelector('input[data-input]');
    input.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '25');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await until(
    () =>
      evaluate(
        `(globalThis.browser ?? globalThis.chrome).storage.local.get('state').then(({state}) => state.converter.anchor.amount === '25')`,
      ),
    "amount persisted from UI",
  );
  await until(
    () =>
      evaluate(
        `[...document.querySelectorAll('input[data-input]')].some(x => x.value.replace(/\\s/g, '') === '2500')`,
      ),
    "derived RUB value painted",
  );
  await evaluate(`document.querySelector('.settings').click()`);
  await until(
    () => evaluate(`!!document.querySelector('#settings-heading')`),
    "settings screen",
  );
  await cdp("Page.captureScreenshot", { format: "png" }, sessionId).then(
    ({ data }) =>
      writeFile(`${output}/settings.png`, Buffer.from(data, "base64")),
  );
  results.scenarios.push(
    "input converts USD to RUB, saves state and opens settings",
  );
  // Do not attach DevTools to the worker: that would keep it alive and hide bugs.
  console.log("Chrome: checking an idle open popup for 65 seconds...");
  for (let i = 0; i < 13; i++) await pause(5000);
  assert.ok(
    (await cdp("Target.getTargets")).targetInfos.some(
      (target) => target.targetId === worker.targetId,
    ),
    "Worker stopped despite the popup heartbeat",
  );
  results.scenarios.push(
    "heartbeat keeps the same worker alive beyond two idle timeouts",
  );
  const version = await until(
    async () =>
      [...versions.values()].find(
        (v) => v.scriptURL === worker.url && v.runningStatus === "running",
      ),
    "running worker version",
  );
  await cdp(
    "ServiceWorker.stopWorker",
    { versionId: version.versionId },
    sessionId,
  );
  await until(
    () =>
      evaluate(
        `!document.body.innerText.includes('Connection lost') && !!document.querySelector('#settings-heading')`,
      ),
    "UI recovers from worker stop",
  );
  await until(
    async () =>
      (await cdp("Target.getTargets")).targetInfos.some(
        (target) =>
          target.type === "service_worker" &&
          target.url === worker.url &&
          target.targetId !== worker.targetId,
      ),
    "worker restarted by popup reconnection",
  );
  assert.equal(
    await evaluate(
      `(globalThis.browser ?? globalThis.chrome).storage.local.get('state').then(x => x.state.converter.anchor.amount)`,
    ),
    "25",
  );
  results.scenarios.push(
    "forced worker stop reconnects the mounted UI and preserves edits",
  );
  // Leave no popup consumer and verify that heartbeat does not run indefinitely.
  await cdp("Page.navigate", { url: `${base}seed.html` }, sessionId);
  console.log("Chrome: checking worker shutdown after the popup closes...");
  await until(
    async () =>
      !(await cdp("Target.getTargets")).targetInfos.some(
        (target) =>
          target.type === "service_worker" && target.url === worker.url,
      ),
    "worker naturally stops without a popup",
    60000,
  );
  await navigatePopup();
  assert.equal(
    await evaluate(`document.querySelector('input[data-input]').value`),
    "25",
  );
  results.scenarios.push(
    "worker sleeps without popup, then restores state on reopen",
  );
  assert.deepEqual(errors, [], "Unexpected page exceptions");
  await cdp("Page.captureScreenshot", { format: "png" }, sessionId).then(
    ({ data }) => writeFile(`${output}/popup.png`, Buffer.from(data, "base64")),
  );
  results.passed = true;
  console.log(
    `Chrome: ${results.scenarios.length} scenarios passed (${results.browser.product}).`,
  );
} catch (error) {
  results.error = String(error);
  throw error;
} finally {
  results.pageExceptions = errors;
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(results, null, 2) + "\n",
  );
  await cdp("Browser.close").catch(() => {});
  child.kill();
  // Retain the isolated profile in ignored .test-tools for failure diagnostics.
}
