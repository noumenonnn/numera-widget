# Development-only CommonJS entry bridge

Older ESLint and multimatch call `require('minimatch')` as a function or use its `.Minimatch`, `.match`, `.filter`, `.defaults`, and `.braceExpand` properties. Minimatch 11 exports that callable (with those properties) as `.minimatch` inside a namespace object. This bridge exports the upstream callable directly, without copying or modifying the matcher.

The engine is pinned to minimatch 11.0.4, which includes the GHSA-g3hv-75wg-m249 preprocessing fix. The package has its own local identity and does not pretend to be an upstream minimatch 3 release. The alias name prevents an override cycle. The root override serves both old callable clients and modern namespace clients; `.minimatch` references the same callable.

Compatibility is tested for the APIs and patterns used by this project's tooling. This is not a claim that all historical glob semantics are identical across majors. The source lint, Mozilla extension lint and archive inventory checks must pass when changing the bridge or engine. No code from this package is bundled in the extension.

The checked-in tarball is installed instead of a directory link, so npm's nested override resolution is portable. On changes, bump this package version, run `npm pack ./vendor/minimatch-compat --pack-destination vendor --ignore-scripts`, update the root file dependency, and reinstall. The unit gate compares the installed entry with the checked-in source.

Advisory: https://github.com/advisories/GHSA-g3hv-75wg-m249
