import { createHash } from "node:crypto";
import { readFile, readdir, writeFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
const hash = (data) => createHash("sha256").update(data).digest("hex");
async function inventory(roots) {
  const result = {};
  async function visit(path) {
    if ((await stat(path)).isDirectory()) {
      for (const name of (await readdir(path)).sort())
        await visit(`${path}/${name}`);
    } else {
      const bytes = await readFile(path);
      result[path] = { bytes: bytes.length, sha256: hash(bytes) };
    }
  }
  for (const root of roots) await visit(root);
  return result;
}
const source = await inventory([
  "src",
  "tests",
  "scripts",
  "public",
  "assets",
  "vendor",
  "package.json",
  "package-lock.json",
  "vite.config.ts",
  "tsconfig.json",
  "popup.html",
  "eslint.config.js",
  "README.md",
  "VERIFICATION.md",
  "THIRD_PARTY_NOTICES.md",
]);
const build = await inventory(["dist"]);
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const archive = `artifacts/numera-${pkg.version}.zip`;
const report = {
  generatedAt: new Date().toISOString(),
  baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  uncommittedChanges: execFileSync("git", ["status", "--porcelain"], {
    encoding: "utf8",
  }).trim(),
  node: process.version,
  npm: (process.platform === "win32"
    ? execFileSync(
        process.execPath,
        [
          process.env.npm_execpath ||
            resolve(
              dirname(process.execPath),
              "node_modules/npm/bin/npm-cli.js",
            ),
          "--version",
        ],
        { encoding: "utf8" },
      )
    : execFileSync("npm", ["--version"], { encoding: "utf8" })
  ).trim(),
  version: pkg.version,
  sourceSha256: hash(JSON.stringify(source)),
  source,
  build,
  buildBytes: Object.values(build).reduce(
    (total, file) => total + file.bytes,
    0,
  ),
  archive,
  archiveSha256: hash(await readFile(archive)),
};
const output = process.argv[2] || "reports/release.json";
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(
  `Saved ${resolve(output)}; ${Object.keys(build).length} build files, ${report.buildBytes} bytes`,
);
