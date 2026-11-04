# Publishing Numera 1.0.8

## Files

- `artifacts/numera-1.0.8.zip`: unsigned runtime extension, with manifest at the ZIP root.
- `artifacts/numera-1.0.8-source.zip`: readable sources and reviewer build instructions.
- `artifacts/SHA256SUMS.txt`: checksums of both archives.
- `docs/STORE_LISTING.md`: English and Russian listing text and metadata.
- `PRIVACY.md`: privacy policy; `docs/releases/1.0.8.md`: release notes.

## Reproduce the build (Mozilla reviewers)

Reference environment: Windows, Node.js 24.15.0, npm 11.6.1. CI also runs the build on Ubuntu. Use exactly these Node/npm versions for comparison. Extract the source ZIP into an empty directory, then run:

```sh
npm ci
npm run verify
npm run package
```

Compare the contents of `dist/` with the submitted runtime archive; ZIP container timestamps can differ. `npm ci` requires registry access. No account, API key, Python, or image processing tool is required for the normal build. All runtime assets are checked in. `vendor/` contains source and tarballs for local development-tool security patches; do not omit it. The extension contains bundled/minified React and other packages, so attach the matching source archive to every submitted version.

`npm run verify` allows up to two known React runtime innerHTML warnings in `popup.js` and one Desktop/Android manifest warning. Own source does not use innerHTML. See VERIFICATION.md. Browser test fixtures and fault injection are separate from the shipped build.

## AMO submission

1. Sign in to the owner's Mozilla developer account and review the Developer Agreement and add-on policies.
2. Submit `numera-1.0.8.zip` as a listed Firefox Desktop add-on. Keep the existing extension ID `numera@numera.local`; changing it creates a different extension identity.
3. Attach `numera-1.0.8-source.zip` and provide the build commands above.
4. Copy the listing and privacy policy, upload the icon and a current screenshot, and choose the supported desktop platforms. The current build has not been verified on macOS/Linux desktop UI or Android.
5. Review the validation messages and data declaration against actual network behavior. The manifest declares no collection of personal/telemetry data; public market requests do expose normal connection metadata. No entered amount, browsing content, or browsing history is transmitted.
6. Submit for Mozilla review/signing. After approval, distribute the signed add-on or link to its AMO page.

GitHub publication does not sign an extension or create its AMO listing. Do not rename an unsigned ZIP to XPI and claim it is permanently installable in Firefox Release.

Official references: [submission](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/), [source code requirements](https://extensionworkshop.com/documentation/publish/source-code-submission/), [data declaration](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/).
