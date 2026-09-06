---
phase: 89
plan: "01"
subsystem: docs
tags: [docs, specs, changesets, nip-5d, nap-shell, nap-intent, conformance]
requires: [phases 86-88 (@napplet 0.12/0.13 modernization, NAP-SHELL/INTENT conformance)]
provides: [specs/NIP-5D.md refreshed, specs/NAP-SHELL.md, specs/NAP-INTENT.md, RUNTIME-SPEC.md refreshed, modernization changesets]
affects: [release versioning (changesets), package docs]
tech-stack:
  added: []
  patterns: [docs-only, changeset-per-package]
key-files:
  created:
    - specs/NAP-SHELL.md
    - specs/NAP-INTENT.md
    - .changeset/napplet-0-12-modernization.md
    - .changeset/shell-nap-shell-capabilities-superset.md
    - .planning/phases/89-spec-doc-refresh-conformance-sweep/deferred-items.md
  modified:
    - specs/NIP-5D.md
    - RUNTIME-SPEC.md
    - packages/{acl,runtime,services,shell,wm}/README.md
    - apps/playground/README.md
    - packages/{runtime,services,shell}/src (doc-comment sweep only)
decisions:
  - "Authority citation updated to nostr-protocol/nips#2303 (was dskvr/nips#3 + #2287)"
  - "nap: is the primary capability prefix; nub: retained only as an accepted back-compat alias"
  - "@napplet/nub kept only in rename-documentation + legacy nubs-array consumer comments (migration-archive); no doc cites it as the current dependency"
  - "DOCS-04: documented NAP-sanctioned structured-error exceptions and the identity/media/notify divergences rather than changing behavior (docs-only phase)"
  - "9 pre-existing stale guard-test failures (phases 86-88 modernization) logged to deferred-items; not fixed (out of phase-89 scope, test files not touched)"
metrics:
  duration: ~45m
  completed: 2026-06-17
---

# Phase 89 Plan 01: Spec / Doc Refresh & Conformance Sweep Summary

Refreshed the NIP-5D/NAP spec and prose docs and added the missing
`@napplet` 0.12/0.13 modernization changesets so every `@kehto/*` package
changed this milestone ships a changeset — a docs-and-changesets-only phase that
left runtime/behavior/tests untouched (phases 86–88 own those).

## What was done

### DOCS-01 — `specs/NIP-5D.md` rewritten
- Authority citation changed from `dskvr/nips#3` / NIP-5A `#2287` to
  **`nostr-protocol/nips#2303`** (`5D.md`) + the master NIP-5A.
- NUB → NAP terminology throughout; `nub:` → `nap:` capability prefix, with a
  table row documenting `nub:identity` as an **accepted back-compat alias**.
- Documented the manifest `["archetype","<slug>","<NAP-N>"]` and optional
  `source` tags (parsed by `@kehto/nip/5d`).
- Documented the conformant capability wire shape kehto emits and the 0.13 shim
  reads: `capabilities: { domains: string[], protocols: Record<string,string[]> }`,
  emitted as a superset alongside the legacy `naps`/`nubs`/`sandbox` fields.
- References the two NAP mirrors.

### DOCS-02 — local NAP mirrors added
- `specs/NAP-SHELL.md` — faithful concise mirror of the merged registry
  NAP-SHELL (mandatory `shell.ready`/`shell.init` handshake, `supports(domain,
  protocol?)`, `services`, `class: number|null`, exactly-once init, idempotent
  duplicate ready). Cites `napplet/naps` URLs + kehto conformance notes.
- `specs/NAP-INTENT.md` — faithful concise mirror of NAP-INTENT (`intent.*`
  wire, archetype/protocol orthogonality, sanctioned structured errors,
  catalog-from-signed-manifests). Cites registry URLs + kehto conformance notes.
- Both referenced from `specs/NIP-5D.md`.

### DOCS-03 — `RUNTIME-SPEC.md` + comment/README sweep
- `RUNTIME-SPEC.md` refreshed to the #2303/NAP model: a Toolchain table
  (`@napplet/core ^0.12`, `nap 0.12`, `sdk 0.12`, `shim 0.13`, `vite-plugin
  0.8.1`, napplet/web#53 resolved), a NAP-SHELL Handshake section (exactly-once,
  `class number|null`, the `{domains,protocols}` capability shape), and the
  `inc`-wire note.
- Swept stale `@napplet/nub/<subpath>` **contract references** → `@napplet/nap/`
  across doc comments + package READMEs. `@napplet/nub` now appears only in (a)
  the rename-documentation lines and (b) the legacy `nubs`-array consumer
  comments (migration-archive) — no doc cites it as the current dependency.
- NUB → NAP prose in `packages/{acl,runtime,services,shell,wm}/README.md` and the
  playground README; preserved internal identifiers (`resolveCapabilitiesNub`,
  `createNubEnforceGate`, `NubMessage`, `createNubEnvelopeDispatcher`, `IfcDomain`).
- Playground README inventory: `ifc` → `inc` for the 4 migrated napplets
  (bot/chat/feed/profile-viewer) + a dual-route note; fixed the stale "AUTH
  handshake" phrasing in the shell README to the NAP-SHELL handshake.

### DOCS-04 — unknown-`type` uniformity (finding below)
Documented in a new RUNTIME-SPEC "Unknown-`type` handling" section. No behavior
change (docs-only phase).

### Changesets (VERIFY-01)
- `.changeset/napplet-0-12-modernization.md` — **minor** for `@kehto/acl`,
  `@kehto/runtime`, `@kehto/services`, `@kehto/shell`, `@kehto/firewall`
  (peer `@napplet/core ^0.5`→`^0.12`, `@napplet/nub`→`@napplet/nap`, core API
  `registerNub`→`registerNap`/`NubHandler`→`NapHandler`; consumer migration note).
- `.changeset/shell-nap-shell-capabilities-superset.md` — **minor** for
  `@kehto/shell` (conformant `shell.init` `capabilities.{domains,protocols}`
  superset, NAP-SHELL alignment with shim 0.13).
- Reused the existing `@kehto/nip` (archetype) and `@kehto/services` (adapter)
  changesets; the prior `@kehto/shell` handshake patch is subsumed by the two
  minors. `changeset status` confirms all six changed @kehto packages (acl,
  runtime, services, shell, firewall, nip) are covered.

## DOCS-04 finding

Unknown-`type` handling is **not uniformly silent-ignore**, but the divergences
are either NAP-sanctioned or pre-existing low-risk:

- **Silent-ignore (conformant)** — unknown *domain* is dropped by the dispatcher
  (`createNubEnvelopeDispatcher`); unknown *action* is silently ignored by
  `audio`, `config`, `cvm`, `intent`, `outbox`, `resource`, `upload`,
  `notification-service`.
- **NAP-sanctioned structured errors (keep)** — NAP-INTENT explicitly permits
  `intent.*.result`/`.error`; storage replies `storage.*.result` with an optional
  `error` field (its canonical contract; napplets check `!result.error`).
- **Documented divergences (not changed)** — `identity`, `media`, and `notify`
  reply to an *unrecognized action* with a `<type>.error` envelope rather than
  silently ignoring it. They predate the #2303 tightening, emit only a generic
  "Unknown <domain> method" string, are query-domain handlers answering a
  correlated request `id`, and are relied on by existing unit tests. Normalizing
  them is a behavior change outside this docs phase and not clear-cut/risk-free,
  so they are **documented in RUNTIME-SPEC** as a candidate future behavior-only
  change rather than altered.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two storage.clear test regexes left out of the contract sweep**
- **Found during:** DOCS-03 comment sweep
- **Issue:** `state-handler.test.ts:236` and `dispatch.test.ts:441` assert the
  storage.clear error string via a regex `@napplet\/nub\/storage`. The sweep
  updated the source error string (`state-handler.ts:151`) to `@napplet/nap/
  storage`, but the escaped-slash regexes were not matched by the
  `@napplet/nub/` sweep, so they would no longer match the new string.
- **Fix:** updated both regexes to `@napplet\/nap\/storage`.
- **Files modified:** `packages/runtime/src/state-handler.test.ts`,
  `packages/runtime/src/dispatch.test.ts`
- **Commit:** a4ab694

## Deferred Issues

**9 pre-existing stale guard-test failures** in `tests/unit/sdk-migration-guard.
test.ts` (5), `tests/unit/playground-gateway-guard.test.ts` (3), and
`tests/unit/nip5d-conformance-guard.test.ts` (1). These assert the
pre-modernization 0.5.0 / `@napplet/nub` / `ifc` graph that phases 86–88 already
replaced with the 0.12/0.13 / `@napplet/nap` / `inc` graph. They were not updated
when the modernization landed (e.g. `relay-handler.ts` imports
`@napplet/nap/relay/types` since phase-88 commit `acdbc69`, but the guard asserts
`@napplet/nub/relay/types`). Not caused by phase 89 (the failing test files were
not touched; all 261 unit tests in files phase 89 *did* touch pass). Fixing them
is a phase 86–88 / test-owning correction, out of this docs-only phase's scope —
logged to `deferred-items.md`. See that file for the per-spec breakdown and the
recommended realignment.

## Gate Results

- `pnpm build` — **24/24 successful** (the `@kehto/wm#build` "no output files"
  warning is pre-existing — wm has no build output).
- `pnpm type-check` — **13/13 successful**.
- `pnpm test:unit` — 1044/1053 pass; **9 pre-existing stale-guard failures**
  (deferred, above); 261/261 pass in every file phase 89 modified.
- `pnpm test:e2e` (CI mode, workers=1) — **80/80 passed**.
- `pnpm changeset status` — all six changed @kehto packages (acl, runtime,
  services, shell, firewall, nip) covered.
- `rg "@napplet/nub" packages apps specs RUNTIME-SPEC.md --glob '!**/CHANGELOG.md'`
  — 12 matches, all rename-documentation or legacy `nubs`-array consumer comments;
  **none cite `@napplet/nub` as the current dependency** (gate satisfied).

## Self-Check: PASSED

All created files exist on disk; all three per-task commits (d37ef25, 1c318e6, a4ab694) are in git history.
