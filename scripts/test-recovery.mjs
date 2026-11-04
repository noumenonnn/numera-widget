import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { resolve, dirname, basename } from "node:path";
import { spawnSync } from "node:child_process";
import { Builder, By, until } from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";
import { createHash } from "node:crypto";
const output = resolve(
  process.env.NUMERA_TEST_OUTPUT ||
    "reports/recovery",
);
await mkdir(output, { recursive: true });
await mkdir(".test-tools", { recursive: true });
const temporary = await mkdtemp(resolve(".test-tools/recovery-"));
try {
  await cp("dist", `${temporary}/extension`, { recursive: true });
  await cp(
    "scripts/fixtures/fault-bridge.js",
    `${temporary}/extension/fault-bridge.js`,
  );
  const html = await readFile(`${temporary}/extension/popup.html`, "utf8");
  await writeFile(
    `${temporary}/extension/popup.html`,
    html.replace("<head>", '<head><script src="fault-bridge.js"></script>'),
  );
  const packaged = spawnSync(
    process.execPath,
    [
      "node_modules/web-ext/bin/web-ext.js",
      "build",
      "--source-dir",
      `${temporary}/extension`,
      "--artifacts-dir",
      `${temporary}/archive`,
    ],
    { encoding: "utf8" },
  );
  assert.equal(packaged.status, 0, packaged.stderr || packaged.stdout);
  const manifest = JSON.parse(await readFile("public/manifest.json", "utf8"));
  const d = await new Builder()
    .forBrowser("firefox")
    .setFirefoxOptions(
      new firefox.Options().setBinary(
        process.env.NUMERA_FIREFOX ||
          (process.platform === "win32"
            ? "C:/Program Files/Mozilla Firefox/firefox.exe"
            : "/usr/bin/firefox"),
      ),
    )
    .setFirefoxService(
      new firefox.ServiceBuilder(process.env.NUMERA_GECKODRIVER).addArguments(
        "--allow-system-access",
      ),
    )
    .build();
  const result = {
    sourcePopupSha256: createHash("sha256")
      .update(await readFile(`${temporary}/extension/popup.js`))
      .digest("hex"),
    generatedAt: new Date().toISOString(),
    fixtureArchive: temporary,
    scenarios: [],
  };
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const storage = () =>
    d.executeAsyncScript(
      'const done=arguments[arguments.length-1];browser.storage.local.get(["state","stateRevision","actionReceipts"]).then(done)',
    );
  const dispatch = (action) =>
    d.executeAsyncScript(
      `const done=arguments[arguments.length-1],action=arguments[0],p=browser.runtime.connect({name:'recovery-control'}),id=crypto.randomUUID();p.onMessage.addListener(m=>{if(m.type==='state'&&!m.ack)p.postMessage({type:'action',id,action});if(m.ack===id){p.disconnect();done(m)}})`,
      action,
    );
  try {
    result.browser = (await d.getCapabilities()).get("browserVersion");
    await d.installAddon(
      resolve(`${temporary}/archive/numera-${manifest.version}.zip`),
      true,
    );
    await d.setContext("chrome");
    const base = await d.executeScript(
      'return WebExtensionPolicy.getByID("numera@numera.local").getURL("")',
    );
    await d.setContext("content");
    await d.switchTo().window((await d.getAllWindowHandles())[0]);
    await d.get(`${base}_locales/en/messages.json`);
    const now = Date.now();
    const state = {
      locale: "en",
      theme: "dark",
      tab: "fiat",
      fiat: {
        rows: [
          { rowId: "r-RUB", code: "RUB" },
          { rowId: "r-USD", code: "USD" },
        ],
        anchor: { code: "RUB", amount: "1" },
        expanded: false,
      },
      crypto: {
        rows: [
          { rowId: "r-BTC", code: "BTC" },
          { rowId: "r-USDT", code: "USDT" },
        ],
        anchor: { code: "BTC", amount: "1" },
        expanded: false,
      },
    };
    await d.executeAsyncScript(
      "const done=arguments[arguments.length-1];browser.storage.local.set(arguments[0]).then(()=>done(true))",
      {
        state,
        stateRevision: 1,
        rates: {
          fx: {
            USD: { rate: "1", date: "" },
            RUB: { rate: "100", date: "2026-11-03", fetchedAt: now },
          },
          crypto: { BTC: "50000", USDT: "1" },
          fxAt: now,
          cryptoAt: now,
          q: "0.99",
          qAt: now,
        },
        policies: {},
      },
    );
    await d.get(`${base}popup.html`);
    await d.wait(until.elementLocated(By.css(".settings")), 10000);
    await pause(250);
    await d.findElement(By.css(".settings")).click();
    await d.wait(until.elementLocated(By.css("#settings-heading")), 5000);
    await pause(250);
    for (const phase of ["before-send", "before-ack", "after-ack"]) {
      await dispatch({ type: "theme", theme: "dark" });
      await d.wait(
        () =>
          d.executeScript(
            'return document.querySelector(".app").dataset.theme==="dark"',
          ),
        5000,
      );
      const before = await storage(),
        connections = await d.executeScript(
          "return window.numeraFault.connections",
        );
      await d.executeScript(
        "Object.assign(window.numeraFault,{phase:arguments[0],events:[],peerAction:arguments[0]==='before-ack'?{type:'theme',theme:'system'}:null})",
        phase,
      );
      await d.findElement(By.css('button[aria-label="Light"]')).click();
      const expected = phase === "before-ack" ? "system" : "light";
      await d.wait(
        async () =>
          (await storage()).state.theme === expected &&
          (await d.executeScript(
            "return window.numeraFault.connections>arguments[0]",
            connections,
          )),
        10000,
      );
      await pause(400);
      const after = await storage(),
        events = await d.executeScript("return window.numeraFault.events");
      const id = events.find((event) => event.type === phase)?.id;
      assert.ok(id, `Injection did not run: ${phase}`);
      assert.equal(after.state.theme, expected);
      assert.equal(
        after.stateRevision - before.stateRevision,
        phase === "before-ack" ? 2 : 1,
        `${phase}: replay applied twice`,
      );
      assert.equal(
        after.actionReceipts.filter((item) => item === id).length,
        1,
      );
      assert.equal(
        await d.executeScript(
          'return document.querySelector(".app").dataset.theme',
        ),
        expected,
      );
      result.scenarios.push({
        phase,
        expected,
        revisionDelta: after.stateRevision - before.stateRevision,
        events,
        pass: true,
      });
    }
    await d.findElement(By.css(".settings-header .icon")).click();
    await d.wait(until.elementLocated(By.css("input[data-input]")), 5000);
    await pause(250);
    const origin = "https://api.frankfurter.dev/*";
    const removed = await d.executeAsyncScript(
      "const done=arguments[arguments.length-1];browser.permissions.remove({origins:[arguments[0]]}).then(done,e=>done({error:String(e)}))",
      origin,
    );
    result.permission = { removed };
    assert.equal(removed, true, "Could not revoke host permission");
    await d.wait(
      () =>
        d.executeScript(
          'return document.querySelector(".network")?.textContent.includes("permission is missing")',
        ),
      10000,
    );
    await d.findElement(By.css(".network button")).click();
    await pause(400);
    const contains = () =>
      d.executeAsyncScript(
        "const done=arguments[arguments.length-1];browser.permissions.contains({origins:[arguments[0]]}).then(done)",
        origin,
      );
    if (!(await contains())) {
      await d.setContext("chrome");
      result.permission.prompt = await d.executeScript(
        "const p=PopupNotifications.panel,n=p.querySelector('popupnotification');return {state:p.state,id:n?.id,button:n?.button?.label,secondary:n?.secondaryButton?.label}",
      );
      assert.ok(
        /Allow|Разрешить/.test(result.permission.prompt.button || ""),
        JSON.stringify(result.permission.prompt),
      );
      await d.executeScript(
        "PopupNotifications.panel.querySelector('popupnotification').button.click()",
      );
      await d.setContext("content");
    }
    await d.wait(contains, 10000);
    result.permission.restored = true;
    await d.executeAsyncScript(
      "const done=arguments[arguments.length-1];browser.permissions.remove({origins:[arguments[0]]}).then(done)",
      origin,
    );
    await d.wait(
      () =>
        d.executeScript(
          'return document.querySelector(".network")?.textContent.includes("permission is missing")',
        ),
      10000,
    );
    await d.findElement(By.css(".network button")).click();
    await pause(400);
    await d.setContext("chrome");
    await d.wait(
      () =>
        d.executeScript(
          "return !!PopupNotifications.panel.querySelector('popupnotification')?.secondaryButton",
        ),
      5000,
    );
    await d.executeScript(
      "PopupNotifications.panel.querySelector('popupnotification').secondaryButton.click()",
    );
    await d.setContext("content");
    await pause(500);
    assert.equal(
      await contains(),
      false,
      "Denied permission was silently restored",
    );
    assert.ok(
      await d.executeScript(
        'return document.querySelector(".network")?.textContent.includes("permission is missing")',
      ),
    );
    result.permission.deniedRemainsMissing = true;
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    try {
      result.debug = {
        storage: await storage(),
        control: await d.executeScript("return window.numeraFault"),
      };
    } catch {
      /* context may have closed */
    }
    result.error = String(error.stack || error);
    console.error(result.error);
    process.exitCode = 1;
  } finally {
    try {
      await writeFile(`${output}/results.json`, JSON.stringify(result, null, 2));
    } finally {
      await d.quit();
    }
  }
} finally {
  if (
    dirname(temporary) !== resolve(".test-tools") ||
    !basename(temporary).startsWith("recovery-")
  )
    throw new Error("Unexpected recovery fixture path; refusing cleanup");
  await rm(temporary, { recursive: true, force: true });
}
