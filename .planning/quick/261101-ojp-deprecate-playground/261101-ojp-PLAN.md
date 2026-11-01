---
phase: quick-261101-ojp
plan: "01"
type: quick
subsystem: playground
autonomous: true
---

# Quick 261101-ojp: Deprecate and retire the playground

Goal (user): "deprecate the playground. Don't want to maintain it anymore."

Decision: retire `@kehto/playground` (private, never published) outright rather
than freezing it in place. Frozen workspace code still has to build, type-check
and pass e2e on every runtime change, so leaving it in the repo would keep the
maintenance cost. Recovery stays possible through git history. The only external
surface is the public Pages URL, so `/web/playground/` keeps a tracked
compatibility redirect to Paja (`KEHTO_PLAYGROUND_RETIRED`).

## Tasks

1. Remove `apps/playground` (shell + 15 demo napplets) and its workspace, turbo,
   root-script, Playwright webServer, and Pages-build wiring; refresh the lockfile.
2. Delete playground-only unit/e2e tests. Keep shared-package assertions by
   decoupling them: inline manifest signing in the published-contract test, drop
   playground surfaces from the conformance/migration/identity-theme guards, port
   the NAP-THEME e2e spec to the harness fixture, and keep the Paja media-player e2e cases.
3. Retarget `audit:csp` to fixture napplets, retire `audit:gateway-artifacts`,
   rewrite the e2e selector groups, and replace the Pages playground build with the
   redirect page plus audit checks.
4. Add the redirect page (single `console.warn` with a stable ID, meta refresh,
   noindex), a regression test, and a compatibility-register entry.
5. Sync docs, READMEs, AGENTS.md and the NIP-5D conformance policy (allowlist now empty).
6. Gates: build, type-check, unit, docs:check, Pages build + audit, e2e, slop.
