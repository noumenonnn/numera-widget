import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import JSZip from "jszip";
import { Builder } from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";

const target = process.argv[2] || "chrome";
const output = resolve(
  process.env.NUMERA_TEST_OUTPUT || `reports/selection-${target}`,
);
await mkdir(output, { recursive: true });
const profile = await mkdtemp(resolve(output, `profile-${target}-`));
const extension = resolve(profile, "extension");
await cp(target === "chrome" ? "dist-chrome" : "dist", extension, {
  recursive: true,
});
await writeFile(
  resolve(extension, "seed.html"),
  "<!doctype html><title>Selection test seed</title>",
);
const html = `<!doctype html><html><head><title>Selection fixture</title><style>
body{background:#454545;margin:80px;font:18px sans-serif;min-height:140vh}p{width:max-content;color:white}
/* Deliberately hostile rules to verify isolation. */
div{font-size:99px!important;line-height:99px!important;background:red!important;padding:90px!important}
</style></head><body><p id="price">30 USD</p><p id="rub">81.684 RUB</p><p id="plain">12345</p>
<p id="symbol">$30</p><p id="name">30 долларов</p><p id="euro">30 EUR</p>
<p id="sale">Sale -32% $31.44</p>
<p id="edit" contenteditable="true">30 USD</p><input id="input" value="30 USD">
<p id="edge" style="position:fixed;right:0;bottom:0">30 USD</p><iframe src="/frame"></iframe></body></html>`;
const server = createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    ...(req.url === "/strict"
      ? {
          "Content-Security-Policy":
            "default-src 'self'; style-src 'self'; img-src 'none'; font-src 'none'; script-src 'self'",
        }
      : {}),
  });
  res.end(
    req.url === "/frame"
      ? '<!doctype html><p id="frame-price">30 USD</p>'
      : html,
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, label) {
  const end = Date.now() + 12000;
  while (Date.now() < end) {
    if (await fn()) return;
    await pause(100);
  }
  if (page && evaluate) {
    console.error(
      "Page diagnostic",
      await evaluate(
        page,
        `({focus:document.hasFocus(),selection:getSelection().toString(),active:document.activeElement?.outerHTML,tooltip:document.querySelector('#numera-selection-tooltip')?.outerHTML})`,
      ),
    );
    await screenshot?.("failure");
  }
  throw Error(`Timed out: ${label}`);
}
let close, evaluate, focus, screenshot, seed, page, stopWorker, navigate;
const errors = [];
const results = { target, scenarios: [], output };
const stateFixture = `(() => {
  const tab=codes=>({rows:codes.map(code=>({rowId:'r-'+code,code})),anchor:{code:codes[0],amount:'1'},expanded:false});
  return {state:{locale:'en',theme:'dark',tab:'fiat',fiat:tab(['RUB','USD']),crypto:tab(['BTC','USDT']),converter:tab(['RUB','USD'])},stateRevision:0,
    rates:{fx:{USD:{rate:'1',date:''},RUB:{rate:'81.684',date:new Date().toISOString().slice(0,10),fetchedAt:Date.now()}},crypto:{USDT:'1'},fxAt:Date.now()},policies:{Frankfurter:{failures:1,nextAllowedAt:Date.now()+3600000,lastError:'offline'}}};
})()`;
const select = (id) =>
  `(() => {document.activeElement?.blur();const s=getSelection(),r=document.createRange();r.selectNodeContents(document.getElementById(${JSON.stringify(id)}));s.removeAllRanges();s.addRange(r);})()`;
const visible = `!!document.querySelector('#numera-selection-tooltip')?.matches(':popover-open')`;
const details = `(() => {
  const h=document.querySelector('#numera-selection-tooltip');if(!h?.matches(':popover-open'))return null;
  const t=h.shadowRoot.querySelector('.tooltip'),s=getComputedStyle(t),r=h.getBoundingClientRect(),img=t.querySelector('img');
  return {text:t.textContent,theme:h.dataset.theme,x:r.x,y:r.y,width:r.width,height:r.height,font:s.fontFamily,fontSize:s.fontSize,fontWeight:s.fontWeight,radius:s.borderRadius,padding:s.paddingInlineStart,border:getComputedStyle(t,"::before").paddingTop,gap:s.gap,background:s.backgroundColor,color:getComputedStyle(t.querySelector('.target')).color,arrowLoaded:img.complete&&img.naturalWidth===18,fontLoaded:document.fonts.check('600 14px "Numera Selection Geist"'),viewport:[innerWidth,innerHeight]};
})()`;
try {
  if (target === "chrome") {
    assert.ok(
      process.env.NUMERA_CHROME,
      "Set NUMERA_CHROME to Chrome for Testing",
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
        `--disable-extensions-except=${extension}`,
        `--load-extension=${extension}`,
      ],
      {
        stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    close = async () => child.kill();
    let id = 0,
      buffer = "";
    const pending = new Map(),
      events = [];
    child.stdio[4].setEncoding("utf8");
    child.stdio[4].on("data", (chunk) => {
      buffer += chunk;
      let end;
      while ((end = buffer.indexOf("\0")) >= 0) {
        const m = JSON.parse(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
        if (m.id) {
          const p = pending.get(m.id);
          if (p) {
            pending.delete(m.id);
            clearTimeout(p.timer);
            m.error
              ? p.reject(Error(JSON.stringify(m.error)))
              : p.resolve(m.result);
          }
        } else {
          events.push(m);
          if (m.method === "Runtime.exceptionThrown") errors.push(m.params);
        }
      }
    });
    const cdp = (method, params = {}, sessionId) =>
      new Promise((resolve, reject) => {
        const n = ++id,
          timer = setTimeout(() => {
            pending.delete(n);
            reject(Error(`CDP timeout: ${method}`));
          }, 15000);
        pending.set(n, { resolve, reject, timer });
        child.stdio[3].write(
          JSON.stringify({ id: n, method, params, sessionId }) + "\0",
        );
      });
    let worker;
    await until(async () => {
      const candidates = (await cdp("Target.getTargets")).targetInfos.filter(
        (t) => t.type === "service_worker" && t.url.endsWith("/background.js"),
      );
      for (const candidate of candidates) {
        const { sessionId } = await cdp("Target.attachToTarget", {
          targetId: candidate.targetId,
          flatten: true,
        });
        try {
          const result = await cdp(
            "Runtime.evaluate",
            {
              expression:
                "(globalThis.browser ?? globalThis.chrome).runtime.getManifest().homepage_url === 'https://github.com/noumenonnn/numera-widget'",
              returnByValue: true,
            },
            sessionId,
          );
          if (result.result.value) {
            worker = candidate;
            return true;
          }
        } finally {
          await cdp("Target.detachFromTarget", { sessionId });
        }
      }
      return false;
    }, "Numera worker");
    const base = new URL(".", worker.url).href;
    async function tab(location) {
      const { targetId } = await cdp("Target.createTarget", { url: location });
      const { sessionId } = await cdp("Target.attachToTarget", {
        targetId,
        flatten: true,
      });
      await cdp("Runtime.enable", {}, sessionId);
      return { targetId, sessionId };
    }
    evaluate = async (tab, expression) => {
      const r = await cdp(
        "Runtime.evaluate",
        { expression, awaitPromise: true, returnByValue: true },
        tab.sessionId,
      );
      assert.ok(!r.exceptionDetails, JSON.stringify(r.exceptionDetails));
      return r.result.value;
    };
    focus = async (tab) => cdp("Page.bringToFront", {}, tab.sessionId);
    screenshot = async (name) => {
      const { data } = await cdp(
        "Page.captureScreenshot",
        { format: "png" },
        page.sessionId,
      );
      await writeFile(
        resolve(output, name + ".png"),
        Buffer.from(data, "base64"),
      );
    };
    seed = await tab(base + "seed.html");
    await until(
      () =>
        evaluate(seed, "!!(globalThis.browser ?? globalThis.chrome)?.storage"),
      "seed",
    );
    await evaluate(
      seed,
      `(globalThis.browser ?? globalThis.chrome).storage.local.set(${stateFixture})`,
    );
    page = await tab(url);
    navigate = (location) =>
      cdp("Page.navigate", { url: location }, page.sessionId);
    await cdp("ServiceWorker.enable", {}, seed.sessionId);
    stopWorker = async () => {
      let v;
      await until(async () => {
        v = events
          .flatMap((e) =>
            e.method === "ServiceWorker.workerVersionUpdated"
              ? e.params.versions
              : [],
          )
          .find(
            (v) => v.scriptURL === worker.url && v.runningStatus === "running",
          );
        return v;
      }, "worker version");
      await cdp(
        "ServiceWorker.stopWorker",
        { versionId: v.versionId },
        seed.sessionId,
      );
    };
    results.browser = await cdp("Browser.getVersion");
  } else {
    const options = new firefox.Options()
      .addArguments("-headless")
      .setBinary(
        process.env.NUMERA_FIREFOX ||
          "C:/Program Files/Mozilla Firefox/firefox.exe",
      );
    const driver = await new Builder()
      .forBrowser("firefox")
      .setFirefoxOptions(options)
      .setFirefoxService(
        new firefox.ServiceBuilder(process.env.NUMERA_GECKODRIVER).addArguments(
          "--allow-system-access",
        ),
      )
      .build();
    close = () => driver.quit();
    const zip = new JSZip();
    async function add(dir, prefix = "") {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = resolve(dir, entry.name),
          name = prefix + entry.name;
        if (entry.isDirectory()) await add(path, name + "/");
        else zip.file(name, await readFile(path));
      }
    }
    await add(extension);
    const xpi = resolve(profile, "extension.xpi");
    await writeFile(xpi, await zip.generateAsync({ type: "nodebuffer" }));
    await driver.installAddon(xpi, true);
    await driver.setContext("chrome");
    const base = await driver.executeScript(
      'return WebExtensionPolicy.getByID("numera@numera.local").getURL("")',
    );
    await driver.setContext("content");
    seed = await driver.getWindowHandle();
    await driver.get(base + "seed.html");
    evaluate = async (tab, expression) => {
      await driver.switchTo().window(tab);
      return driver
        .executeAsyncScript(
          `const done=arguments[arguments.length-1];Promise.resolve().then(()=>(${expression})).then(x=>done({value:x}),e=>done({error:String(e)}))`,
        )
        .then((r) => {
          assert.ok(!r.error, r.error);
          return r.value;
        });
    };
    await evaluate(seed, `browser.storage.local.set(${stateFixture})`);
    await driver.switchTo().newWindow("tab");
    page = await driver.getWindowHandle();
    await driver.get(url);
    navigate = (location) => driver.get(location);
    focus = (tab) => driver.switchTo().window(tab);
    screenshot = async (name) =>
      writeFile(
        resolve(output, name + ".png"),
        Buffer.from(await driver.takeScreenshot(), "base64"),
      );
    results.browser = (await driver.getCapabilities()).get("browserVersion");
  }
  await focus(page);
  await until(
    () =>
      evaluate(page, "document.readyState==='complete' && document.hasFocus()"),
    "fixture focus",
  );
  await evaluate(page, select("price"));
  await until(() => evaluate(page, visible), "dark tooltip without popup");
  await until(() => evaluate(page, `${details}?.arrowLoaded`), "local arrow");
  results.dark = await evaluate(page, details);
  assert.equal(results.dark.text, "30 USD2450.52 RUB");
  assert.equal(results.dark.height, 34);
  assert.equal(results.dark.radius, "100px");
  assert.equal(results.dark.padding, "12px");
  assert.equal(results.dark.border, "0.5px");
  assert.equal(results.dark.fontWeight, "600");
  assert.equal(results.dark.gap, "6px");
  assert.ok(results.dark.fontLoaded);
  await screenshot("dark");
  await evaluate(page, "getSelection().removeAllRanges()");
  await pause(300);
  assert.equal(
    await evaluate(
      page,
      "document.querySelector('#numera-selection-tooltip').getClientRects().length",
    ),
    0,
    "deselected tooltip must leave the rendered page, not just close popover",
  );
  await evaluate(page, select("price"));
  await until(() => evaluate(page, visible), "tooltip after reselection");
  results.scenarios.push(
    "Closed popup: exact conversion, dark Figma geometry and bundled font/icon despite hostile CSS",
  );
  async function action(value) {
    await evaluate(
      seed,
      `new Promise(resolve=>{const api=globalThis.browser??globalThis.chrome,p=api.runtime.connect({name:'selection-test'}),id=crypto.randomUUID();p.onMessage.addListener(m=>{if(m.ack===id){p.disconnect();resolve(true)}});p.postMessage({type:'action',id,action:${JSON.stringify(value)}});})`,
    );
    await focus(page);
  }
  await action({ type: "theme", theme: "light" });
  await evaluate(page, select("price"));
  await until(
    () =>
      evaluate(
        page,
        `${visible} && document.querySelector('#numera-selection-tooltip').dataset.theme==='light'`,
      ),
    "light theme",
  );
  await until(() => evaluate(page, `${details}?.arrowLoaded`), "light icon");
  results.light = await evaluate(page, details);
  await screenshot("light");
  assert.equal(results.light.color, "rgb(215, 161, 71)");
  assert.equal(results.light.background, "rgba(255, 255, 255, 0.95)");
  results.scenarios.push(
    "Light theme follows extension settings with exact Figma colors",
  );
  await evaluate(
    page,
    `(() => {
    const cover=document.createElement('aside');cover.id='stack-cover';
    cover.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;margin:0;padding:0;border:0;background:magenta;z-index:2147483647';
    document.body.append(cover);
  })()`,
  );
  const onTop = `(() => {
    const h=document.querySelector('#numera-selection-tooltip'),r=h.getBoundingClientRect();
    h.style.setProperty('pointer-events','auto','important');
    const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===h;
    h.style.setProperty('pointer-events','none','important');return top;
  })()`;
  assert.equal(
    await evaluate(page, onTop),
    true,
    "tooltip above maximum page z-index",
  );
  await evaluate(
    page,
    `(() => {document.getElementById('stack-cover').setAttribute('popover','manual'); document.getElementById('stack-cover').showPopover();})()`,
  );
  await pause(200);
  assert.equal(
    await evaluate(page, onTop),
    true,
    "tooltip above a later site popover",
  );
  await screenshot("stacking");
  await evaluate(
    page,
    `(() => {document.getElementById('stack-cover').hidePopover();document.getElementById('stack-cover').remove();})()`,
  );
  results.scenarios.push(
    "Tooltip stays above high-z-index page elements and later site popovers",
  );
  await evaluate(page, select("sale"));
  await until(() => evaluate(page, visible), "sale price inside mixed text");
  assert.equal((await evaluate(page, details)).text, "31.44 USD2568.14 RUB");
  await evaluate(page, "getSelection().removeAllRanges()");
  await pause(200);
  assert.equal(
    await evaluate(
      page,
      "document.querySelector('#numera-selection-tooltip').getClientRects().length",
    ),
    0,
  );
  results.scenarios.push(
    "Mixed sale text extracts $31.44 and deselection removes rendered tooltip",
  );
  for (const id of ["symbol", "name"]) {
    await evaluate(page, select(id));
    await until(() => evaluate(page, visible), id);
    assert.equal((await evaluate(page, details)).text, "30 USD2450.52 RUB");
  }
  for (const id of ["plain", "edit", "euro"]) {
    await evaluate(page, select(id));
    await pause(500);
    assert.equal(await evaluate(page, visible), false, id);
  }
  await evaluate(page, select("price"));
  await evaluate(page, "getSelection().removeAllRanges()");
  await pause(500);
  assert.equal(await evaluate(page, visible), false);
  results.scenarios.push(
    "Symbols and names work; plain numbers, editable fields, missing quotes and cancelled selections stay hidden",
  );
  await action({
    type: "replace",
    kind: "converter",
    rowId: "r-RUB",
    code: "USD",
  });
  await evaluate(page, select("rub"));
  await until(() => evaluate(page, visible), "changed main currency");
  assert.equal((await evaluate(page, details)).text, "81.684 RUB1 USD");
  results.scenarios.push("Main currency changes apply on the existing page");
  await evaluate(page, select("edge"));
  await until(() => evaluate(page, visible), "viewport edge");
  const edge = await evaluate(page, details);
  assert.ok(edge.x >= 8 && edge.x + edge.width <= edge.viewport[0] - 7);
  assert.ok(edge.y >= 8 && edge.y + edge.height <= edge.viewport[1] - 7);
  await evaluate(
    page,
    `document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`,
  );
  assert.equal(await evaluate(page, visible), false);
  await evaluate(page, select("price"));
  await until(() => evaluate(page, visible), "reopen");
  await evaluate(page, `document.dispatchEvent(new Event('scroll'))`);
  assert.equal(await evaluate(page, visible), false);
  results.scenarios.push("Viewport positioning, Escape and scrolling");
  if (stopWorker) {
    await stopWorker();
    await evaluate(page, select("rub"));
    await until(() => evaluate(page, visible), "worker wake");
    assert.equal((await evaluate(page, details)).text, "81.684 RUB1 USD");
    results.scenarios.push(
      "Selection wakes stopped Chrome worker and restores settings/rates",
    );
  }
  await navigate(url + "strict");
  await focus(page);
  await until(
    () =>
      evaluate(
        page,
        "document.readyState==='complete' && !!document.getElementById('rub')",
      ),
    "strict page",
  );
  await pause(400);
  await evaluate(page, select("rub"));
  await until(() => evaluate(page, visible), "strict CSP tooltip");
  await until(
    () => evaluate(page, `${details}?.arrowLoaded && ${details}?.fontLoaded`),
    "strict CSP assets",
  );
  results.scenarios.push(
    "Tooltip, font and original icon work on a page with strict CSP",
  );
  assert.equal(errors.length, 0, JSON.stringify(errors));
  await writeFile(
    resolve(output, "results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
} catch (error) {
  results.error = String(error.stack || error);
  results.errors = errors;
  if (seed && evaluate)
    console.error(
      "Seed diagnostic",
      await evaluate(
        seed,
        "({href:location.href,browser:typeof browser,chrome:typeof chrome})",
      ),
    );
  await writeFile(
    resolve(output, "failure.json"),
    JSON.stringify(results, null, 2),
  );
  throw error;
} finally {
  await close?.();
  server.close();
}
