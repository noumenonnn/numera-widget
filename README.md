<div align="center">
  <img src="public/icons/numera.png" width="96" height="96" alt="Numera logo">
  <h1>Numera</h1>
  <p>Currency and cryptocurrency conversion in your Firefox or Chrome toolbar.</p>
  <p><a href="https://github.com/noumenonnn/numera-widget/actions/workflows/ci.yml"><img src="https://github.com/noumenonnn/numera-widget/actions/workflows/ci.yml/badge.svg" alt="CI"></a> <img src="https://img.shields.io/badge/version-1.0.9-blue" alt="Version 1.0.9"> <img src="https://img.shields.io/badge/Firefox-140%2B-orange" alt="Firefox Desktop 140 or later"> <img src="https://img.shields.io/badge/Chrome-120%2B-4285F4" alt="Chrome 120 or later"></p>
  <p>
    <a href="https://addons.mozilla.org/ru/firefox/addon/numera-widget/"><img src="docs/images/firefox-addons.png" height="60" alt="Get Numera for Firefox on Mozilla Add-ons"></a>
    &nbsp;&nbsp;
    <img src="docs/images/chrome-web-store.png" height="60" alt="Chrome Web Store — coming soon" title="Chrome Web Store — coming soon">
  </p>
  <p>Available on Firefox · Chrome Web Store coming soon</p>
</div>

Numera is a compact extension for Firefox Desktop 140+ and Chrome 120+ for comparing fiat currencies and cryptocurrencies. It supports English and Russian, light and dark themes, editable currency lists, keyboard controls, and precise decimal calculations. No account or API key is required.

[Сведения на русском](docs/README.ru.md) · [Download 1.0.9](https://github.com/noumenonnn/numera-widget/releases/tag/v1.0.9) · [Privacy](PRIVACY.md) · [Changelog](CHANGELOG.md)

## Screenshots

<p align="center"><img src="assets/screenshots/Slide%201.png" width="960" alt="Numera currency converter and theme settings"></p>
<p align="center"><img src="assets/screenshots/Slide%202.png" width="960" alt="Compare multiple currencies and choose cryptocurrencies in Numera"></p>
<p align="center"><img src="assets/screenshots/Slide%203.png" width="960" alt="Convert selected prices directly on a web page with Numera"></p>

Screenshots illustrate the interface; displayed rates and version labels are examples.

## Features

- Select a price with a currency on an HTTP(S) page to convert it into the main currency from settings, even with the popup closed. The tooltip follows the extension theme. Reload existing pages after updating the extension; browser-protected pages are excluded.
- Convert amounts across several currencies at once; add, remove, and reorder rows.
- Enter country names or abbreviations in English or Russian; choose from suggested currencies when a country has multiple supported options.
- Fiat exchange rates from Frankfurter, cryptocurrency prices from Binance, and the USDT/USD bridge from Kraken.
- Decimal arithmetic with 50 significant digits and access to the full stored precision using Alt+P.
- Cached quotes, timestamps, retry handling, and a visible indication when rates are unavailable or stale.
- Local settings and amounts; no analytics, developer backend, or remote executable code.

Availability depends on each provider and region. Quotes are informational and may be delayed; they are unsuitable as trading quotes. Fiat coverage follows the available provider rates. The extension does not run in private windows.

## Install

Install Firefox from [Mozilla Add-ons](https://addons.mozilla.org/ru/firefox/addon/numera-widget/) for a signed installation and automatic store updates. Store updates follow Mozilla review, so the published version may differ from the GitHub release.

The GitHub ZIP is **unsigned**. For temporary installation in Firefox Desktop 140+:

1. Download and extract `numera-1.0.9.zip` from Releases.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on** and select the extracted `manifest.json`.
4. Open Numera from the extensions menu and pin it to the toolbar if desired.

Temporary installations end when Firefox closes. For permanent installation, use the Mozilla Add-ons button above.

For **Chrome**, download and extract `numera-1.0.9-chrome.zip` from [Releases](https://github.com/noumenonnn/numera-widget/releases/tag/v1.0.9), open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the extracted directory. Pin Numera to the toolbar. This installation persists while the directory remains available. The Chrome Web Store listing is not yet published; the store button has no link yet. To build locally, use `npm ci` and `npm run build:chrome`, then select `dist-chrome/`.

## Build and verify

Use Node.js **24.15.0** and npm **11.6.1** (see `.nvmrc` and `package.json`).

```sh
npm ci
npm run verify
npm run package
npm run package:chrome
npm run package:source
```

The Firefox runtime build is in `dist/`; Chrome is in `dist-chrome/`. Upload `artifacts/numera-1.0.9.zip` as an update to the existing AMO listing and attach `artifacts/numera-1.0.9-source.zip` as source code. Upload `artifacts/numera-1.0.9-chrome.zip` to Chrome Web Store. The source archive includes local tooling patches and the lockfile; `artifacts/SHA256SUMS.txt` covers all three archives. See [reviewer instructions](docs/PUBLISHING.md).

`npm run verify` checks metadata, ESLint, TypeScript, unit tests, both production builds, and Mozilla extension lint. Firefox output remains in `dist/`; Chrome output is separate in `dist-chrome/`. [Browser tests](scripts/README.md) use isolated profiles. CI runs the portable checks and packages both browser artifacts; browser checks are separate. [Verification scope and known warnings](VERIFICATION.md).

## Controls

Enter an amount in a row to recalculate the others. A single `.` or `,` is the decimal separator; use spaces for digit grouping. Currency codes and catalog aliases are also accepted. Press Alt+P in an input before editing to expose full precision. On a focused currency card, Alt+Up/Down reorders it and Delete removes it; the first row is pinned. Removed rows can be restored with Undo.

## Project structure

| Path | Purpose |
| --- | --- |
| `src/` | React UI, decimal conversion, provider access, state and messaging |
| `public/` | Manifest, locales, catalog, packaged images and licenses |
| `tests/` | Unit and regression tests |
| `scripts/` | Build helpers, packaging and Firefox tests |
| `vendor/` | Auditable patches for development dependencies |
| `assets/source/` | Original currency artwork |
| `assets/screenshots/` | Extension screenshots for the repository and stores |
| `docs/` | Store descriptions, publication instructions and release notes |

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Report sensitive vulnerabilities using the process in [SECURITY.md](SECURITY.md). Please omit personal data from logs and screenshots.

## Rights and third-party software

Numera's original code and documentation are available under the [MIT License](LICENSE). The Numera name, logo, extension icons, and brand artwork are excluded; use, copying, modification, or redistribution requires prior written permission from the relevant rights holder. Third-party licenses and attribution are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and shipped in `public/licenses/`.
