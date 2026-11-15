import { Builder, By, Key, until } from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";
import Decimal from "decimal.js";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
const output = resolve(process.env.NUMERA_TEST_OUTPUT || "reports/e2e");
await (await import("node:fs/promises")).mkdir(output, { recursive: true });
const d = await new Builder()
  .forBrowser("firefox")
  .setFirefoxOptions(
    new firefox.Options()
      .setBinary(
        process.env.NUMERA_FIREFOX ||
          (process.platform === "win32"
            ? "C:/Program Files/Mozilla Firefox/firefox.exe"
            : "/usr/bin/firefox"),
      )
      .setPreference("ui.prefersReducedMotion", 0),
  )
  .setFirefoxService(
    new firefox.ServiceBuilder(process.env.NUMERA_GECKODRIVER).addArguments(
      "--allow-system-access",
    ),
  )
  .build();
const results = {
  generatedAt: new Date().toISOString(),
  notes: [
    "Isolated WebDriver profile; deterministic rates seeded through extension storage before the first popup connection.",
    "DOM/input benchmarks use an extension document in a tab; a real toolbar popup is checked separately.",
  ],
};
const wait = async (ms) => new Promise((r) => setTimeout(r, ms));
const revision = () =>
  d.executeAsyncScript(
    'const done=arguments[arguments.length-1];browser.storage.local.get("stateRevision").then(x=>done(x.stateRevision||0))',
  );
const dispatch = (actions) =>
  d.executeAsyncScript(
    `const actions=arguments[0],done=arguments[arguments.length-1],p=browser.runtime.connect({name:'audit'});let acks=0;p.onMessage.addListener(m=>{if(m.ack&&++acks===actions.length){p.disconnect();done(acks)}});actions.forEach(action=>p.postMessage({type:'action',id:crypto.randomUUID(),action}));`,
    actions,
  );
try {
  const capabilities = await d.getCapabilities();
  results.browser = capabilities.get("browserVersion");
  const manifest = JSON.parse(await readFile("public/manifest.json", "utf8"));
  results.archiveSha256 = createHash("sha256")
    .update(await readFile(resolve(`artifacts/numera-${manifest.version}.zip`)))
    .digest("hex");
  await d.installAddon(
    resolve(`artifacts/numera-${manifest.version}.zip`),
    true,
  );
  await d.setContext("chrome");
  const base = await d.executeScript(
    'return WebExtensionPolicy.getByID("numera@numera.local").getURL("")',
  );
  await d.setContext("content");
  await d.switchTo().window((await d.getAllWindowHandles())[0]);
  await d.get(base + "_locales/en/messages.json");
  const cat = JSON.parse(
    await readFile("public/currency-catalog.json", "utf8"),
  ).currencies;
  const now = Date.now();
  const fixture = {
    fx: Object.fromEntries(
      cat
        .filter((c) => c.kind === "fiat")
        .map((c, i) => [
          c.code,
          {
            rate:
              c.code === "USD"
                ? "1"
                : c.code === "RUB"
                  ? "100"
                  : c.code === "EUR"
                    ? "0.8"
                    : String(i + 1),
            date: "2026-11-03",
            fetchedAt: now,
          },
        ]),
    ),
    crypto: { USDT: "1", BTC: "50000", ETH: "2500" },
    cryptoAt: now,
    cryptoFetchedAt: { USDT: now, BTC: now, ETH: now },
    q: "0.99",
    qAt: now,
    fxAt: now,
  };
  const state = {
    locale: "en",
    theme: "dark",
    tab: "fiat",
    fiat: {
      rows: [
        { rowId: "audit-RUB", code: "RUB" },
        { rowId: "audit-USD", code: "USD" },
      ],
      anchor: { code: "RUB", amount: "1" },
      expanded: false,
    },
    crypto: {
      rows: [
        { rowId: "audit-BTC", code: "BTC" },
        { rowId: "audit-USDT", code: "USDT" },
      ],
      anchor: { code: "BTC", amount: "1" },
      expanded: false,
    },
  };
  state.converter = structuredClone(state.fiat);
  await d.executeAsyncScript(
    "const done=arguments[arguments.length-1];browser.storage.local.set(arguments[0]).then(()=>done(true),e=>done(String(e)))",
    {
      state,
      stateRevision: 1,
      rates: fixture,
      policies: {},
      exchange: { at: now, pairs: ["BTCUSDT", "ETHUSDT"], verified: true },
    },
  );
  await d.get(base + "popup.html");
  await d.wait(until.elementLocated(By.css("input[data-input]")), 10000);
  await wait(300);
  // Consecutive drags must retain row identity and settle into the committed order.
  await dispatch(
    ["EUR", "GBP"].map((code) => ({
      type: "add",
      kind: "converter",
      row: { rowId: "audit-" + code, code },
    })),
  );
  await wait(250);
  const rowGeometry = () =>
    d.executeScript(
      "return [...document.querySelectorAll('.card')].map(c=>{const r=c.getBoundingClientRect();return {code:c.querySelector('.currency span').textContent,x:r.left+8,y:r.top+40,top:r.top}})",
    );
  const slots = await rowGeometry();
  for (const [from, to, expected] of [
    [3, 1, ["RUB", "GBP", "USD", "EUR"]],
    [1, 3, ["RUB", "USD", "EUR", "GBP"]],
  ]) {
    await d
      .actions({ async: true })
      .move({ x: Math.round(slots[from].x), y: Math.round(slots[from].y) })
      .press()
      .move({
        x: Math.round(slots[to].x),
        y: Math.round(slots[to].y),
        duration: 200,
      })
      .perform();
    await d.actions({ async: true }).release().perform();
    // The committed order is immediate; CSS displacement settles after release.
    await d.wait(
      async () => {
        const dropped = await rowGeometry();
        return (
          dropped.length === expected.length &&
          dropped.every(
            (row, i) =>
              row.code === expected[i] && Math.abs(row.top - slots[i].top) <= 3,
          )
        );
      },
      2000,
      "Reorder did not settle into non-overlapping rows",
    );
  }
  results.consecutiveDrag = { pass: true };
  // Fiat and crypto share one converter; inserting crypto must retain fiat rows.
  await dispatch([
    {
      type: "add",
      kind: "converter",
      row: { rowId: "audit-BTC", code: "BTC" },
    },
  ]);
  await d.wait(
    () =>
      d.executeScript("return document.querySelectorAll('.card').length===5"),
    5000,
  );
  results.mixedCurrencies = await d.executeScript(
    "return [...document.querySelectorAll('.currency span')].map(node=>node.textContent)",
  );
  if (
    JSON.stringify(results.mixedCurrencies) !==
    JSON.stringify(["RUB", "USD", "EUR", "GBP", "BTC"])
  )
    throw Error("Unified converter did not retain fiat and crypto rows");
  await dispatch([{ type: "remove", kind: "converter", rowId: "audit-BTC" }]);
  await wait(250);
  await dispatch(
    ["EUR", "GBP"].map((code) => ({
      type: "remove",
      kind: "converter",
      rowId: "audit-" + code,
    })),
  );
  await wait(250);
  results.languageAndFocus = await d.executeScript(
    'let e=document.querySelector("input[data-input]");return {htmlLang:document.documentElement.lang,inputOutline:getComputedStyle(e).outline,inputBorder:getComputedStyle(e).border}',
  );
  await d.executeScript(
    `window.auditViewFrames=[];window.auditTrackViews=true;const start=performance.now();function sample(){const node=document.querySelector('.surface');window.auditViewFrames.push({page:node?(node.querySelector('#settings-heading')?'settings':'main'):'blank',opacity:node?Number(getComputedStyle(node).opacity):0});if(window.auditTrackViews&&performance.now()-start<1500)requestAnimationFrame(sample)}requestAnimationFrame(sample)`,
  );
  await d.findElement(By.css(".settings")).click();
  await d.wait(until.elementLocated(By.css("#settings-heading")), 5000);
  await wait(250);
  results.viewTransition = await d.executeScript(
    "window.auditTrackViews=false;return window.auditViewFrames",
  );
  if (
    results.viewTransition.some((frame) => frame.opacity < 0.99) ||
    !results.viewTransition.some((frame) => frame.page === "settings")
  )
    throw Error("Page transition flashes an empty or transparent surface");
  await d.findElement(By.xpath("//button[normalize-space()='RU']")).click();
  await d.wait(
    () => d.executeScript("return document.documentElement.lang==='ru'"),
    5000,
  );
  results.localeSwitch = {
    ru: await d.executeScript("return document.documentElement.lang"),
  };
  await d.findElement(By.css(".settings-header .icon")).click();
  await d.wait(until.elementLocated(By.css("#converter-heading")), 5000);
  if (
    (await d.findElement(By.css("#converter-heading")).getText()) !==
    "Конвертер валют"
  )
    throw Error("Converter heading is not translated into Russian");
  await d.findElement(By.css(".settings")).click();
  await d.wait(until.elementLocated(By.css("#settings-heading")), 5000);
  await d.findElement(By.xpath("//button[normalize-space()='EN']")).click();
  await d.wait(
    () => d.executeScript("return document.documentElement.lang==='en'"),
    5000,
  );
  results.localeSwitch.en = await d.executeScript(
    "return document.documentElement.lang",
  );
  await d.findElement(By.css(".settings-header .icon")).click();
  await d.wait(until.elementLocated(By.css("input[data-input]")), 5000);
  await wait(250);
  let input = await d.findElement(By.css("input[data-input]"));
  await input.click();
  await input.sendKeys(Key.chord(Key.CONTROL, "a"));
  await input.sendKeys("12");
  await wait(200);
  const before = await revision();
  await input.sendKeys(Key.ENTER);
  await wait(200);
  const after = await revision();
  results.enterDuplicateSaves = { before, after, delta: after - before };
  // A label should activate its associated input. The card captures/prevents mouse down.
  await d.findElement(By.css(".quantity label")).click();
  results.labelClick = await d.executeScript(
    "return {activeTag:document.activeElement.tagName,activeInput:document.activeElement.dataset.input||null}",
  );
  await input.click();
  await input.sendKeys(Key.chord(Key.CONTROL, "a"));
  await input.sendKeys("1..2");
  await d.findElement(By.css(".currency")).click();
  await d.wait(until.elementLocated(By.css("[role=combobox]")), 5000);
  await wait(250);
  await d.findElement(By.css("[role=combobox]")).sendKeys("EUR", Key.ENTER);
  await d.wait(until.elementLocated(By.css("input[data-input]")), 5000);
  await wait(300);
  results.staleDraftAfterReplacement = await d.executeScript(
    'let i=document.querySelector("input[data-input]");return {code:document.querySelector(".currency span").textContent,value:i.value,invalid:i.getAttribute("aria-invalid")}',
  );
  input = await d.findElement(By.css("input[data-input]"));
  await input.click();
  await input.sendKeys(Key.ESCAPE);
  await dispatch([
    {
      type: "add",
      kind: "converter",
      row: { rowId: "audit-CNY", code: "CNY" },
    },
  ]);
  await wait(250);
  const cards = await d.findElements(By.css(".card"));
  await d.executeScript(
    `const node=document.querySelectorAll('.card-wrap')[2],start=performance.now();window.auditDeleteFrames=[];function sample(){window.auditDeleteFrames.push({connected:node.isConnected,opacity:Number(getComputedStyle(node).opacity)});if(node.isConnected&&performance.now()-start<1500)requestAnimationFrame(sample)}requestAnimationFrame(sample)`,
  );
  await cards[2].sendKeys(Key.DELETE);
  await wait(350);
  results.deleteTransition = await d.executeScript(
    "return window.auditDeleteFrames",
  );
  // Keyboard removal is intentionally immediate; pointer removal may animate.
  if (!results.deleteTransition.some((frame) => !frame.connected))
    throw Error("Deleted row remained mounted");
  results.focusAfterDelete = await d.executeScript(
    'return {tag:document.activeElement.tagName,focusId:document.activeElement.dataset.focusId||null,input:document.activeElement.dataset.input||null,rows:document.querySelectorAll(".card").length}',
  );
  const toast = await d.findElement(By.css(".toast span"));
  await d.actions({ async: true }).move({ origin: toast }).click().perform();
  results.toastHover = {
    hoverBefore: await d.executeScript(
      'return document.querySelector(".toast")?.matches(":hover")',
    ),
  };
  await wait(6400);
  results.toastHover.existsAfter6400Ms = await d.executeScript(
    'return !!document.querySelector(".toast")',
  );
  await d.findElement(By.css(".toast button")).click();
  await d.wait(
    () =>
      d.executeScript(
        "return document.activeElement.dataset.input==='audit-CNY'",
      ),
    5000,
  );
  results.focusAfterUndo = await d.executeScript(
    "return document.activeElement.dataset.input",
  );
  await dispatch([{ type: "remove", kind: "converter", rowId: "audit-CNY" }]);
  await wait(250);
  await d.findElement(By.css(".currency")).click();
  await d.wait(until.elementLocated(By.css("[role=combobox]")), 5000);
  await wait(250);
  await d.findElement(By.css("[role=combobox]")).sendKeys(Key.TAB);
  results.optionEnter = await d.executeScript(
    'return {focused:document.activeElement.id,active:document.querySelector("[role=combobox]").getAttribute("aria-activedescendant")}',
  );
  await d.actions({ async: true }).sendKeys(Key.ENTER).perform();
  await wait(350);
  results.optionEnter.chosenCode = await d.executeScript(
    'return document.querySelector(".currency span")?.textContent',
  );
  // Benchmarks: single input events separated by a frame; includes React updates and receipt of ACKs.
  results.inputBenchmarks = [];
  for (const size of [2, 10, 76]) {
    const present = await d.executeScript(
      'return Array.from(document.querySelectorAll(".currency span"),e=>e.textContent)',
    );
    const extras = cat
      .filter((c) => c.kind === "fiat" && !present.includes(c.code))
      .slice(0, size - present.length);
    if (extras.length)
      await dispatch(
        extras.map((c) => ({
          type: "add",
          kind: "converter",
          row: { rowId: "audit-" + c.code, code: c.code },
        })),
      );
    await wait(350);
    await d.executeScript('document.querySelector(".scroll").scrollTop=0');
    input = await d.findElement(By.css("input[data-input]"));
    await input.click();
    const samples = await d.executeAsyncScript(
      `const done=arguments[arguments.length-1],e=document.querySelector('input[data-input]'),setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set,values=[];let n=0;const step=()=>{const start=performance.now();setter.call(e,String(1000+n));e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));requestAnimationFrame(()=>{values.push(performance.now()-start);if(++n<25)setTimeout(step,20);else done(values)})};step();`,
    );
    await input.sendKeys(Key.chord(Key.CONTROL, "a"));
    await d.executeScript(
      'window.auditKeys=[];let e=document.querySelector("input[data-input]");if(!e.auditListener){e.auditListener=true;e.addEventListener("input",event=>{const start=performance.now();requestAnimationFrame(()=>window.auditKeys.push({ms:performance.now()-start,trusted:event.isTrusted}))})}',
    );
    await d.executeScript(
      `window.auditDispatch=[];if(!window.auditDispatchInstalled){window.auditDispatchInstalled=true;document.addEventListener('input',()=>{window.auditEventStart=performance.now()},true);window.addEventListener('input',event=>window.auditDispatch.push({ms:performance.now()-window.auditEventStart,trusted:event.isTrusted}))}`,
    );
    await input.sendKeys("1234567890123456789012345");
    await wait(250);
    const trusted = await d.executeScript("return window.auditKeys");
    const displayed = await d.executeScript(
      `const cards=[...document.querySelectorAll('.card')];return {anchor:cards[0].querySelector('.currency span').textContent, usd:cards.find(card=>card.querySelector('.currency span').textContent==='USD').querySelector('input').value}`,
    );
    const rateParts = fixture.fx[displayed.anchor].rate.split(".");
    const numerator = BigInt(rateParts.join(""));
    const scale = 10n ** BigInt(rateParts[1]?.length || 0);
    const exact = BigInt("1234567890123456789012345") * scale;
    const expected = ((exact * 2n + numerator) / (numerator * 2n))
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    if (displayed.usd !== expected)
      throw Error(
        `Stale derived output: ${displayed.usd}, expected ${expected}`,
      );

    const sorted = [...samples].sort((a, b) => a - b);
    results.inputBenchmarks.push({
      rows: size,
      samples: 25,
      meanMs: samples.reduce((a, b) => a + b, 0) / samples.length,
      p95Ms: sorted[Math.ceil(0.95 * samples.length) - 1],
      maxMs: Math.max(...samples),
      raw: samples,
      domElements: await d.executeScript(
        'return document.querySelectorAll("*").length',
      ),
      trustedKeySamples: trusted,
      dispatchSamples: await d.executeScript("return window.auditDispatch"),
      finalValue: await input.getAttribute("value"),
    });
    await input.sendKeys(Key.ENTER);
  }
  // Updating an exact value can leave the rounded display unchanged. A cached
  // inactive input must still read the newest full precision value on focus.
  Decimal.set({ precision: 50, toExpNeg: -20, toExpPos: 50 });
  const anchorRow = await input.getAttribute("data-input");
  const anchorCode = await d.executeScript(
    "return document.querySelector('.currency span').textContent",
  );
  await dispatch([
    {
      type: "input",
      kind: "converter",
      rowId: anchorRow,
      code: anchorCode,
      amount: "1.000000001",
    },
  ]);
  await wait(150);
  const usdInput = await d.findElement(
    By.css('.card:has(.currency span) input[data-input="audit-USD"]'),
  );
  const roundedBefore = await usdInput.getAttribute("value");
  await dispatch([
    {
      type: "input",
      kind: "converter",
      rowId: anchorRow,
      code: anchorCode,
      amount: "1.000000002",
    },
  ]);
  await wait(150);
  const roundedAfter = await usdInput.getAttribute("value");
  await usdInput.click();
  await usdInput.sendKeys(Key.chord(Key.ALT, "p"));
  const precise = await usdInput.getAttribute("value");
  const expectedPrecision = new Decimal("1.000000002")
    .div(fixture.fx[anchorCode].rate)
    .toString();
  if (roundedBefore !== roundedAfter || precise !== expectedPrecision)
    throw Error(
      `Cached input precision: ${JSON.stringify({ roundedBefore, roundedAfter, precise, expectedPrecision })}`,
    );
  results.cachedInputPrecision = {
    roundedBefore,
    roundedAfter,
    precise,
    expectedPrecision,
    pass: true,
  };
  await usdInput.sendKeys(Key.ESCAPE);
  results.offscreenFocus = await d.executeAsyncScript(
    `const done=arguments[arguments.length-1],inputs=document.querySelectorAll('input[data-input]'),last=inputs[inputs.length-1];last.focus();requestAnimationFrame(()=>{const r=last.getBoundingClientRect();done({focused:document.activeElement===last,top:r.top,bottom:r.bottom,viewport:innerHeight,scroll:document.querySelector('.scroll').scrollTop})})`,
  );
  if (
    !results.offscreenFocus.focused ||
    results.offscreenFocus.bottom > results.offscreenFocus.viewport
  )
    throw Error("Offscreen input did not become visible on focus");
  const lastCard = await d.findElement(By.css(".card-wrap:last-child .card"));
  const movedId = await d.executeScript(
    "const card=document.querySelector('.card-wrap:last-child .card');card.focus();return card.querySelector('input').dataset.input",
  );
  await lastCard.sendKeys(Key.chord(Key.ALT, Key.ARROW_UP));
  await d.wait(
    () =>
      d.executeScript(
        "const inputs=document.querySelectorAll('input[data-input]');return inputs[inputs.length-2].dataset.input===arguments[0]",
        movedId,
      ),
    5000,
  );
  await lastCard.sendKeys(Key.chord(Key.ALT, Key.ARROW_DOWN));
  await d.wait(
    () =>
      d.executeScript(
        "return document.querySelector('.card-wrap:last-child input').dataset.input===arguments[0]",
        movedId,
      ),
    5000,
  );
  results.offscreenKeyboardReorder = { rowId: movedId, pass: true };
  // Small scroll input vs a full-notch input currently both move by exactly one row.
  await d.findElement(By.css(".currency")).click();
  await d.wait(until.elementLocated(By.css(".wheel")), 5000);
  await wait(250);
  const wheelStart = await d
    .findElement(By.css("[role=combobox]"))
    .getAttribute("aria-activedescendant");
  const wheelCodes = await d.executeScript(
    "return [...document.querySelectorAll('[role=option]')].map(node=>node.id.replace('option-',''))",
  );
  const wheelStartIndex = wheelCodes.indexOf(wheelStart.replace("option-", ""));
  await d.executeScript(
    `document.querySelector('.wheel').dispatchEvent(new WheelEvent('wheel',{bubbles:true,deltaY:100,deltaMode:0}))`,
  );
  await wait(250);
  const wheelNext = await d
    .findElement(By.css("[role=combobox]"))
    .getAttribute("aria-activedescendant");
  if (
    wheelNext !==
    "option-" + wheelCodes[(wheelStartIndex + 1) % wheelCodes.length]
  )
    throw Error("One mouse notch skipped a currency");
  await d.executeScript(
    `document.querySelector('.wheel').dispatchEvent(new WheelEvent('wheel',{bubbles:true,deltaY:-100,deltaMode:0}))`,
  );
  await wait(250);
  if (
    (await d
      .findElement(By.css("[role=combobox]"))
      .getAttribute("aria-activedescendant")) !== wheelStart
  )
    throw Error("Reverse mouse notch did not return to the previous currency");
  results.wheelSingleStep = { before: wheelStart, next: wheelNext, pass: true };
  results.wheelDelta = await d.executeScript(
    'let w=document.querySelector(".wheel"),c=document.querySelector("[role=combobox]");let before=c.getAttribute("aria-activedescendant");w.dispatchEvent(new WheelEvent("wheel",{bubbles:true,deltaY:1,deltaMode:0}));return {before}',
  );
  await wait(80);
  results.wheelDelta.afterOnePixel = await d.executeScript(
    'return document.querySelector("[role=combobox]").getAttribute("aria-activedescendant")',
  );
  await d.findElement(By.css("[role=combobox]")).sendKeys(Key.ESCAPE);
  await wait(300);
  // Restore a small main screen before checking the actual toolbar surface.
  await dispatch(
    cat
      .filter((c) => c.kind === "fiat" && !["EUR", "USD"].includes(c.code))
      .map((c) => ({
        type: "remove",
        kind: "converter",
        rowId: "audit-" + c.code,
      })),
  );
  await d.setContext("chrome");
  await d.executeScript(
    'document.getElementById("unified-extensions-button").click()',
  );
  await d.wait(
    () =>
      d.executeScript(
        'return !!document.getElementById("numera_numera_local-BAP")',
      ),
    10000,
  );
  await d.executeScript(
    'document.getElementById("numera_numera_local-BAP").click();document.getElementById("customizationui-widget-panel").setAttribute("noautohide","true")',
  );
  await d.wait(
    () =>
      d.executeScript(
        'return !!document.querySelector("browser.webextension-popup-browser")?.browsingContext?.currentWindowGlobal',
      ),
    10000,
  );
  await wait(600);
  results.toolbar = await d.executeScript(
    'let b=document.querySelector("browser.webextension-popup-browser"),r=b.getBoundingClientRect();return {url:b.currentURI.spec,width:r.width,height:r.height}',
  );
  const png = await d.executeAsyncScript(
    'const done=arguments[arguments.length-1],b=document.querySelector("browser.webextension-popup-browser");b.browsingContext.currentWindowGlobal.drawSnapshot(null,1,"rgb(255,255,255)").then(x=>{let c=document.createElementNS("http://www.w3.org/1999/xhtml","canvas");c.width=x.width;c.height=x.height;c.getContext("2d").drawImage(x,0,0);done(c.toDataURL("image/png"))})',
  );
  await writeFile(
    resolve(output, "toolbar-popup.png"),
    png.split(",")[1],
    "base64",
  );
  const assert = (value, message) => {
    if (!value) throw Error(message);
  };
  assert(
    results.enterDuplicateSaves.delta === 0,
    "Enter must not write unchanged data",
  );
  assert(results.labelClick.activeTag === "INPUT", "Label must focus input");
  assert(
    results.staleDraftAfterReplacement.invalid === "false",
    "Replacement must clear invalid draft",
  );
  assert(
    results.staleDraftAfterReplacement.value !== "1..2",
    "Replacement must clear old draft",
  );
  assert(results.focusAfterDelete.tag !== "BODY", "Delete must preserve focus");
  assert(results.toastHover.existsAfter6400Ms, "Hover must pause toast");
  assert(
    results.wheelDelta.before === results.wheelDelta.afterOnePixel,
    "One pixel must not move Wheel",
  );
  assert(
    results.languageAndFocus.htmlLang === "en",
    "Document locale must match state",
  );
  assert(
    results.focusAfterUndo === "audit-CNY",
    "Undo must focus restored row",
  );
  results.keyboardBudgets = results.inputBenchmarks.map((benchmark) => {
    const values = benchmark.trustedKeySamples
      .map((sample) => sample.ms)
      .sort((a, b) => a - b);
    const p95 = values[Math.ceil(0.95 * values.length) - 1];
    return { rows: benchmark.rows, p95, targetMs: 50, pass: p95 <= 50 };
  });
  assert(
    results.keyboardBudgets.find((budget) => budget.rows === 10).pass,
    "10-row keyboard budget exceeded",
  );
  assert(
    results.keyboardBudgets.find((budget) => budget.rows === 76).pass,
    "76-row keyboard budget exceeded",
  );
  console.log(JSON.stringify(results, null, 2));
} catch (e) {
  results.error = String(e.stack || e);
  console.error(results.error);
  process.exitCode = 1;
} finally {
  await writeFile(
    resolve(output, "firefox-results.json"),
    JSON.stringify(results, null, 2),
  );
  await d.quit();
}
