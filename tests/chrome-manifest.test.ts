import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { manifestForTarget } from "../scripts/extension-manifest";

const source = JSON.parse(readFileSync("public/manifest.json", "utf8"));

it("builds a Chrome MV3 manifest with only supported background keys", () => {
  const manifest = manifestForTarget(source, "chrome");
  expect(manifest.background).toEqual({
    service_worker: "background.js",
    type: "module",
  });
  expect(manifest.minimum_chrome_version).toBe("120");
  expect(manifest).not.toHaveProperty("browser_specific_settings");
  expect(manifest.permissions).toEqual(source.permissions);
  expect(manifest.host_permissions).toEqual(source.host_permissions);
  expect(manifest.action).toEqual(source.action);
  expect(manifest.version).toBe(source.version);
});

it("preserves Firefox metadata and never mutates the shared manifest", () => {
  const before = structuredClone(source);
  manifestForTarget(source, "chrome");
  expect(source).toEqual(before);
  expect(manifestForTarget(source, "firefox")).toEqual(before);
});
