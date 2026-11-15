// The APIs used here support promises in Chrome MV3. Older Chrome versions
// expose them only as chrome.*, while Firefox also implements chrome.*.
export const extensionApi: typeof browser =
  globalThis.browser ??
  (globalThis as typeof globalThis & { chrome: typeof browser }).chrome;
