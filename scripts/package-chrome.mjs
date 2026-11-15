import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import JSZip from "jszip";

const pkg = JSON.parse(await readFile("package.json", "utf8"));
const manifest = JSON.parse(
  await readFile("dist-chrome/manifest.json", "utf8"),
);
assert.equal(manifest.version, pkg.version);
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.background, {
  service_worker: "background.js",
  type: "module",
});
assert.ok(!manifest.browser_specific_settings);
const zip = new JSZip();
const fixedDate = new Date("2000-01-01T00:00:00Z");
async function add(relative = "") {
  const path = `dist-chrome/${relative}`;
  const info = await lstat(path);
  assert.ok(!info.isSymbolicLink(), `Refusing symlink: ${path}`);
  if (info.isDirectory()) {
    for (const name of (await readdir(path)).sort())
      await add(relative ? `${relative}/${name}` : name);
  } else {
    zip.file(relative, await readFile(path), { date: fixedDate });
  }
}
await add();
for (const path of ["popup.html", "popup.js", "background.js"])
  assert.ok(zip.file(path), `Missing entry: ${path}`);
await mkdir("artifacts", { recursive: true });
const name = `numera-${pkg.version}-chrome.zip`;
const bytes = await zip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
  compressionOptions: { level: 9 },
});
await writeFile(`artifacts/${name}`, bytes);
await writeFile(
  `artifacts/${name}.sha256`,
  `${createHash("sha256").update(bytes).digest("hex")}  ${name}\n`,
);
console.log(`Created artifacts/${name}`);
