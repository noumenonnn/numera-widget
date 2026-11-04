import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
it("does not permit private windows while state is shared and persistent", () => {
  const manifest = JSON.parse(readFileSync("public/manifest.json", "utf8"));
  expect(manifest.incognito).toBe("not_allowed");
});
