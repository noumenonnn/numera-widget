# Verification

## Release 1.0.9 results — 16 November 2026

- Node 24.15.0 / npm 11.6.1 on Windows: portable verification passes with 392 tests in 26 files, ESLint, TypeScript, both production builds, and Mozilla lint with 0 errors and 3 classified warnings.
- Full dependency audit: 0 vulnerabilities after updating the development-only node-forge dependency from 1.4.2 to 1.4.3.
- Firefox 160.0: full E2E passes with consecutive drag/reorder, a mixed fiat/crypto list, both interface languages, input precision, keyboard controls, Undo, wheel navigation, focus, and the real 380×360 toolbar popup. The 76-row keyboard input-to-rAF p95 was 16 ms in this run.
- Firefox 160.0: all three disconnect/replay phases and competing updates pass; real permission grant and denial prompts pass. The fixture revokes the HTTPS page grant as well as provider grants, because page selection now grants broad HTTPS access.
- Chrome for Testing 150.0.7871.24: all five worker/persistence/idle scenarios pass, including 65 seconds with the popup open, forced restart, and natural worker shutdown/reopen.
- Selection integration passes in Firefox 160.0 and Chrome for Testing 150.0.7871.24: both themes, local font/icon, strict page CSP, selected prices, exclusions, dismissal, positioning, changed main currency, and Chrome worker wake.
- Chrome refresh integration passes: a real refresh-button click requests fixture quotes, updates the displayed rate and last-check timestamp, handles provider failure, and completes rotation with reduced motion enabled.
- The reviewer source ZIP was extracted into a new empty directory and passed `npm ci` (0 audit vulnerabilities) and `npm run verify`. All 216 runtime files in each browser build matched the corresponding submitted ZIP byte for byte. Archive inspection confirmed matching 1.0.9 manifests, required assets, no test bridge/seed/source maps, and correct SHA-256 checksums for all three ZIPs.
- Browser checks use isolated profiles. Chrome popup checks render the extension document in a tab; the real Chrome toolbar and store review are not covered. Fixture rates do not verify live quote accuracy.

The Firefox E2E fixture now targets the unified converter, waits for reorder displacement to settle, and checks immediate keyboard removal. Chrome fixtures identify Numera's worker and accept either browser API namespace. Historical failures described below apply to the older test scripts.

## Selection tooltip checks — 4 November 2026

- 159 unit tests across 23 files pass, including explicit currency parsing, prices within surrounding sale text, exact conversion, unavailable quotes and background selection handling without a popup connection. ESLint and TypeScript pass; both builds pass; Mozilla lint reports 0 errors and the same 3 classified warnings below.
- Dismissal regression tests assert that the host has no rendered client rectangles after deselection, rather than only checking `:popover-open`. Stacking checks verify the tooltip is above a maximum-z-index fixed overlay and a site popover opened after the conversion, with screenshots in both browsers.
- `node scripts/test-selection.mjs chrome` passed on Chrome for Testing 148.0.7778.97 in an isolated headless profile. Both themes, exact fixture conversion, original local icons and Geist font, closed popup, updated main currency, exclusions, cancelled selection, viewport edges, Escape/scroll dismissal, stopped-worker recovery and strict page CSP are covered.
- `node scripts/test-selection.mjs firefox` passed on Firefox 159.0.1 using the same local fixtures in an isolated headless profile, including strict CSP. Results and theme screenshots are saved under ignored `reports/selection-firefox/`; Chrome equivalents are under `reports/selection-chrome/`.
- Figma references: file `8KOO8i6YLwn110K5TLb46G`, dark node `72:6451`, light node `72:6458`. Browser screenshots were visually compared with the supplied designs; computed 34px height, 14px/600 typography, 6px gaps, 10px corners, theme fills and orange text were checked.
- New content scripts load on HTTP(S) navigation; reload existing pages after updating. Browser-protected pages and private windows are excluded. Rate fixtures do not establish live provider availability.

Current release: 1.0.9. Dated sections below retain historical verification evidence for earlier trees; current release results are recorded separately. Historical test output and local browser profiles are excluded from Git and source/runtime archives.

## Automated checks

`npm run verify` checks matching package/manifest versions, ESLint and React hooks rules, TypeScript, the full unit suite, both browser production builds, and Mozilla extension lint. `npm run audit:dependencies` checks the complete installed dependency tree against npm advisories; locally patched tools are additionally covered by regression tests.

`npm run test:e2e` installs a freshly built ZIP in an isolated Firefox profile and exercises conversion fixtures, decimal input, keyboard controls, row operations, focus, locale, wheel behavior, UI transitions, and the real toolbar popup. Input benchmarks use an extension document in a tab and a p95 target of 50 ms; they are not a measurement of physical input-to-display latency.

`npm run test:recovery` uses a temporary test-only copy to exercise Port disconnection, replay around ACK, competing updates, and real permission grant/deny prompts. The fault bridge is never packaged in production.

## Classified extension lint warnings

- Two `UNSAFE_VAR_ASSIGNMENT` warnings in bundled React runtime in `popup.js`. Own source uses neither `innerHTML` nor `dangerouslySetInnerHTML`.
- One `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION` manifest warning. This release targets Firefox Desktop 140+, not Android.

Unexpected build or extension warnings fail verification. These known warnings still require reviewer assessment and do not guarantee AMO approval.

## Limits

Fixtures do not establish availability or accuracy of live market APIs. Manual NVDA checks, physical touch/trackpad, DPI 125/150%, toolbar overflow, and the full pointer-cancel/swipe matrix have not been completed for this release. Startup timing and sustained animation frame rate are not claimed. Desktop UI checks on macOS and Linux are not claimed. The ZIP remains unsigned until Mozilla approves/signs it.

See `scripts/README.md` to reproduce browser checks and `docs/PUBLISHING.md` for reviewer build instructions.

## Release 1.0.8 results — 4 November 2026

- Node 24.15.0 / npm 11.6.1 on Windows: `npm run verify` passed; 111 tests in 16 files, extension lint 0 errors and 3 classified warnings.
- Full dependency audit after the packaging dependency update: 0 vulnerabilities.
- Firefox Desktop 159.0.1: E2E and real toolbar popup passed; 76-row keyboard input-to-rAF p95 was 14 ms in this run.
- Firefox recovery checks passed: disconnect before send/before ACK/after ACK, competing updates, permission grant/deny.
- Runtime archive inspection confirmed the 1.0.8 manifest and absence of test fault bridge, reports, node_modules, source maps, and environment files.

Machine-generated results remain local in ignored `reports/`. The representative popup screenshot in `docs/screenshots/` uses fixed sample rates.

The reviewer source ZIP was extracted into a separate empty directory and passed `npm ci` and the full `npm run verify`. Its 114 rebuilt runtime files matched the submitted runtime ZIP byte for byte (ZIP directory entries and container timestamps excluded).

## Chrome support checks — 4 November 2026

- `npm run verify` passed: 134 tests across 22 files, Firefox and Chrome builds, Mozilla lint with 0 errors and the same 3 classified warnings.
- Chrome for Testing 153.0.8010.12: fixture conversion and persistence, settings rendering, 65 seconds of open-popup inactivity, forced worker stop/reconnect, and natural worker shutdown followed by reopen passed. The worker was detached from DevTools during idle checks. Results: ignored `reports/chrome/results.json`.
- Chromium 129.0.6668.29: the same five scenarios passed using the older `chrome.*` namespace. Results: ignored `reports/chrome-legacy/results.json`.
- Firefox 159.0.1: `npm run test:recovery` passed all three replay/ACK phases, competing updates, and actual permission grant/deny prompts after the API adapter and heartbeat change.
- The legacy `npm run test:e2e` fails at `Reorder overlaps rows or changes the dragged currency` (`scripts/test-e2e.mjs:165`). The same failure was reproduced against the unchanged HEAD in an isolated baseline copy. That script still dispatches to legacy `fiat` rows and expects the removed fiat/crypto tabs; this is a pre-existing test-maintenance limitation, not a passing regression check.

The Chrome manifest allows version 120+. The minimum version is an API/build target, not a claim that every intermediate browser version has been exercised. Chrome browser scenarios use the popup document in a tab; the real Chrome toolbar surface, Chrome permission prompt UI, and Chrome Web Store publication have not been verified. No store submission was performed.
