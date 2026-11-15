# Publishing Numera 1.0.9

## Files

- `artifacts/numera-1.0.9.zip`: unsigned Firefox runtime extension, with manifest at the ZIP root.
- `artifacts/numera-1.0.9-chrome.zip`: Chrome MV3 runtime, with manifest at the ZIP root and its own `.sha256` checksum.
- `artifacts/numera-1.0.9-source.zip`: readable sources and reviewer build instructions.
- `artifacts/SHA256SUMS.txt`: checksums of all three archives.
- `docs/STORE_LISTING.md`: English and Russian listing text and metadata.
- `PRIVACY.md`: privacy policy; `docs/releases/1.0.9.md`: release notes.
- `public/icons/numera-128.png`: store icon; `assets/screenshots/Slide 1.png`, `Slide 2.png`, and `Slide 3.png`: supplied 1920×1080 promotional screenshots. Their displayed version labels and rates are illustrative.

## Reproduce the build (Mozilla reviewers)

Reference environment: Windows, Node.js 24.15.0, npm 11.6.1. CI also runs the build on Ubuntu. Use exactly these Node/npm versions for comparison. Extract the source ZIP into an empty directory, then run:

```sh
npm ci
npm run verify
npm run package
npm run package:chrome
npm run package:source
```

Compare the contents of `dist/` with the submitted runtime archive; ZIP container timestamps can differ. `npm ci` requires registry access. No account, API key, Python, or image processing tool is required for the normal build. All runtime assets are checked in. `vendor/` contains source and tarballs for local development-tool security patches; do not omit it. The extension contains bundled/minified React and other packages, so attach the matching source archive to every submitted version.

`npm run verify` allows up to two known React runtime innerHTML warnings in `popup.js` and one Desktop/Android manifest warning. Own source does not use innerHTML. See VERIFICATION.md. Browser test fixtures and fault injection are separate from the shipped build.

## AMO submission

1. Sign in to the owner's Mozilla developer account and review the Developer Agreement and add-on policies.
2. Open the existing [Numera listing](https://addons.mozilla.org/ru/firefox/addon/numera-widget/) in the developer dashboard and upload `numera-1.0.9.zip` as a new version. Keep the existing extension ID `numera@numera.local`; changing it creates a different extension identity.
3. Attach `numera-1.0.9-source.zip` and provide the build commands above.
4. Copy the listing and privacy policy, upload the icon and a current screenshot, and choose the supported desktop platforms. The current build has not been verified on macOS/Linux desktop UI or Android.
5. Review the validation messages and data declaration against actual network behavior. The manifest declares no collection of personal/telemetry data; public market requests do expose normal connection metadata. No entered amount, browsing content, or browsing history is transmitted.
6. Submit for Mozilla review/signing. After approval, distribute the signed add-on or link to its AMO page.

GitHub publication does not sign an extension or create its AMO listing. Do not rename an unsigned ZIP to XPI and claim it is permanently installable in Firefox Release.

Official references: [submission](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/), [source code requirements](https://extensionworkshop.com/documentation/publish/source-code-submission/), [data declaration](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/).

## Chrome build and submission

Run `npm ci`, `npm run verify`, then `npm run package:chrome`. Upload `artifacts/numera-1.0.9-chrome.zip` in the owner's Chrome Web Store developer account, complete the listing and privacy/permission declarations, and submit for review. The Chrome package is separate from the Firefox ZIP: its manifest uses `background.service_worker`, omits Gecko metadata, and requires Chrome 120+. The source archive includes the manifest generator and Chrome build/test scripts.

Use the English or Russian copy from `STORE_LISTING.md`, the icon, and the screenshots listed above. Explain that page access supports local conversion of selected prices, `storage` saves preferences and cached rates, and the three provider hosts supply public exchange rates. Do not claim that 1.0.9 has passed either store's review. After Chrome publication, wrap the Chrome button image in an anchor to the new listing in both READMEs; its current image intentionally has no link.

For local testing, open `chrome://extensions`, enable Developer mode, choose Load unpacked and select `dist-chrome/` (or an extracted Chrome ZIP). Packaging does not publish a listing or imply store approval.
