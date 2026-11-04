# Development tooling security packages

These private packages are used only by Node development tools, never by the extension runtime:

- `deepmerge/`: MIT-licensed upstream 4.3.1 CommonJS source with a narrow prototype-poisoning patch; upstream provenance and the original hash are recorded inside the folder.
- `minimatch-compat/`: a CommonJS/ESM export bridge to the unchanged upstream minimatch 11.0.4 engine. It supports the callable entry expected by Mozilla's older ESLint/multimatch and the named exports expected by newer tools.

The matching `.tgz` files are npm installation inputs, retained next to the auditable sources. Tarballs avoid npm's incorrect parent-relative directory-link resolution for nested overrides on Windows. `package.json` uses direct file dependencies and `$spec` overrides; `package-lock.json` records archive integrity. No package is published externally.

When changing either local package, bump its version, run `npm pack ./vendor/<folder> --pack-destination vendor --ignore-scripts`, update the matching root file dependency, reinstall, then run `npm ci`, `npm ls minimatch deepmerge minimatch-modern --all`, `npm run verify`, `npm run audit:dependencies`, and the Firefox gate. The unit suite compares installed code with the checked-in source, reproduces prototype poisoning, tests glob preprocessing, and imports the actual ESLint ESM dependency in a fresh Node process.

`npm audit` does not review private local source. A clean audit is accompanied by these source tests and code review; it is not presented as proof that local code has no vulnerabilities. Replace the local deepmerge patch when a compatible upstream fix is available and verified.
