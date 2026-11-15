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
const output = resolve(process.env.NUMERA_TEST_OUTPUT || "reports/refresh");
await mkdir(output, { recursive: true });
const profile = await mkdtemp(resolve(output, "profile-"));
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
            expression: `(globalThis.browser ?? globalThis.chrome).runtime.getManifest().homepage_url === 'https://github.com/noumenonnn/numera-widget'`,
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

  const { sessionId: workerSession } = await cdp("Target.attachToTarget", {
    targetId: worker.targetId,
    flatten: true,
  });
  async function inWorker(expression) {
    const r = await cdp(
      "Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true },
      workerSession,
    );
    assert.ok(!r.exceptionDetails, JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }
  await inWorker(
    `globalThis.fixturePhase=0;globalThis.fixtureCalls=[];globalThis.fetch=async url=>{fixtureCalls.push(String(url));await new Promise(r=>setTimeout(r,350));let data;if(String(url).includes('frankfurter'))data=[{base:'USD',quote:'RUB',rate:fixturePhase?125:100,date:new Date().toISOString().slice(0,10)}];else if(String(url).includes('exchangeInfo'))data={symbols:[{symbol:'BTCUSDT',baseAsset:'BTC',quoteAsset:'USDT',status:'TRADING',isSpotTradingAllowed:true}]};else if(String(url).includes('binance'))data=[{symbol:'BTCUSDT',price:fixturePhase?'55000':'50000'}];else data={error:[],result:{USDTZUSD:{c:['1']},TONUSDT:{c:['2']},XMRUSDT:{c:['150']}}};return new Response(JSON.stringify(data),{status:200})};`,
  );
  await cdp(
    "Emulation.setEmulatedMedia",
    { features: [{ name: "prefers-reduced-motion", value: "reduce" }] },
    sessionId,
  );
  await cdp("Page.navigate", { url: base + "popup.html" }, sessionId);
  await until(
    () =>
      evaluate(
        `document.querySelectorAll('input[data-input]').length>=2 && !document.querySelector('.refresh').disabled`,
      ),
    "popup ready",
  );
  await pause(500);
  const before = await inWorker("fixtureCalls.length");
  await inWorker("fixturePhase=1");
  await evaluate(`document.querySelector('.refresh').click()`);
  await pause(100);
  const animating = await evaluate(
    `document.querySelector('.refresh svg').getAnimations().some(a=>a.playState==='running')`,
  );
  const busy = await evaluate(
    `document.querySelector('.refresh').getAttribute('aria-busy')`,
  );
  await until(
    () =>
      evaluate(
        `[...document.querySelectorAll('input[data-input]')].some(i=>i.value==='125')`,
      ),
    "new RUB quote displayed",
  );
  const after = await inWorker("fixtureCalls.length");
  const report = {
    reducedMotion: await evaluate(
      `matchMedia('(prefers-reduced-motion: reduce)').matches`,
    ),
    animating,
    busy,
    before,
    after,
    rubQuote: await evaluate(
      `document.querySelectorAll('input[data-input]')[1].value`,
    ),
  };
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
  assert.ok(
    after > before,
    "manual click must call providers despite fresh cache",
  );
  assert.equal(report.rubQuote, "125");
  assert.equal(
    animating,
    true,
    "user-requested refresh feedback must remain visible with reduced motion",
  );
  await until(
    () => evaluate(`!document.querySelector('.refresh').disabled`),
    "refresh settles",
  );
  await pause(1000);
  assert.equal(
    await evaluate(
      `document.querySelector('.refresh svg').getAnimations().some(a=>a.playState==='running')`,
    ),
    false,
    "rotation stops",
  );
  await evaluate(`document.querySelector('.rate').click()`);
  await until(
    () => evaluate(`!!document.querySelector('.data-updated')`),
    "data updated label and row tooltips",
  );
  const updatedBeforeFailure = await evaluate(
    `document.querySelector('.data-updated').textContent`,
  );
  assert.ok(updatedBeforeFailure.startsWith("Data updated:"));
  assert.ok(
    await evaluate(
      `document.querySelector('.rate-list > div[title]').title.startsWith('Last checked:')`,
    ),
  );

  const checkedBeforeFailure = await evaluate(
    `document.querySelector('.rate-list > div[title]').title`,
  );
  const stampBeforeFailure = await inWorker(
    `(globalThis.browser ?? globalThis.chrome).storage.local.get('rates').then(({rates})=>rates.lastCheckedAt)`,
  );
  await pause(1100);
  await inWorker(
    `globalThis.fetch=async()=>{throw new TypeError('Network unavailable')}`,
  );
  await evaluate(`document.querySelector('.refresh').click()`);
  await until(
    () => evaluate(`!document.querySelector('.refresh').disabled`),
    "failed check completed",
  );
  await until(
    () =>
      evaluate(
        `document.querySelector('.rate-list > div[title]').title !== ${JSON.stringify(checkedBeforeFailure)}`,
      ),
    "last checked advances after failure",
  );
  assert.ok(
    await inWorker(
      `(globalThis.browser ?? globalThis.chrome).storage.local.get('rates').then(({rates})=>rates.lastCheckedAt > ${stampBeforeFailure})`,
    ),
  );
  assert.equal(
    await evaluate(`!!document.querySelector('.network')`),
    false,
    "provider errors must not create notifications",
  );
  assert.equal(
    await evaluate(`document.querySelectorAll('input[data-input]')[1].value`),
    "125",
    "failed check preserves cached quote",
  );
  assert.equal(
    await evaluate(`document.querySelector('.data-updated').textContent`),
    updatedBeforeFailure,
    "failed check must not change the data update time",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: real popup click, worker fetch, changed quote and rotation with reduced motion enabled",
  );
} finally {
  await cdp("Browser.close").catch(() => {});
  child.kill();
}
