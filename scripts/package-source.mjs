import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import JSZip from "jszip";

// Explicit allowlist: never include Git history, credentials, profiles, or reports.
const roots = [
  "src",
  "public",
  "tests",
  "scripts",
  "vendor",
  "assets",
  "docs",
  ".github",
  "package.json",
  "package-lock.json",
  "popup.html",
  "tsconfig.json",
  "vite.config.ts",
  "eslint.config.js",
  ".nvmrc",
  ".gitattributes",
  ".gitignore",
  "README.md",
  "PRIVACY.md",
  "THIRD_PARTY_NOTICES.md",
  "VERIFICATION.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CHANGELOG.md",
  "LICENSE",
];
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const manifest = JSON.parse(await readFile("public/manifest.json", "utf8"));
assert.equal(pkg.version, manifest.version);
const zip = new JSZip();
const fixedDate = new Date("2000-01-01T00:00:00Z");
async function add(path) {
  const { lstat } = await import("node:fs/promises");
  const info = await lstat(path);
  assert.ok(!info.isSymbolicLink(), `Refusing symlink: ${path}`);
  if (info.isDirectory()) {
    for (const name of (await readdir(path)).sort())
      await add(`${path}/${name}`);
  } else {
    zip.file(path, await readFile(path), { date: fixedDate });
  }
}
for (const root of roots) await add(root);
await mkdir("artifacts", { recursive: true });
const runtime = `artifacts/numera-${pkg.version}.zip`;
const source = `artifacts/numera-${pkg.version}-source.zip`;
// Check the matching runtime exists before emitting a source submission.
const runtimeBytes = await readFile(runtime);
await writeFile(
  source,
  await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  }),
);
const digest = (data) => createHash("sha256").update(data).digest("hex");
await writeFile(
  "artifacts/SHA256SUMS.txt",
  [
    `${digest(runtimeBytes)}  numera-${pkg.version}.zip`,
    `${digest(await readFile(source))}  numera-${pkg.version}-source.zip`,
    "",
  ].join("\n"),
);
console.log(`Created ${source} and artifacts/SHA256SUMS.txt`);
