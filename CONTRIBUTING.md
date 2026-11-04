# Contributing

Use Node.js 24.15.0 and npm 11.6.1. Install with `npm ci`; run `npm run verify` before proposing a change. Run the Firefox scenarios described in `scripts/README.md` when changing UI, transport, storage, or permissions.

Open an issue with a concise reproduction, expected behavior, Firefox version, and operating system. Keep changes focused and explain how they were checked. Do not commit credentials, browser profiles, generated builds, reports, or user data. The source archive must include any files needed to reproduce the build, including `vendor/` tarballs and their sources.

Dependency security overrides are documented in `vendor/README.md`. Update their source and archive together and run the tooling regression tests. Use `npm run audit:dependencies` to check the dependency tree against the registry.

This repository does not currently grant a general open-source license for its own code or artwork. Discuss reuse or licensing with the owner before relying on it in another project.
