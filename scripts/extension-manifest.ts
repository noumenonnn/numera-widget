export function manifestForTarget(
  source: Record<string, unknown>,
  target: "firefox" | "chrome",
): Record<string, unknown> {
  const manifest = structuredClone(source);
  if (target === "chrome") {
    delete manifest.browser_specific_settings;
    manifest.minimum_chrome_version = "120";
    manifest.background = { service_worker: "background.js", type: "module" };
  }
  return manifest;
}
