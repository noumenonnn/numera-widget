# Build and test scripts

- After `npm run build:chrome`, run `node scripts/test-refresh.mjs` with `NUMERA_CHROME` set to Chrome for Testing. It checks a real popup click with reduced motion enabled, provider calls using deterministic test responses, changed quotes and rotation start/stop. `NUMERA_TEST_OUTPUT` overrides the default `reports/refresh/` output/profile directory.

Selection tooltip integration checks (build both targets first): `node scripts/test-selection.mjs chrome` and `node scripts/test-selection.mjs firefox`. Chrome requires `NUMERA_CHROME`; Firefox accepts `NUMERA_FIREFOX` and `NUMERA_GECKODRIVER`. Tests use fresh profiles, deterministic local rates and a localhost page; screenshots and results are written to `reports/selection-{chrome,firefox}/`. Scenarios cover both themes, closed popup, main-currency changes, symbols/names, exclusions, viewport edges and Chrome worker restart.

Use Node.js 24.15.0 and npm 11.6.1, then run `npm ci`.

- `npm run verify`: metadata, ESLint/hooks, TypeScript, unit tests, build, extension lint.
- `npm run package`: rebuild and create the unsigned runtime ZIP in `artifacts/`.
- `npm run build:chrome`: build the Chrome MV3 module worker and popup in `dist-chrome/`. The default Firefox build remains in `dist/`.
- `npm run package:chrome`: build and create `artifacts/numera-1.0.9-chrome.zip` and its `.sha256` file. This does not publish to the Chrome Web Store.
- `npm run package:source`: create a reviewer source ZIP using an explicit file allowlist, then write checksums for all three ZIPs. Run after packaging both browsers.
- `npm run audit:dependencies`: registry audit of the full dependency tree. Also review local patches in `vendor/README.md`.
- `npm run test:e2e`: rebuild/package, run Firefox fixture and UI checks, and capture the real toolbar popup. Output: ignored `reports/e2e/`.
- `npm run test:recovery`: build, create an isolated fault-injection copy, test reconnect/replay and actual permission prompts. Output: ignored `reports/recovery/`. The copy is cleaned in `finally`.
- `npm run test:chrome`: build and run fixture conversion, settings, a 65-second open-popup idle check, forced worker termination/reconnection, and natural worker shutdown/reopen in an isolated headless Chromium profile. Output: ignored `reports/chrome/`. Set `NUMERA_CHROME` to a Chromium or Chrome for Testing executable. The script uses Node's built-in CDP pipe transport; no driver or additional package is needed. Chrome-branded stable builds do not accept the command-line extension loading flag; manual installation in regular Chrome uses `chrome://extensions`.
- `node scripts/snapshot-release.mjs`: record local source/build/archive hashes in ignored `reports/release.json` (create `reports/` first).
- `npm run assets:optimize`: lossless PNG optimization with decompressed pixel-data comparison.

Browser tests require a graphical desktop and use only their isolated WebDriver profile. `NUMERA_FIREFOX` selects a Firefox binary; `NUMERA_GECKODRIVER` selects a local geckodriver; `NUMERA_TEST_OUTPUT` changes the results directory. Without a local driver, Selenium Manager may require network access. By default, Firefox is read from the standard Windows path or `/usr/bin/firefox`.

Tests use deterministic sample rates. They do not test current market prices or every possible input device. Known lint warnings and manual coverage limits are listed in `VERIFICATION.md`.

Actions are deduplicated against the last 4096 persisted receipts. Reconnect gets a snapshot before replaying pending actions with the same IDs. Automatic connection attempts are limited to five, followed by an explicit retry control. This is a bounded replay guarantee.

For Chrome tests in PowerShell:

```powershell
$env:NUMERA_CHROME = 'C:\path\to\chrome-for-testing\chrome.exe'
npm run test:chrome
```

The Chrome test copies the build and adds a test-only seed document; the production build and ZIP contain no seed page. DNS is disabled in that isolated browser so fixture checks do not use live provider quotes. Profiles are retained under ignored `.test-tools/chrome-*/` for diagnostics. The worker is detached from DevTools during idle checks. These checks render the popup document in a tab, not the real Chrome toolbar popup.

While mounted, the popup sends a heartbeat every 20 seconds so Chrome does not terminate its worker while a rate-refresh timer is pending. Heartbeats stop on disconnect or unmount. With no popup, the worker may sleep; storage, cached quotes, retry policies and action receipts are restored on the next connection.
