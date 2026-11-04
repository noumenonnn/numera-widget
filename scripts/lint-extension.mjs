import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const result = spawnSync(
  process.execPath,
  [
    "node_modules/web-ext/bin/web-ext.js",
    "lint",
    "--source-dir",
    "dist",
    "--output",
    "json",
  ],
  { encoding: "utf8" },
);
assert.equal(result.status, 0, result.stderr || result.stdout);
const report = JSON.parse(result.stdout);
assert.equal(report.summary.errors, 0, JSON.stringify(report.errors));
assert.equal(report.summary.notices, 0, JSON.stringify(report.notices));
const allowed = new Map([
  [
    "KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION|manifest.json|Manifest key not supported by the specified minimum Firefox for Android version",
    1,
  ],
  ["UNSAFE_VAR_ASSIGNMENT|popup.js|Unsafe assignment to innerHTML", 2],
]);
for (const warning of report.warnings) {
  const key = `${warning.code}|${warning.file}|${warning.message}`;
  const remaining = allowed.get(key) || 0;
  assert.ok(
    remaining > 0,
    `Unexpected extension warning: ${JSON.stringify(warning)}`,
  );
  allowed.set(key, remaining - 1);
}
console.log(
  `Extension lint: 0 errors; ${report.warnings.length} classified warnings (see VERIFICATION.md).`,
);
