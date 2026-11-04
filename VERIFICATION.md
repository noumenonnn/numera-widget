# Verification

Release checks are run against the 1.0.8 source tree. Historical test output and local browser profiles are excluded from Git and source/runtime archives.

## Automated checks

`npm run verify` checks matching package/manifest versions, ESLint and React hooks rules, TypeScript, 111 tests across 16 files, the production build, and Mozilla extension lint. `npm run audit:dependencies` checks the complete installed dependency tree against npm advisories; locally patched tools are additionally covered by regression tests.

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
