---
phase: 11-nub-peer-deps-type-imports
plan: 02
subsystem: runtime, shell, services, acl
tags: [nub-types, import-type, drift-markers, phase-12-prep, core-compat-shim]

# Dependency graph
requires:
  - phase: 11-nub-peer-deps-type-imports
    plan: 01
    provides: "8 @napplet/nub-* peer-deps + link: overrides; nub types resolvable via `import type`"
provides:
  - "Three `msg as any` widenings in runtime.ts (handleRelayMessage / handleIfcMessage / dispatch envelope.id) replaced with real `import type` references to @napplet/nub-storage / @napplet/nub-ifc / @napplet/nub-relay unions"
  - "`msg as any` eliminated from state-handler.ts handleStorageNub (narrowed to StorageMessage + per-branch optional-field widening)"
  - "Every signer.* reference in packages/{acl,runtime,services,shell}/src annotated with a `// DRIFT-<ID> — Phase 12: ...` comment grepable against docs/v1.2-NIP-5D-AUDIT.md"
  - "packages/runtime/src/core-compat.ts — transitional local shim for @napplet/core v1.1-era exports that were dropped from v0.2.0+ (Capability, BusKind, ALL_CAPABILITIES, DESTRUCTIVE_KINDS, REPLAY_WINDOW_SECONDS, ServiceDescriptor, AUTH_KIND, SHELL_BRIDGE_URI, PROTOCOL_VERSION). Re-exported through @kehto/runtime so shell + services can keep consuming them during Phase 11."
  - "Clean `pnpm build` + `pnpm type-check` + `vitest run` (170/170) against @napplet/core@0.2.0 and the 8 nub peer-deps"
affects: [12-shell-conformance-seven-nub-coverage, 13-theme-nub-implementation, 14-dispatch-refactor]

# Tech tracking
tech-stack:
  added:
    - "`import type` consumption of @napplet/nub-storage.StorageMessage, @napplet/nub-ifc.IfcMessage, @napplet/nub-relay.RelayNubMessage inside packages/runtime/src/runtime.ts (types-only imports — zero runtime footprint)"
    - "`import type { StorageMessage } from '@napplet/nub-storage'` inside packages/runtime/src/state-handler.ts"
  patterns:
    - "Widen-through-a-named-DRIFT-ID pattern: when nub union discriminants do not match the dispatcher's sub-action switch, widen the narrowed variable with `as unknown as <NubMessage> & { subId?: string; … }` and annotate the site with the matching DRIFT-<ID>"
    - "Local compat shim file (core-compat.ts) for legacy core exports, marked DRIFT-CORE-06 — Phase 11-deviation, to be deleted by Phase 12/14 alongside the NIP-01 handlers that still reference it"
    - "Cross-package compatibility via @kehto/runtime barrel: shell + services re-export legacy symbols through the runtime compat shim instead of duplicating constants per package"

key-files:
  created:
    - "packages/runtime/src/core-compat.ts (98 lines) — @napplet/core v1.1 compat shim"
    - ".planning/phases/11-nub-peer-deps-type-imports/11-02-SUMMARY.md"
  modified:
    - "packages/runtime/src/runtime.ts — import nub unions; replace 3× `msg as any`; add DRIFT-RT-06/07/10 + DRIFT-RT-08/09 widening markers"
    - "packages/runtime/src/state-handler.ts — drop `msg as any`; narrow via StorageMessage intersected with per-branch optional fields"
    - "packages/runtime/src/enforce.ts — swap `TOPICS.STATE_*` consumption to the local STATE_TOPICS shim (DRIFT-CORE-06)"
    - "packages/runtime/src/acl-state.ts, event-buffer.ts, replay.ts, service-discovery.ts, types.ts — import Capability / BusKind / REPLAY_WINDOW_SECONDS / DESTRUCTIVE_KINDS / ServiceDescriptor from the local core-compat shim (DRIFT-CORE-06)"
    - "packages/runtime/src/index.ts — re-export compat symbols so shell + services can consume through @kehto/runtime"
    - "packages/acl/src/resolve.ts — add 4× DRIFT-ACL-05/06/07/08 — Phase 12 annotations; extend JSDoc table with DEPRECATED signer row. Zero new imports — zero-runtime-dep posture preserved."
    - "packages/services/src/{signer-service.ts,signer-service.test.ts,index.ts} — add DRIFT-SVC-01 + DRIFT-SVC-07 markers; swap `ServiceDescriptor` import to @kehto/runtime (DRIFT-CORE-06)"
    - "packages/services/src/{audio-service.ts,notification-service.ts} — swap `ServiceDescriptor` to @kehto/runtime (DRIFT-CORE-06)"
    - "packages/shell/src/{shell-init.ts,types.ts} — add DRIFT-SHELL-01/02/03/04 markers"
    - "packages/shell/src/{index.ts,types.ts} — re-export Capability / BusKind / etc. through @kehto/runtime instead of @napplet/core (DRIFT-CORE-06); remove duplicate ServiceDescriptor re-export"
    - "packages/shell/src/{acl-store.ts,hooks-adapter.ts} — swap Capability import to @kehto/runtime (DRIFT-CORE-06)"
    - "packages/runtime/src/dispatch.test.ts — add DRIFT-RT-06 marker above the `signer.getPublicKey bypasses ACL` test"

key-decisions:
  - "Rule 3 deviation: add a local @napplet/core v1.1 compat shim rather than rolling back the napplet workspace or expanding plan scope to delete every v1.1 import site. The shim is surgical (~98 lines), annotated with DRIFT-CORE-06 — Phase 11-deviation, and slated for deletion alongside the v1.1 NIP-01 dispatch paths that still consume it."
  - "Route compat re-exports through @kehto/runtime's barrel so shell + services can migrate in a single import-swap instead of maintaining parallel shims per package."
  - "Keep the surviving `msg as any` inside handleSignerMessage (1 remaining occurrence in runtime.ts) — annotated with DRIFT-RT-07. Narrowing it would require introducing a signer-domain nub type, which doesn't exist in the canonical 8-nub set. Phase 12 deletes the function outright."
  - "Use the widen-via-intersection pattern (`msg as unknown as NubBase & { subId?: …; filters?: … }`) for handleRelayMessage and handleIfcMessage — dispatch cleaves by sub-action string, not by msg.type discriminant, so direct union narrowing in the switch requires Phase 12 handler rewrites."
  - "Skip the DRIFT-SHELL-03 annotation in packages/shell/src/shell-bridge.ts — grep for `'signer'` in that file returns 0 matches despite the audit citing lines 165-170. The current shell-bridge does not carry the signer capability literal; audit row DRIFT-SHELL-03's line reference is stale but the remediation (remove signer capability advertisement from the shell) still applies via shell-init.ts."

patterns-established:
  - "DRIFT-CORE-06 — Phase 11-deviation marker for kehto↔napplet/core v0.2.0 compat shims. Every import-site that pulls a legacy symbol from @kehto/runtime's core-compat shim carries this marker."
  - "Widen-with-DRIFT-<ID> pattern for dispatcher entry points where a nub union's discriminants don't match the existing sub-action switch shape."

requirements-completed: [NUB-02]

# Metrics
duration: 11min
completed: 2026-04-17
---

# Phase 11 Plan 2: Nub Type Imports + Signer DRIFT Annotation Summary

**Replaced every hand-copied / `msg as any` NUB message type reference in `@kehto/runtime` with direct `import type` statements from `@napplet/nub-{storage,ifc,relay}`, annotated every signer.* call site across the 4 kehto packages with `// DRIFT-<ID> — Phase 12` markers grep-keyed to docs/v1.2-NIP-5D-AUDIT.md, and restored the pre-existing @napplet/core v1.1 export gap via a surgical DRIFT-CORE-06 — Phase 11-deviation shim — delivering clean `pnpm build`, `pnpm type-check`, and `vitest run` (170/170 tests) against the new peer-dep set.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-04-17T14:04:23Z
- **Completed:** 2026-04-17T14:16:04Z
- **Tasks:** 3
- **Files modified:** 16 source files + 1 new compat shim + 1 summary

## Accomplishments

- Replaced three `const m = msg as any;` widenings in `packages/runtime/src/runtime.ts`:
  - `handleRelayMessage:447` → `as unknown as RelayMessage & {subId?: string; filters?: NostrFilter[]; event?: NostrEvent; id?: string}` (DRIFT-RT-08 widening marker)
  - `handleIfcMessage:680` → `as unknown as IfcMessage & {topic?: string; payload?: unknown}` (DRIFT-RT-09 widening marker)
  - Dispatch envelope: `(envelope as any).id` → `(envelope as NappletMessage & { id?: string }).id`
- `handleSignerMessage:594` retains its `as any` cast; DRIFT-RT-07 — Phase 12 comment annotations now bracket both the function signature AND the cast.
- `packages/runtime/src/state-handler.ts#handleStorageNub` dropped its `msg as any` widening — now `as unknown as StorageMessage & { id?: string; key?: string; value?: string }` (DRIFT-ACL-08 annotation explains the per-branch storage.clear widening).
- Four `// DRIFT-ACL-0{5,6,7,8} — Phase 12` comments added to `packages/acl/src/resolve.ts` above the signer/relay/storage/ifc switch branches. @kehto/acl retains zero runtime deps (`dependencies: {}` unchanged; `grep -c "^import " packages/acl/src/resolve.ts` returns 0).
- Every signer.* call site in the services + runtime + shell source trees annotated:

| DRIFT ID | File:Line | Annotation Purpose |
|---|---|---|
| DRIFT-SVC-01 | packages/services/src/signer-service.ts:9 | File-level marker: migrate getPublicKey/getRelays to identity-service; delete signEvent/nip04/nip44 |
| DRIFT-SVC-07 | packages/services/src/signer-service.test.ts:9 | File-level marker: migrate test cases to identity-service.test.ts; delete signing/encryption cases |
| DRIFT-SVC-01 | packages/services/src/index.ts:44 | Above `createSignerService` re-export: replace with createIdentityService |
| DRIFT-RT-06 | packages/runtime/src/runtime.ts:757 | Above `case 'signer':` in dispatch switch |
| DRIFT-RT-06 | packages/runtime/src/dispatch.test.ts:565 | Above `signer.getPublicKey bypasses ACL` test |
| DRIFT-RT-07 | packages/runtime/src/runtime.ts:613 + 615 | Above handleSignerMessage function + above its `msg as any` cast |
| DRIFT-RT-10 | packages/runtime/src/runtime.ts:629 | Above serviceRegistry['signer'] lookup |
| DRIFT-SHELL-01 | packages/shell/src/shell-init.ts:16 | File-level: delete window.nostr injection |
| DRIFT-SHELL-02 | packages/shell/src/shell-init.ts:44 | Above buildShellCapabilities: route sandbox perms through perm:* namespace |
| DRIFT-SHELL-03 | packages/shell/src/shell-init.ts:17 | File-level: signing moves into shell-owned relay-publish paths |
| DRIFT-SHELL-04 | packages/shell/src/shell-init.ts:45 | Above buildShellCapabilities: replace signer-shaped nubs array with canonical 8-domain list |
| DRIFT-SHELL-04 | packages/shell/src/types.ts:214 | Above ShellCapabilities.nubs JSDoc: update to canonical 8-domain set |
| DRIFT-ACL-05 | packages/acl/src/resolve.ts:110 | Above `case 'signer':` — remove branch entirely in Phase 12 |
| DRIFT-ACL-06 | packages/acl/src/resolve.ts:106 | Above `case 'relay':` — split publish vs publishEncrypted |
| DRIFT-ACL-07 | packages/acl/src/resolve.ts:121 | Above `case 'ifc':` — extend for channel sub-protocol |
| DRIFT-ACL-08 | packages/acl/src/resolve.ts:117 | Above `case 'storage':` — drop storage.clear (not in @napplet/nub-storage) |

## Task Commits

1. **Task 1: Import nub types in runtime + add @napplet/core v1.1 compat shim** — `4113e88` (feat)
2. **Task 2: Annotate resolve.ts with DRIFT-ACL-05/06/07/08 Phase 12 markers** — `25b31ad` (feat)
3. **Task 3: Annotate signer.* sites across services/runtime/shell with DRIFT markers** — `78205c6` (feat)

**Plan metadata:** committed separately after STATE/ROADMAP/REQUIREMENTS updates.

## Files Created/Modified

Files changed per commit already captured in `key-files.modified` above and in the per-commit stats:

- **Task 1 (16 files, +246/-48):** Runtime package received the bulk of edits — core-compat shim (new), plus compat-import swaps across acl-state.ts, enforce.ts, event-buffer.ts, replay.ts, runtime.ts, service-discovery.ts, state-handler.ts, types.ts, index.ts; Services package (audio-service.ts, notification-service.ts) and Shell package (acl-store.ts, hooks-adapter.ts, index.ts, types.ts) swapped their @napplet/core imports over to @kehto/runtime.
- **Task 2 (1 file, +5):** packages/acl/src/resolve.ts — four single-line DRIFT comments + JSDoc table extension.
- **Task 3 (7 files, +15/-1):** shell-init.ts / signer-service.ts / signer-service.test.ts / services/index.ts / runtime.ts / dispatch.test.ts / shell/types.ts — annotation-only.

## Decisions Made

- **Rule 3 deviation — @napplet/core v1.1 compat shim.** @napplet/core v0.2.0+ (napplet phases 81 + 87) dropped `Capability`, `BusKind`, `ALL_CAPABILITIES`, `DESTRUCTIVE_KINDS`, `REPLAY_WINDOW_SECONDS`, `ServiceDescriptor`, `AUTH_KIND`, `SHELL_BRIDGE_URI`, `PROTOCOL_VERSION`, `TOPICS.STATE_*`, and `BusKindValue`. Plan 11-01's verification only exercised `pnpm install`, never `pnpm build` or `pnpm type-check`, so the regression surfaced at the start of Plan 11-02 execution. To keep Plan 11-02 in its declared scope ("swap hand-copied nub types for imports, annotate signer.* sites") while satisfying the success criterion "`pnpm build` exits 0", added a local transitional shim at `packages/runtime/src/core-compat.ts` that mirrors the v1.1 export shapes verbatim. Every consumer site imports through the shim and carries a `// DRIFT-CORE-06 — Phase 11-deviation` comment documenting the reason. Phase 12/14 will delete both the shim and its consumers alongside the v1.1 NIP-01 dispatch paths.
- **Cross-package re-export via @kehto/runtime barrel.** Rather than duplicating a compat shim in every package, the runtime barrel re-exports the v1.1 symbols; shell + services migrate via a single import-swap (from `@napplet/core` to `@kehto/runtime`).
- **Preserve surviving `msg as any` inside handleSignerMessage.** Narrowing would require introducing a signer-domain nub type, but the canonical 8-nub world has no signer domain. DRIFT-RT-07 — Phase 12 annotations above both the function and the cast make the intent grep-discoverable.
- **Widen-via-intersection for handleRelayMessage / handleIfcMessage.** Dispatch cleaves by sub-action string (`subscribe`, `publish`, `emit`, …), not by msg.type discriminant, so a per-branch narrow against the discriminated union requires Phase 12 handler rewrites. The transitional pattern is `msg as unknown as NubBase & { subId?: …; filters?: … }` — compact, compiles, annotated with the DRIFT-RT-08 / DRIFT-RT-09 markers already in the audit.
- **Skip DRIFT-SHELL-03 marker in shell-bridge.ts.** `grep -n "'signer'" packages/shell/src/shell-bridge.ts` returns 0 matches despite audit citing lines 165-170. The current shell-bridge does not carry a `'signer'` capability literal; audit line reference is stale, but the DRIFT-SHELL-03 remediation (remove signer advertisement) still applies via the shell-init.ts markers that were added. Documented in deviations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Add @napplet/core v1.1 compat shim (`DRIFT-CORE-06 — Phase 11-deviation`)**
- **Found during:** Task 1 baseline type-check
- **Issue:** `pnpm --filter @kehto/runtime type-check` failed before any Plan 11-02 edits with ~20 TS2305 / TS2339 errors in acl-state.ts, enforce.ts, event-buffer.ts, replay.ts, runtime.ts, service-discovery.ts, state-handler.ts, types.ts, services/audio-service.ts, services/notification-service.ts, shell/acl-store.ts, shell/hooks-adapter.ts, shell/index.ts, shell/types.ts. Root cause: @napplet/core v0.2.0+ no longer exports `Capability`, `BusKind`, `ALL_CAPABILITIES`, `DESTRUCTIVE_KINDS`, `REPLAY_WINDOW_SECONDS`, `ServiceDescriptor`, `AUTH_KIND`, `SHELL_BRIDGE_URI`, `PROTOCOL_VERSION`, `TOPICS.STATE_*`, `BusKindValue` — kehto src still references them. Plan 11-01's verification missed this because its automated verify path only ran `pnpm install`, not `pnpm build` / `pnpm type-check`.
- **Fix:** Created `packages/runtime/src/core-compat.ts` (98 lines, new file) with local definitions mirroring the v1.1 export shapes. Updated every consumer site across runtime + shell + services to import from either `./core-compat.js` (within runtime package) or `@kehto/runtime` (re-exported via the runtime barrel). Every swap carries `// DRIFT-CORE-06 — Phase 11-deviation` on the import line so Phase 12/14 can grep them and delete them alongside the v1.1 code paths.
- **Files modified:** 15 files across 3 packages (enumerated under `key-files.modified`)
- **Verification:** `pnpm build` + `pnpm type-check` at repo root both exit 0. `vitest run` — 170/170 tests pass.
- **Committed in:** `4113e88` (Task 1 commit; commit message documents the Rule 3 rationale)

**2. [Rule 3 - Blocking] Skip DRIFT-SHELL-03 annotation in shell-bridge.ts**
- **Found during:** Task 3 (shell-bridge.ts edit step)
- **Issue:** Plan's Task 3 action says: "Grep the file for `'signer'` (expected around lines 165-170 per audit DRIFT-SHELL-03). At each match, prepend … If no match exists, skip this file — audit row may be stale, document in SUMMARY." `grep -n "'signer'" packages/shell/src/shell-bridge.ts` returned 0 matches — no signer capability literal in the current shell-bridge source.
- **Fix:** Skipped the annotation in shell-bridge.ts per the plan's explicit skip-condition clause. DRIFT-SHELL-03 remediation (remove signer proxy surface) still applies — it's covered by the DRIFT-SHELL-03 marker in shell-init.ts where the window.nostr injection path lives.
- **Files modified:** None (deliberate no-op)
- **Impact:** DRIFT-SHELL-03 audit row cites packages/shell/src/shell-bridge.ts:165-170 but those lines no longer carry the signer literal — likely refactored between the audit and execution. The audit row's line citation is stale; the remediation itself is still tracked via shell-init.ts.

---

**Total deviations:** 2 auto-fixed (1 baseline breakage requiring compat shim, 1 stale audit line reference). Zero deviations required user escalation.

**Impact on plan:** Zero impact on stated outcomes — NUB-02 fully satisfied; DRIFT-CORE-05 closed; all DRIFT-<ID> annotations landed as specified. The compat shim adds surface area that Phase 12/14 explicitly delete, so it nets to zero long-term tech debt.

## Issues Encountered

No other issues. The napplet submodule is modified in the kehto working tree (pointing past the kehto-pinned napplet commit `06f26eca`) — this is the proximate cause of the Deviation #1 baseline breakage. Not changed by Plan 11-02; left for Phase 15 (release-prep) to decide whether to bump the submodule pin or stay linked against the live workspace.

## Deferred Issues

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Phase 12 (Shell Conformance + Seven-Nub Coverage)** has its complete DRIFT work list grep-reachable from kehto source: every DRIFT-ACL-05..08, DRIFT-RT-06/07/08/09/10, DRIFT-SVC-01/07, and DRIFT-SHELL-01/02/03/04 target site has a matching `// DRIFT-<ID> — Phase 12: …` comment in source. `grep -rE "DRIFT-(ACL|RT|SHELL|SVC)-[0-9]+ — Phase 12" packages/*/src/` returns 20+ matches.
- **Phase 13 (Theme Nub Implementation)** unaffected — Plan 11-02 did not touch any theme-domain code.
- **Phase 14 (Dispatch Refactor)** now has an additional deletion target: `packages/runtime/src/core-compat.ts` and all its DRIFT-CORE-06 — Phase 11-deviation marked consumers. Phase 14's dispatch rewrite subsumes the v1.1 NIP-01 code paths that still consume these legacy symbols.
- **No blockers or concerns** for downstream phases. Peer-dep set is clean, types resolve, 170/170 tests pass.

## Signer.* Sites Remaining (Phase 12 authoritative work list)

Phase 12 deletes everything in this table. Every row is grep-keyed to its DRIFT marker in source.

| Site | Annotation | Phase 12 action |
|---|---|---|
| packages/acl/src/resolve.ts `case 'signer':` | DRIFT-ACL-05 | Delete case; migrate getPublicKey/getRelays to identity; drop nip04/nip44/signEvent branches |
| packages/runtime/src/runtime.ts `handleSignerMessage` function (lines 613-693) | DRIFT-RT-07 | Delete the function; encryption primitives become private helpers for relay.publishEncrypted |
| packages/runtime/src/runtime.ts `serviceRegistry['signer']` lookup (line ~629) | DRIFT-RT-10 | Delete the branch |
| packages/runtime/src/runtime.ts `case 'signer':` in dispatch switch (line ~757) | DRIFT-RT-06 | Delete the case |
| packages/runtime/src/dispatch.test.ts `signer.getPublicKey bypasses ACL` test (line 566) | DRIFT-RT-06 | Replace with identity.getPublicKey test |
| packages/services/src/signer-service.ts (entire file) | DRIFT-SVC-01 | Migrate getPublicKey/getRelays to new identity-service.ts; delete signEvent + nip04/nip44 cases |
| packages/services/src/signer-service.test.ts (entire file) | DRIFT-SVC-07 | Migrate relevant tests to identity-service.test.ts; delete signing/encryption tests |
| packages/services/src/index.ts `createSignerService` re-export | DRIFT-SVC-01 | Replace with createIdentityService re-export |
| packages/shell/src/shell-init.ts `generateNostrBootstrap()` + `window.nostr` injection | DRIFT-SHELL-01, DRIFT-SHELL-03 | Delete entire function; add regression test asserting `window.nostr === undefined` |
| packages/shell/src/shell-init.ts `buildShellCapabilities` body | DRIFT-SHELL-02, DRIFT-SHELL-04 | Replace `['signer', 'storage', 'ifc']` with 8-domain list; route sandbox perms through `perm:` namespace |
| packages/shell/src/types.ts `ShellCapabilities.nubs` JSDoc | DRIFT-SHELL-04 | Update JSDoc to canonical 8-domain set |

## Read-First File Observations

- `packages/shell/src/shell-bridge.ts` lines 165-170 (cited by DRIFT-SHELL-03) no longer carry the expected `'signer'` capability literal — current source handles `shell.ready` / `shell.init` handshake but does not reference signer explicitly at that location. The DRIFT-SHELL-03 annotation was applied to the shell-init.ts bootstrap path instead (which DOES contain the window.nostr injection + signer postMessage surface that the audit row targets).
- All other `<read_first>` files matched the plan's expectations.

## Self-Check: PASSED

- packages/runtime/src/core-compat.ts exists — `test -f packages/runtime/src/core-compat.ts` → FOUND.
- packages/acl/src/resolve.ts `dependencies: {}` preserved — `grep -A1 '"dependencies"' packages/acl/package.json` → `{}`.
- 3 nub `import type` statements in packages/runtime/src/runtime.ts — FOUND (storage, ifc, relay).
- 1 `msg as any` remaining in packages/runtime/src/runtime.ts, with DRIFT-RT-07 — Phase 12 annotation immediately above it — FOUND.
- 0 `msg as any` in packages/runtime/src/state-handler.ts — FOUND.
- `(envelope as any).id` no longer present in runtime.ts — FOUND (replaced with `(envelope as NappletMessage & { id?: string }).id`).
- 0 plain `import { ... } from '@napplet/nub-*'` (without `type` keyword) in packages/runtime/src/ — FOUND.
- 4× DRIFT-ACL-05/06/07/08 — Phase 12 annotations in packages/acl/src/resolve.ts — FOUND (1 each).
- All 7 required Task 3 DRIFT annotations (SVC-01×2, SVC-07, RT-06×2, RT-07×2, RT-10, SHELL-01, SHELL-02, SHELL-03, SHELL-04×2) match acceptance counts — FOUND.
- Commits on main:
  - `4113e88` — FOUND.
  - `25b31ad` — FOUND.
  - `78205c6` — FOUND.
- `pnpm build` — exits 0.
- `pnpm type-check` — exits 0.
- `vitest run` — 170/170 tests pass.
- No unannotated hand-copied nub interface declarations in packages/*/src/ — FOUND (grep returns 0 matches).

---
*Phase: 11-nub-peer-deps-type-imports*
*Completed: 2026-04-17*
