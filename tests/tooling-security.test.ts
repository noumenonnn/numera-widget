import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

const require = createRequire(import.meta.url);
const fromWebExt = createRequire(require.resolve("web-ext"));
const fromLinter = createRequire(fromWebExt.resolve("addons-linter"));
// Git normalizes checked-in text to LF; npm tarballs retain their original EOLs.
// Compare every source character except that platform-only representation.
const readSource = (path: string | URL) =>
  readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const merge = fromLinter("deepmerge") as (
  target: unknown,
  source: unknown,
  options?: Record<string, unknown>,
) => Record<string, unknown>;

it("runs the checked-in security packages rather than an unpatched nested copy", () => {
  expect(readSource(fromLinter.resolve("deepmerge"))).toBe(
    readSource(
      new URL("../vendor/deepmerge/index.cjs", import.meta.url),
    ),
  );
  expect(readSource(require.resolve("minimatch"))).toBe(
    readSource(
      new URL("../vendor/minimatch-compat/index.cjs", import.meta.url),
    ),
  );
});

it("supports native ESM named imports used by the real ESLint config-array", () => {
  expect(() =>
    execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        "await import('@eslint/config-array'); const { Minimatch, minimatch } = await import('minimatch'); if (!new Minimatch('*.js').match('a.js') || !minimatch('a.js','*.js')) process.exit(1)",
      ],
      { stdio: "pipe" },
    ),
  ).not.toThrow();
});

it("uses the fixed glob engine behind the legacy CommonJS callable API", () => {
  const mm = require("minimatch");
  expect(typeof mm).toBe("function");
  expect(mm.minimatch).toBe(mm);
  expect(typeof mm.Minimatch.prototype.firstPhasePreProcess).toBe("function");
  expect(mm("src/main.tsx", "**/*.{ts,tsx}")).toBe(true);
  expect(
    mm.match(["popup.js", "manifest.json", ".hidden"], "**/*", { dot: true }),
  ).toEqual(["popup.js", "manifest.json", ".hidden"]);
  expect(["a.js", "a.css"].filter(mm.filter("*.js"))).toEqual(["a.js"]);
  expect(mm.defaults({ dot: true })(".hidden", "*")).toBe(true);
  expect(
    mm.defaults({ dot: true }).defaults({ nocase: true })(".HIDDEN", ".hidden"),
  ).toBe(true);
  expect(new mm.Minimatch("**/*.js").match("src/popup.js")).toBe(true);
  expect(mm.braceExpand("{a,b}.js")).toEqual(["a.js", "b.js"]);
  for (const depth of [2, 6, 20]) {
    const matcher = new mm.Minimatch("**/../".repeat(depth) + "x", {
      optimizationLevel: 2,
    });
    expect(matcher.globParts.length).toBeLessThanOrEqual(64);
  }
});

it("does not poison returned merge objects through null-prototype sources or targets", () => {
  const poison = JSON.parse('{"__proto__":{"injected":true},"safe":{"n":2}}');
  for (const [target, source] of [
    [Object.create(null), poison],
    [poison, {}],
    [{ nested: Object.create(null) }, { nested: poison }],
  ]) {
    const result = merge(target, source);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(result.injected).toBeUndefined();
    expect(Object.hasOwn(result, "__proto__")).toBe(false);
    if (result.nested)
      expect(Object.getPrototypeOf(result.nested)).toBe(Object.prototype);
  }
  expect(({} as Record<string, unknown>).injected).toBeUndefined();
});

it("preserves nested cloning, arrayMerge and customMerge used by tooling", () => {
  const target = { nested: { a: 1 }, list: [1, 2] };
  expect(
    merge(
      target,
      { nested: { b: 2 }, list: [2, 3] },
      {
        arrayMerge: (a: unknown[], b: unknown[]) => [...new Set([...a, ...b])],
      },
    ),
  ).toEqual({ nested: { a: 1, b: 2 }, list: [1, 2, 3] });
  const source = { nested: { b: 2 } };
  const result = merge(target, source);
  expect(result.nested).not.toBe(source.nested);
  expect(target).toEqual({ nested: { a: 1 }, list: [1, 2] });
  expect(
    merge(
      { count: { n: 1 } },
      { count: { n: 2 } },
      { customMerge: () => () => ({ n: 3 }) },
    ).count,
  ).toEqual({ n: 3 });
});
