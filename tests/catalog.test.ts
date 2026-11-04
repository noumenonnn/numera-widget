import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { catalog } from "../src/catalog";
describe("catalog completeness", () => {
  it("provides unique identities, local images and source metadata", () => {
    expect(new Set(catalog.map((c) => c.id)).size).toBe(catalog.length);
    for (const c of catalog) {
      expect(c.name.en && c.name.ru && c.code && c.metadataSource).toBeTruthy();
      expect(c.name.ru.charAt(0), c.code).toBe(
        c.name.ru.charAt(0).toLocaleUpperCase("ru"),
      );
      expect(existsSync(`public/${c.icon}`), c.code).toBe(true);
      if (c.kind === "crypto") expect(c.binanceAsset).toBeTruthy();
    }
  });
});
it("offers additional supported currencies beyond the design table with local imagery", () => {
  for (const code of ["NZD", "KRW", "SGD", "MXN", "ZAR", "CHF", "PLN"]) {
    const c = catalog.find((x) => x.code === code && x.kind === "fiat");
    expect(c, code).toBeDefined();
    expect(c && existsSync(`public/${c.icon}`), code).toBe(true);
  }
});
