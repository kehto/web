---
status: resolved
trigger: resolve https://github.com/kehto/web/issues/416
created: 2026-11-10
updated: 2026-11-10
---

# Current Focus

hypothesis: Host peer upper bounds reject core 0.40 / nap 0.39; intent delivery contracts need comparison before widening them.
next_action: Maintainer review and the normal merge/version-packages release flow for PR #419.

# Symptoms

Expected: Paja and its transitive host packages accept core 0.40.x / nap 0.39.x.
Actual: Published Paja 0.32.1 rejects those versions through peer upper bounds.
Reproduction: npm install @napplet/core@0.40.0 @napplet/nap@0.39.0 @kehto/paja@0.32.1.

# Evidence

- Clean isolated branch starts at origin/main fad02d2a; primary checkout's package.json and shell skills are unrelated WIP and remain untouched.
- GSD debug initialized with query state.load. Work executes inline per skill's spawn restriction.
- All eight host packages develop on core 0.38 / nap 0.37. Fixtures deliberately stay on core/nap 0.32.
- NAP-INTENT master 43cb3a4e855570ec4b90b9cc05f0c721e5ad0aab and reconciliation draft fc121fc264615482143eda86125863d2e1f741a2 omit delivery IDs; locate the delivery proposal before changing runtime semantics.

# Plan

1. Verify owning specifications and packaged changes, retain explicit bounded policies for optional domains.
2. Update host peer/dev/JSR maps, lockfile, consumer types/behavior, docs and changesets; cover real integration regressions.
3. Build, types, units, docs, browser tests and AI-slop; commit by path and push an open PR addressing #416.

# Implementation and verification

- Host development core 0.40.0 / nap 0.39.0; peer caps core <0.41 / nap <0.40, with existing floors preserved across all eight consumers. JSR maps, lockfile, docs and eight patch changesets move together.
- Current NAP-INTENT #128 at 74f9bf85 withdraws IDs/null senders; core 0.40 still exports them. Upstream napplet/web#328 and local #418 track the existing bounded local contract. No wire workaround added. Type/API and existing runtime/browser coverage preserve the canonical shape.
- Package inventory also adds catalog, alongside blossom/navigation/soulseek/torrent. All five are explicitly deferred and absent from resolved host environments. Exact draft refs and policy are recorded in docs/policies/NIP-5D-CONFORMANCE.md.
- Build and type-check pass. 265 unit files / 3,368 tests pass. Browser suite: 124 passed, one pre-existing identity lifecycle fixme skipped. Docs gate passes, including strict TypeDoc and all ten package pages.
- AI-slop 0.12.0 full and changed-source scans score 100/100; config unchanged.
- Packed all ten packages and installed with npm --strict-peer-deps alongside core 0.40 / nap 0.39; npm ls proves one deduplicated generation throughout. Packed startPajaServer serves HTTP 200 with a host iframe and closes cleanly.

# Resolution

Root cause: host package peer upper bounds and JSR maps lagged the published Napplet line; the export inventory also omitted five newly packaged optional domains.

Strict downstream installations pass in npm, pnpm 10.24.0 and pinned pnpm 10.8.0. pnpm overrides select the unpublished local tarballs for every internal dependency; no peer rule is weakened. The initial pnpm attempt selected released transitive packages, so the clean fixture was rerun with tarball overrides before accepting the result.

Final gates: build/types/docs/frozen install pass; 3,368 unit tests pass; 124 browser tests pass with one pre-existing identity lifecycle fixme; changed and full AI-slop scores are 100/100. README guidance is synced. NAP-INTENT draft #128 head was rechecked at 74f9bf85 before opening the PR.

Shipped as open PR https://github.com/kehto/web/pull/419 with implementation 20b7ff5a and documentation 375a845b. Merge and package publication are intentionally left to the normal release flow; no release was run locally.
