import { afterEach, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());

it("uses the native Firefox API when both namespaces exist", async () => {
  const firefox = { runtime: { id: "firefox" } };
  vi.stubGlobal("browser", firefox);
  vi.stubGlobal("chrome", { runtime: { id: "chrome" } });
  vi.resetModules();
  const { extensionApi } = await import("../src/browser-api");
  expect(extensionApi).toBe(firefox);
});

it("uses Chrome's API when the browser namespace is absent", async () => {
  const chrome = { runtime: { id: "chrome" } };
  vi.stubGlobal("browser", undefined);
  vi.stubGlobal("chrome", chrome);
  vi.resetModules();
  const { extensionApi } = await import("../src/browser-api");
  expect(extensionApi).toBe(chrome);
});
