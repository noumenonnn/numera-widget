# Build and test scripts

Use Node.js 24.15.0 and npm 11.6.1, then run `npm ci`.

- `npm run verify`: metadata, ESLint/hooks, TypeScript, unit tests, build, extension lint.
- `npm run package`: rebuild and create the unsigned runtime ZIP in `artifacts/`.
- `npm run package:source`: create a reviewer source ZIP using an explicit file allowlist, then write checksums for both ZIPs. Run after packaging.
- `npm run audit:dependencies`: registry audit of the full dependency tree. Also review local patches in `vendor/README.md`.
- `npm run test:e2e`: rebuild/package, run Firefox fixture and UI checks, and capture the real toolbar popup. Output: ignored `reports/e2e/`.
- `npm run test:recovery`: build, create an isolated fault-injection copy, test reconnect/replay and actual permission prompts. Output: ignored `reports/recovery/`. The copy is cleaned in `finally`.
- `node scripts/snapshot-release.mjs`: record local source/build/archive hashes in ignored `reports/release.json` (create `reports/` first).
- `npm run assets:optimize`: lossless PNG optimization with decompressed pixel-data comparison.
- `python scripts/encode-sticker.py`: optional source PNG to WebP conversion with RGBA equality check; requires Pillow. Normal builds use the checked-in WebP.

Browser tests require a graphical desktop and use only their isolated WebDriver profile. `NUMERA_FIREFOX` selects a Firefox binary; `NUMERA_GECKODRIVER` selects a local geckodriver; `NUMERA_TEST_OUTPUT` changes the results directory. Without a local driver, Selenium Manager may require network access. By default, Firefox is read from the standard Windows path or `/usr/bin/firefox`.

Tests use deterministic sample rates. They do not test current market prices or every possible input device. Known lint warnings and manual coverage limits are listed in `VERIFICATION.md`.

Actions are deduplicated against the last 4096 persisted receipts. Reconnect gets a snapshot before replaying pending actions with the same IDs. Automatic connection attempts are limited to five, followed by an explicit retry control. This is a bounded replay guarantee.
