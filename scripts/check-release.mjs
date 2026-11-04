import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const manifest = JSON.parse(await readFile("public/manifest.json", "utf8"));
assert.equal(
  pkg.version,
  manifest.version,
  "package/manifest version mismatch",
);
assert.ok(
  Number(process.versions.node.split(".")[0]) >= 24,
  "Node 24+ required",
);
console.log(`Release ${pkg.version}: metadata OK`);
