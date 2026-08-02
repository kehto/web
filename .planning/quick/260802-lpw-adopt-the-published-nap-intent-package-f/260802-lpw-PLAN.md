---
phase: quick-260802-lpw
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [QUICK-260802-LPW]
files_modified:
  - apps/playground/package.json
  - apps/playground/napplets/ble-demo/package.json
  - apps/playground/napplets/bot/package.json
  - apps/playground/napplets/chat/package.json
  - apps/playground/napplets/common-demo/package.json
  - apps/playground/napplets/composer/package.json
  - apps/playground/napplets/cvm-relatr/package.json
  - apps/playground/napplets/feed/package.json
  - apps/playground/napplets/link-demo/package.json
  - apps/playground/napplets/lists-demo/package.json
  - apps/playground/napplets/preferences/package.json
  - apps/playground/napplets/profile-viewer/package.json
  - apps/playground/napplets/resource-demo/package.json
  - apps/playground/napplets/serial-demo/package.json
  - apps/playground/napplets/toaster/package.json
  - apps/playground/napplets/webrtc-demo/package.json
  - packages/shell/package.json
  - tests/fixtures/napplets/nap-identity/package.json
  - tests/fixtures/napplets/nap-inc/package.json
  - tests/fixtures/napplets/nap-notify/package.json
  - tests/fixtures/napplets/nap-relay/package.json
  - tests/fixtures/napplets/nap-storage/package.json
  - tests/fixtures/napplets/nap-theme/package.json
  - pnpm-lock.yaml
  - tests/unit/published-napplet-contract.test.ts
  - tests/unit/napplet-package-alignment.test.ts
  - tests/unit/sdk-migration-guard.test.ts
  - tests/unit/playground-gateway-guard.test.ts
  - RUNTIME-SPEC.md
  - apps/playground/README.md
  - apps/playground/napplets/resource-demo/src/main.ts
  - docs/how-tos/paja-getting-started.md
  - docs/how-tos/paja-local-authoring.md
  - docs/packages/paja.md
  - docs/packages/playground.md
  - docs/packages/shell.md
  - docs/policies/NIP-5D-CONFORMANCE.md
  - docs/policies/SHELL-RESOURCE-POLICY.md
  - packages/acl/README.md
  - packages/firewall/README.md
  - packages/paja/README.md
  - packages/runtime/README.md
  - packages/services/README.md
  - packages/shell/README.md
  - tests/fixtures/napplets/README.md
must_haves:
  truths:
    - "Every active exact-pin playground and fixture consumer resolves @napplet/core 0.31.1, @napplet/nap 0.31.2, @napplet/shim 0.29.2, @napplet/sdk 0.27.2, and @napplet/vite-plugin 0.14.1 where that dependency already applies."
    - "The frozen lock has one coherent official Napplet matrix for active consumers, including @napplet/nap's ^0.31.1 core dependency, with no retained snapshots from the superseded 0.31.0/0.29.0/0.27.0/0.14.0 exact matrix."
    - "Direct npm SRI and JSR manifest-checksum evidence proves the six audited packages are immutable official sandwichfarm/napplet artifacts with no postinstall hook."
    - "The installed contract guard proves intent.invoke.result requires id plus structured result and the published Vite plugin accepts an archetype role slug independent from the convention URI archetype token."
    - "Kehto's existing >=0.31.0 <0.32.0 npm peer/development ranges and ^0.31.0 JSR mappings remain unchanged because they already admit these patches; no public Kehto runtime, export, peer, or JSR metadata changes, so no changeset is added."
    - "No Kehto host parser, manifest parser, shared Vite wrapper validation, or protocol behavior owned by kehto/web#229 changes on this branch."
    - "The protected untracked .planning/debug/jsr-release-scope-auth.md remains unmodified and unstaged, all release gates including AI-slop 100/100 pass, and the pushed branch has an open green PR at the exact local head."
  artifacts:
    - path: "pnpm-lock.yaml"
      provides: "Frozen resolution of the complete published Napplet patch matrix"
      contains: "'@napplet/nap@0.31.2'"
    - path: "tests/unit/napplet-package-alignment.test.ts"
      provides: "Dynamic active-manifest, lock-importer, snapshot, installed-metadata, public-range, and JSR-map alignment guard"
      contains: "'@napplet/core': '0.31.1'"
    - path: "tests/unit/published-napplet-contract.test.ts"
      provides: "Exact upstream provenance and installed NAP-INTENT/Vite package behavior guard"
      contains: "3037200c932488f14f7f369b8583c39c9c16510a"
    - path: "RUNTIME-SPEC.md"
      provides: "Current published package matrix and NAP-INTENT package-fix provenance"
      contains: "0.31.2"
    - path: "packages/shell/package.json"
      provides: "Development-only exact shim adoption while preserving the public peer window"
      contains: "\"@napplet/shim\": \"0.29.2\""
  key_links:
    - from: "all active package.json exact pins"
      to: "pnpm-lock.yaml"
      via: "pnpm install --lockfile-only followed by frozen materialization"
      pattern: "version: 0\\.(31\\.[12]|29\\.2|27\\.2|14\\.1)"
    - from: "tests/unit/napplet-package-alignment.test.ts"
      to: "active manifests, public package ranges, JSR maps, lock importers, and node_modules/.pnpm metadata"
      via: "dynamic repository discovery and exact expected matrix"
      pattern: "PACKAGE_VERSIONS"
    - from: "tests/unit/published-napplet-contract.test.ts"
      to: "installed @napplet/nap and @napplet/vite-plugin artifacts"
      via: "generated pnpm package paths plus declaration/distribution inspection"
      pattern: "IntentInvokeResultMessage"
    - from: "active package guidance"
      to: "upstream NAP-INTENT and package release"
      via: "NAP authority 5ac0490, source PR #199, and Version Packages PR #198 refs"
      pattern: "5ac0490461ca6fec2f0d2e45b4835cf9bc08de24"
    - from: "local branch HEAD"
      to: "GitHub pull request headRefOid"
      via: "explicit-path commits, push, gh pr create/view/checks"
      pattern: "headRefOid"
---

# Quick Task 260802-lpw: Adopt the published NAP-INTENT package fixes

<objective>
Adopt the official package artifacts produced after napplet/web#199 throughout
Kehto's exact-pin consumers, frozen dependency graph, active static guards, and
current package guidance, then ship the fully verified package-adoption PR.

Purpose: Kehto must consume the released NAP-INTENT fixes—orthogonal archetype
roles/conventions and required structured invoke results—without duplicating
the Kehto-local host-parser repair already isolated in kehto/web#229.

Output: A coherent published Napplet patch matrix, regression evidence, synced
active documentation, an explicit no-changeset decision, atomic commits, and an
open green PR from `chore/bump-napplet-intent-packages`.
</objective>

<execution_context>
@/Users/sandwich/.codex/gsd-core/workflows/execute-plan.md
@/Users/sandwich/.codex/gsd-core/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@.planning/STATE.md
@.planning/PROJECT.md
@.planning/quick/260728-pub-update-kehto-compatibility-for-current-n/SUMMARY.md
@tests/unit/napplet-package-alignment.test.ts
@tests/unit/published-napplet-contract.test.ts
@tests/unit/sdk-migration-guard.test.ts
@tests/unit/playground-gateway-guard.test.ts
@pnpm-lock.yaml

Protocol and release inputs:

- `napplet/naps` master commit `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`, `naps/NAP-INTENT.md`, is already checked authority: archetype and convention are orthogonal N:M dimensions, and `intent.invoke.result` requires a structured result.
- napplet/web#199 source commit `3037200c932488f14f7f369b8583c39c9c16510a`, merged as `b3f0007867eac109fa4917fac9c285d3b7cc6155`.
- Version Packages PR napplet/web#198 head `a79e7f4638f70f4557d4183faee9348847bb8cc7`, merged as release source `dc1d24153c759152b6ba31a6ec9bea967798f2df`.
- Kehto/web#229 remains the separate host-parser branch. Its parser, shared Vite validation, tests, changeset, and semantic documentation are not implementation scope here.

This is a dependency/configuration and installed-contract task. It creates no
new production interface.
</context>

## Package legitimacy audit

All packages are existing official dependencies or a registry-only audit target;
none is a newly introduced package. Discovery verified `git+https://github.com/sandwichfarm/napplet.git`, the matching `packages/<name>` directory, and no `postinstall` for every row.

| Package | Target | npm SRI | JSR `/jsr.json` checksum | Status |
|---|---:|---|---|---|
| `@napplet/core` | `0.31.1` | `sha512-+bwkrQbJ+EHeGzgZqiKKlXNfaSSDboMEujf155Pltru3y8LTHvUL4nu4vyoxvO5cexIqm2qgPUgmB0yrPpVA9g==` | `sha256-8105d15b988cd67e148ad164a906dc879664ec1f224717692658aa0bea33a1bd` | VERIFIED |
| `@napplet/nap` | `0.31.2` | `sha512-o07TkB/h+JP3nrF69DLdvhmYKarjgZ7vDz22GZaFgPzxjvEizrAa88KBG1mjbLsuutmTj7VJz69xJHkoBFHZcQ==` | `sha256-439a42c451fefdc6bc34b585ff41892890a9afbc83a38b3bf9a7c96d486255bf` | VERIFIED |
| `@napplet/shim` | `0.29.2` | `sha512-g8tsoEOlA6mqjwfj8wldE4+uhb15+IKOs52sU/C/nyDESG2QId7tfKACBVGFkxBJgjjvl4TOQuLrQWEwzDKB4Q==` | `sha256-a57ff0d655f059db8595239e474b9d44eb575b6bcd906d216abd702578840edb` | VERIFIED |
| `@napplet/sdk` | `0.27.2` | `sha512-/5j2SrAc+mNoEFCGeRE+vZtCmzCZE6tvcWCXi2sokVKedvcl8Pj+2/+xwlJY5qWrkYwK/v7d49jThyr2xypH4w==` | `sha256-4e400490d65214411a4ea0fc4a20d61b2ea44ddb83318b6fd71c68684651f694` | VERIFIED |
| `@napplet/vite-plugin` | `0.14.1` | `sha512-WIs5CP9+lWOOuuItlO39tjvlWxuFJmb1xLyXcuM6BlV9LTmbO2bAkU1mXcz9G0mPSRQnxzTRf4RckP9J0O6Yug==` | `sha256-82b8274d5ffa8f7a39591328a73b3a95e4b1207a1a7215b9bb9377fb1e06c9ae` | VERIFIED |
| `@napplet/conformance` | `0.16.2` | `sha512-Km/UNz4t6td3Rnpx04kJhQ7fetsl45Wx9OaOVUmgO/Fx5e+Qwgxi4kBp8uGDgZT1WcJ711XbC2ssps3pODi/mg==` | `sha256-0bc8284e803a8ef6a9b4bd87df2776b511b5e6bb8668a3042c4bed7465f75ede` | VERIFIED, registry-only |

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Prove the immutable release and run one real intent consumer slice on it</name>
  <precondition>npm, JSR, and GitHub metadata for the exact refs and versions in the Package legitimacy audit remain publicly readable.</precondition>
  <files>apps/playground/package.json, apps/playground/napplets/feed/package.json, apps/playground/napplets/profile-viewer/package.json, pnpm-lock.yaml, tests/unit/published-napplet-contract.test.ts</files>
  <behavior>
    - "The six audited npm versions expose the recorded SRI, official repository directory, and no postinstall; their JSR version manifests expose the recorded /jsr.json checksum."
    - "The installed @napplet/nap declaration makes IntentInvokeResultMessage.result required and structured rather than permitting an error-only completion."
    - "The installed @napplet/vite-plugin distribution accepts a role slug whose convention uses another archetype token while continuing to require a queryless napplet:<archetype>/<intent> URI."
    - "The playground host, feed invoker, and profile-viewer target build against core 0.31.1, nap 0.31.2, shim 0.29.2, sdk 0.27.2, and vite-plugin 0.14.1 as applicable."
  </behavior>
  <action>
    Before changing manifests, re-query each exact npm artifact for version,
    `dist.integrity`, tarball, repository URL/directory, dependency metadata,
    and absence of `scripts.postinstall`; re-query each exact JSR
    `<version>_meta.json` for the `/jsr.json` checksum. Compare every value to
    the Package legitimacy audit, verify nap 0.31.2 depends on core ^0.31.1 and
    shim/sdk select the exact new core/nap pair, and record the immutable URLs,
    hashes, source PR, merge, and release-source refs for the execution summary
    and PR body. Treat any mismatch as a stop condition; do not install an
    unverified substitute.

    Make `tests/unit/published-napplet-contract.test.ts` fail against the old
    line first. Update generated pnpm type-import paths and `PACKAGE_MATRIX` to
    core 0.31.1, nap 0.31.2, shim 0.29.2, sdk 0.27.2, and Vite plugin 0.14.1.
    Replace the prior package source/release evidence with NAP-INTENT authority
    `5ac0490`, napplet/web#199 source/merge, and Version Packages #198
    release-source refs. Add a compile/declaration assertion for an
    `IntentInvokeResultMessage` containing `id` and a full `IntentResult`, and
    inspect the installed intent declaration to prove `result: IntentResult`
    is required. Change `MANIFEST_OPTIONS` to a valid orthogonal pair such as
    role `profile` with convention `napplet:note/open`; inspect the installed
    Vite distribution to prove the stale role/convention equality rejection is
    absent while queryless validation remains. Keep the existing official
    lineage, no-postinstall, shell-omission, relay-drift, and INC checks.

    Update only the playground root, feed, and profile-viewer exact pins to the
    audited matrix, regenerate `pnpm-lock.yaml`, frozen-materialize it, and run
    the installed-contract test plus both napplet builds. This tracer is the
    real feed intent invoker → profile target package slice; do not alter
    `packages/nip/src/5d/index.ts`, `apps/playground/napplets/shared-vite-config.ts`,
    either parser's tests, or any other host behavior from kehto/web#229.

    Stage only these five paths and create an atomic Conventional Commit such
    as `test(intent): prove the published package fixes`, with `Tested:`,
    `Protocol: napplet/naps@5ac0490`, and
    `Co-Authored-By: Codex <noreply@openai.com>` trailers.
  </action>
  <verify>
    <automated>test "$(npm view @napplet/core@0.31.1 dist.integrity)" = "sha512-+bwkrQbJ+EHeGzgZqiKKlXNfaSSDboMEujf155Pltru3y8LTHvUL4nu4vyoxvO5cexIqm2qgPUgmB0yrPpVA9g==" &amp;&amp; test "$(npm view @napplet/nap@0.31.2 dist.integrity)" = "sha512-o07TkB/h+JP3nrF69DLdvhmYKarjgZ7vDz22GZaFgPzxjvEizrAa88KBG1mjbLsuutmTj7VJz69xJHkoBFHZcQ==" &amp;&amp; test "$(npm view @napplet/shim@0.29.2 dist.integrity)" = "sha512-g8tsoEOlA6mqjwfj8wldE4+uhb15+IKOs52sU/C/nyDESG2QId7tfKACBVGFkxBJgjjvl4TOQuLrQWEwzDKB4Q==" &amp;&amp; test "$(npm view @napplet/sdk@0.27.2 dist.integrity)" = "sha512-/5j2SrAc+mNoEFCGeRE+vZtCmzCZE6tvcWCXi2sokVKedvcl8Pj+2/+xwlJY5qWrkYwK/v7d49jThyr2xypH4w==" &amp;&amp; test "$(npm view @napplet/vite-plugin@0.14.1 dist.integrity)" = "sha512-WIs5CP9+lWOOuuItlO39tjvlWxuFJmb1xLyXcuM6BlV9LTmbO2bAkU1mXcz9G0mPSRQnxzTRf4RckP9J0O6Yug==" &amp;&amp; test "$(npm view @napplet/conformance@0.16.2 dist.integrity)" = "sha512-Km/UNz4t6td3Rnpx04kJhQ7fetsl45Wx9OaOVUmgO/Fx5e+Qwgxi4kBp8uGDgZT1WcJ711XbC2ssps3pODi/mg==" &amp;&amp; test "$(curl -fsSL https://jsr.io/@napplet/core/0.31.1_meta.json | jq -r '.manifest[\"/jsr.json\"].checksum')" = "sha256-8105d15b988cd67e148ad164a906dc879664ec1f224717692658aa0bea33a1bd" &amp;&amp; test "$(curl -fsSL https://jsr.io/@napplet/nap/0.31.2_meta.json | jq -r '.manifest[\"/jsr.json\"].checksum')" = "sha256-439a42c451fefdc6bc34b585ff41892890a9afbc83a38b3bf9a7c96d486255bf" &amp;&amp; test "$(curl -fsSL https://jsr.io/@napplet/shim/0.29.2_meta.json | jq -r '.manifest[\"/jsr.json\"].checksum')" = "sha256-a57ff0d655f059db8595239e474b9d44eb575b6bcd906d216abd702578840edb" &amp;&amp; test "$(curl -fsSL https://jsr.io/@napplet/sdk/0.27.2_meta.json | jq -r '.manifest[\"/jsr.json\"].checksum')" = "sha256-4e400490d65214411a4ea0fc4a20d61b2ea44ddb83318b6fd71c68684651f694" &amp;&amp; test "$(curl -fsSL https://jsr.io/@napplet/vite-plugin/0.14.1_meta.json | jq -r '.manifest[\"/jsr.json\"].checksum')" = "sha256-82b8274d5ffa8f7a39591328a73b3a95e4b1207a1a7215b9bb9377fb1e06c9ae" &amp;&amp; test "$(curl -fsSL https://jsr.io/@napplet/conformance/0.16.2_meta.json | jq -r '.manifest[\"/jsr.json\"].checksum')" = "sha256-0bc8284e803a8ef6a9b4bd87df2776b511b5e6bb8668a3042c4bed7465f75ede" &amp;&amp; pnpm install --lockfile-only &amp;&amp; pnpm install --frozen-lockfile &amp;&amp; pnpm exec vitest run tests/unit/published-napplet-contract.test.ts &amp;&amp; pnpm --filter @kehto/demo-feed build &amp;&amp; pnpm --filter @kehto/demo-profile-viewer build</automated>
  </verify>
  <done>Registry identities and immutable hashes match the audited release; the installed contract test proves both NAP-INTENT package fixes; the feed/profile slice builds from the new frozen packages; no Kehto-local parser behavior changes; and the first atomic commit is green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Expand the exact matrix to every active consumer and fail closed on mixed locks</name>
  <files>apps/playground/napplets/ble-demo/package.json, apps/playground/napplets/bot/package.json, apps/playground/napplets/chat/package.json, apps/playground/napplets/common-demo/package.json, apps/playground/napplets/composer/package.json, apps/playground/napplets/cvm-relatr/package.json, apps/playground/napplets/link-demo/package.json, apps/playground/napplets/lists-demo/package.json, apps/playground/napplets/preferences/package.json, apps/playground/napplets/resource-demo/package.json, apps/playground/napplets/serial-demo/package.json, apps/playground/napplets/toaster/package.json, apps/playground/napplets/webrtc-demo/package.json, packages/shell/package.json, tests/fixtures/napplets/nap-identity/package.json, tests/fixtures/napplets/nap-inc/package.json, tests/fixtures/napplets/nap-notify/package.json, tests/fixtures/napplets/nap-relay/package.json, tests/fixtures/napplets/nap-storage/package.json, tests/fixtures/napplets/nap-theme/package.json, pnpm-lock.yaml, tests/unit/napplet-package-alignment.test.ts, tests/unit/sdk-migration-guard.test.ts, tests/unit/playground-gateway-guard.test.ts</files>
  <behavior>
    - "Every discovered active exact consumer uses only the five-version audited matrix and every importer resolves that same matrix."
    - "The final lock contains the new snapshots and no superseded exact-matrix snapshot retained by an active importer or package graph."
    - "Public Kehto core/nap peer and development declarations remain >=0.31.0 <0.32.0, and JSR maps remain ^0.31.0, because those ranges already admit the patch release."
    - "Shell's development-only shim is exactly 0.29.2 while the host-owned mandatory NAP-SHELL prelude and shell omission regression remain unchanged."
    - "The active package/source guards record the new package source and release provenance without changing the local archetype/convention parser rules."
  </behavior>
  <action>
    Update the remaining thirteen playground napplet manifests and all six
    browser fixture manifests to the exact matrix, changing only packages that
    each manifest already declares. Update shell's existing development-only
    shim pin to 0.29.2. Do not add `@napplet/conformance` or another package to
    Kehto: conformance is a verified upstream release artifact, not a current
    workspace dependency.

    Update `PACKAGE_VERSIONS` in
    `tests/unit/napplet-package-alignment.test.ts` and
    `protocolPackageVersions` plus package provenance in
    `tests/unit/sdk-migration-guard.test.ts`. Preserve
    `PUBLIC_CORE_RANGE = >=0.31.0 <0.32.0`, both public-range checks, and the
    existing `jsr:@napplet/*@^0.31.0` expectations. Strengthen the dynamic
    alignment guard so active importers and final lock/package snapshots cannot
    retain the superseded exact matrix once migration is complete. Update the
    resource-demo package-line sentinel in
    `tests/unit/playground-gateway-guard.test.ts`; keep its host-flow and
    archetype/convention assertions unchanged.

    Regenerate the lock only with pnpm 10.8.0, frozen-materialize it, inspect
    each active importer, and prove installed package metadata selects core
    0.31.1, nap 0.31.2, shim 0.29.2, SDK 0.27.2, and Vite plugin 0.14.1. The
    expected shared dependency edges are nap → core ^0.31.1 and shim/sdk → exact
    core 0.31.1 plus nap 0.31.2. Do not use overrides, local links, or a second
    package line.

    Review the diff specifically for files from kehto/web#229. Do not modify
    `packages/nip/src/5d/index.ts`, its parser tests,
    `apps/playground/napplets/shared-vite-config.ts`, or the local equality
    guard. This task consumes the fixed Vite package but leaves Kehto's separate
    host-parser PR independent.

    Stage only the listed manifests, lock, and three guards and create an
    atomic Conventional Commit such as
    `chore(deps): adopt the NAP-INTENT package release`, with `Tested:`,
    `Protocol: napplet/naps@5ac0490`, and
    `Co-Authored-By: Codex <noreply@openai.com>` trailers.
  </action>
  <verify>
    <automated>pnpm install --lockfile-only &amp;&amp; pnpm install --frozen-lockfile &amp;&amp; pnpm exec vitest run tests/unit/napplet-package-alignment.test.ts tests/unit/published-napplet-contract.test.ts tests/unit/sdk-migration-guard.test.ts tests/unit/playground-gateway-guard.test.ts &amp;&amp; pnpm --filter @kehto/shell build &amp;&amp; git diff --check</automated>
  </verify>
  <done>Every active exact consumer, lock importer, package snapshot, and installed artifact uses the one audited matrix; the broad public 0.31 compatibility declarations remain accurate and unchanged; local host-parser behavior remains wholly outside the diff; and the dependency expansion commit is green.</done>
</task>

<task type="auto">
  <name>Task 3: Synchronize active package guidance, prove no changeset, run release gates, and ship the PR</name>
  <files>RUNTIME-SPEC.md, apps/playground/README.md, apps/playground/napplets/resource-demo/src/main.ts, docs/how-tos/paja-getting-started.md, docs/how-tos/paja-local-authoring.md, docs/packages/paja.md, docs/packages/playground.md, docs/packages/shell.md, docs/policies/NIP-5D-CONFORMANCE.md, docs/policies/SHELL-RESOURCE-POLICY.md, packages/acl/README.md, packages/firewall/README.md, packages/paja/README.md, packages/runtime/README.md, packages/services/README.md, packages/shell/README.md, tests/fixtures/napplets/README.md</files>
  <action>
    Update only current, user-facing statements about the installed published
    package line: core 0.31.1, nap 0.31.2, shim 0.29.2, SDK 0.27.2, Vite plugin
    0.14.1, and registry-only conformance 0.16.2 where the complete release is
    described. Record NAP-INTENT authority `5ac0490`, upstream fix source/merge
    from napplet/web#199, and release source `dc1d2415` from Version Packages
    #198. Update the fixture guide's exact package matrix and the resource-demo
    bootstrap comment/guard together. Preserve the verified statements that the
    new core/shim still omit generic mandatory shell, the existing relay drift
    remains separately governed, and Kehto retains its host-owned NAP-SHELL
    prelude.

    Do not rewrite historical changelogs, migrations, completed planning
    evidence, or superseded design documents. In `RUNTIME-SPEC.md`, touch only
    the published-package/provenance statements needed for this release; do not
    import the host-parser semantic edits from kehto/web#229.

    Make the changeset decision explicit: add no `.changeset` file. The diff
    changes private playground/fixture pins, a package's development-only shim,
    the lock, tests, comments, and documentation; it does not change any
    `@kehto/*` runtime source, export, npm peer range, JSR import map, or shipped
    compatibility contract. Run `pnpm changeset status` and record this reason
    in the summary and PR. Do not pre-version any `docs/packages/*` `| Version |
    ... |` row; `pnpm docs:check` must prove every row still equals its current
    `@kehto/*` package manifest.

    Run the focused guards again, then the full release gates with the frozen
    lock: `pnpm build`, `pnpm type-check`, `pnpm test:unit`,
    `pnpm test:e2e`, `pnpm docs:check`, `pnpm audit:csp`, the pinned AI-slop
    scan, and `git diff --check`. AI-slop must report exactly 100/100. Re-run
    the immutable npm/JSR checks after the final edit so registry evidence is
    not only a pre-edit observation.

    Commit the documentation with a Conventional Commit such as
    `docs(protocol): record the NAP-INTENT patch line`, using `Tested:`,
    `Protocol: napplet/naps@5ac0490`, and
    `Co-Authored-By: Codex <noreply@openai.com>` trailers. At every staging
    step use explicit paths. Preserve
    `.planning/debug/jsr-release-scope-auth.md` exactly as the pre-existing
    untracked file and confirm it never enters any commit.

    Confirm the branch diff contains only package adoption, guards, and current
    guidance; push `chore/bump-napplet-intent-packages`; and open a PR. The PR
    body must state what/why, the exact NAP/spec and upstream PR/release refs,
    the immutable npm/JSR evidence, the no-changeset rationale, full gate
    results, and that kehto/web#229 remains the separate local host-parser fix.
    Read the PR back with
    `gh pr view --json url,state,headRefName,headRefOid,body`, assert
    `headRefOid` equals local `HEAD`, then watch required checks and repair this
    branch until they are green.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/unit/napplet-package-alignment.test.ts tests/unit/published-napplet-contract.test.ts tests/unit/sdk-migration-guard.test.ts tests/unit/playground-gateway-guard.test.ts &amp;&amp; pnpm install --frozen-lockfile &amp;&amp; pnpm build &amp;&amp; pnpm type-check &amp;&amp; pnpm test:unit &amp;&amp; pnpm test:e2e &amp;&amp; pnpm docs:check &amp;&amp; pnpm audit:csp &amp;&amp; pnpm changeset status &amp;&amp; npx --yes aislop@0.12.0 scan -d &amp;&amp; git diff --check &amp;&amp; test "$(git status --short -- .planning/debug/jsr-release-scope-auth.md)" = "?? .planning/debug/jsr-release-scope-auth.md" &amp;&amp; test "$(git rev-parse HEAD)" = "$(gh pr view --json headRefOid --jq .headRefOid)" &amp;&amp; gh pr checks --required</automated>
  </verify>
  <done>Active guidance and package-version rows are accurate; no changeset is present for the non-shipping adoption diff; all focused/full gates and AI-slop 100/100 pass; the protected debug note remains untracked; atomic commits are pushed; and an open required-check-green PR exactly matches local HEAD and keeps #229 separate.</done>
</task>

</tasks>

<threat_model>
## Trust boundaries

| Boundary | Description |
|---|---|
| npm/JSR registries → local pnpm graph | Third-party package bytes and metadata enter Kehto's build/test environment. |
| Published Napplet declarations/runtime → Kehto guards | Upstream contract projections determine what Kehto compiles and what exact behavior the static evidence claims. |
| Upstream Vite package fix → Kehto-local manifest validation | The published authoring fix must be consumed without silently changing the independent local host parser. |
| Working tree → git commits/PR | Task-owned files must ship without absorbing the protected untracked debug note or unrelated work. |

## STRIDE threat register

| Threat ID | Category | Component | Severity | Disposition | Mitigation plan |
|---|---|---|---|---|---|
| T-lpw-01 | Tampering | npm/JSR artifacts | high | mitigate | Pin exact consumer versions, compare npm SRI and JSR manifest checksums to the audited values before and after editing, verify official repository directories/no postinstall, then frozen-install the generated lock. |
| T-lpw-02 | Spoofing | Package lineage | high | mitigate | Require `sandwichfarm/napplet` repository metadata, expected package directory, exact NAP authority, PR source/merge, and Version Packages release-source refs in tests and PR evidence. |
| T-lpw-03 | Tampering | Local NAP-INTENT parser behavior | high | mitigate | Restrict product changes to dependency manifests; inspect the branch diff for #229-owned parser/shared-config files and fail if they change. |
| T-lpw-04 | Denial of service | Mixed pnpm dependency graph | medium | mitigate | Dynamic guards check every active manifest/importer/snapshot/installed package and reject superseded exact-matrix residue before full builds and Playwright. |
| T-lpw-05 | Repudiation | Changeset and release evidence | medium | mitigate | Record the explicit no-changeset rationale, exact registry hashes, commands, commit OIDs, pushed OID, and PR head OID in the summary/PR. |
| T-lpw-06 | Information disclosure | Public registry metadata queries | low | accept | Queries use only public package/spec/PR metadata and send no project secrets or credentials beyond normal authenticated GitHub CLI access. |
| T-lpw-SC | Tampering | pnpm package materialization | high | mitigate | Package Legitimacy Audit marks every existing package VERIFIED; no ASSUMED/SUS/SLOP package or new install target is permitted. |
</threat_model>

## Source coverage audit

| Source | ID | Feature/requirement | Plan | Status | Notes |
|---|---|---|---|---|---|
| GOAL | — | Adopt the published NAP-INTENT package fixes throughout Kehto and ship a PR | 01 | COVERED | Tasks 1-3 provide tracer, expansion, verification, and PR. |
| REQ | QUICK-260802-LPW | Bump every applicable exact @napplet pin and frozen lock | 01 | COVERED | Tasks 1-2 cover all dynamically discovered consumers and lock edges. |
| REQ | QUICK-260802-LPW | Update tests, docs, and changesets as required | 01 | COVERED | Tasks 1-3 update guards/current guidance and make the explicit no-changeset decision. |
| REQ | QUICK-260802-LPW | Verify immutable npm and JSR artifacts | 01 | COVERED | Package audit and Tasks 1/3 check exact SRI/checksums twice. |
| REQ | QUICK-260802-LPW | Run full release gates and ship a PR | 01 | COVERED | Task 3 runs frozen install, build/type/unit/e2e/docs/CSP/slop/diff/checks and creates/verifies the PR. |
| RESEARCH | — | napplet/web#199 fixes structured results and orthogonal archetype/convention handling | 01 | COVERED | Task 1 installed-contract behavior. |
| RESEARCH | — | Release matrix is core 0.31.1, nap 0.31.2, shim 0.29.2, SDK 0.27.2, Vite plugin 0.14.1; conformance 0.16.2 is not consumed | 01 | COVERED | Package audit and Tasks 1-2. |
| RESEARCH | — | Existing Kehto dynamic guards distinguish exact private pins from broad public ranges and JSR maps | 01 | COVERED | Task 2 preserves public declarations and updates only the exact matrix. |
| CONTEXT | — | NAP-INTENT authority is `napplet/naps@5ac0490` and its two semantic requirements are locked | 01 | COVERED | Objective, context, tests, docs, and PR evidence. |
| CONTEXT | — | Keep kehto/web#229 as the separate local host-parser fix | 01 | COVERED | All three tasks and stop conditions exclude its behavior/files. |
| CONTEXT | — | Preserve `.planning/debug/jsr-release-scope-auth.md` and never stage it | 01 | COVERED | Task 3 staging and automated status assertion. |
| CONTEXT | — | Include docs/package version checks, AI-slop 100/100, atomic commits, push, and PR | 01 | COVERED | Task 3 and success criteria. |

No source item is deferred or missing.

## Stop conditions

- Any npm SRI, JSR checksum, package version/dependency edge, official repository directory, or no-postinstall assertion differs from the Package legitimacy audit.
- The new lock contains a mixed active matrix, a local/link/workspace Napplet package, or a superseded snapshot reachable from an active importer.
- Installed nap 0.31.2 does not require a structured invoke result, or installed Vite plugin 0.14.1 still rejects an otherwise valid orthogonal archetype/convention pair.
- Completing adoption requires a public Kehto peer/JSR/export/runtime change; stop and replan the compatibility/change-set scope rather than smuggling it into this package-only PR.
- Any #229-owned parser/shared-config behavior enters the diff, or the package-adoption PR claims to replace/close #229.
- `.planning/debug/jsr-release-scope-auth.md` is modified, staged, committed, or no longer present as the original untracked file.
- Any focused/full gate fails, AI-slop is below 100/100, the pushed OID differs from local HEAD/PR head, or a required PR check remains failing.

<verification>
- Immutable npm/JSR identities and official lineage match the audited six-package evidence.
- Dynamic manifests, lock importers/snapshots, and installed metadata converge on one five-package consumed matrix.
- Installed declarations/distributions prove both upstream NAP-INTENT fixes without local parser changes.
- Active docs and package-line statements match the lock; Kehto package version rows remain current and no changeset is added.
- Frozen install, build, type-check, full unit, full Playwright, docs, CSP audit, AI-slop 100/100, diff check, and required GitHub checks pass.
</verification>

<success_criteria>
- All exact consumer pins and the lock use core 0.31.1, nap 0.31.2, shim 0.29.2, SDK 0.27.2, and Vite plugin 0.14.1 as applicable.
- Conformance 0.16.2 is immutably verified without becoming an unused Kehto dependency.
- Static guards fail closed on old/mixed package lines and prove the required structured result plus orthogonal Vite metadata behavior.
- Kehto/web#229 remains an independent host-parser fix with no protocol-behavior duplication here.
- The no-changeset decision is evidence-backed, package docs remain version-consistent, and all release gates pass.
- Atomic commits are pushed and the open green PR head exactly equals local HEAD while the protected debug note remains untouched.
</success_criteria>

<output>
Create `.planning/quick/260802-lpw-adopt-the-published-nap-intent-package-f/260802-lpw-SUMMARY.md` when execution is complete.
</output>
