# Development-only deepmerge security patch

This is upstream deepmerge 4.3.1's standalone CommonJS distribution, with its MIT license retained.
Original dist/cjs.js SHA-256: `2e5160f84a1141bd927264afe4d15766f1e6cf07daef182b37ff53fea121de7d`.

The only code change filters the string `__proto__` from both target and source keys, including nested clones. This prevents the destination object's prototype from changing when a supplied target has a null prototype or owns an enumerable `__proto__` key (GHSA-gcqx-w48m-w2h4). Enumerable symbol keys, arrayMerge, customMerge, cloning and .all retain the upstream behavior.

The package deliberately has a local scoped identity; it is not an upstream patched release. package.json overrides resolve the development-only addons-linter dependency to this checked-in source. It is never imported by the extension. tests/tooling-security.test.ts checks the vulnerability and merge compatibility; npm run verify exercises the actual Mozilla linter. Remove this override when an upstream fix is available and verified.

Advisory: https://github.com/advisories/GHSA-gcqx-w48m-w2h4
