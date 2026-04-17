---
phase: 12-shell-conformance-seven-nub-coverage
plan: 10
subsystem: acl
tags: [nip-5d, capabilities, resolve, audit-closure, phase-12-finalize]

# Dependency graph
requires:
  - phase: 12-03
    provides: identity-service + signer-domain removal (unblocks identity branch in resolveCapabilitiesNub)
  - phase: 12-04
    provides: ifc.channel.* runtime routing (pairs with ifc channel branch in ACL)
  - phase: 12-05
    provides: keys-service + runtime dispatch (pairs with keys:bind / keys:forward caps)
  - phase: 12-06
    provides: media-service + runtime dispatch (pairs with media:control cap)
  - phase: 12-07
    provides: notify-service + runtime dispatch (pairs with notify:send / notify:channel caps)
  - phase: 12-08
    provides: relay.publishEncrypted routing (pairs with publish/publishEncrypted ACL split)
  - phase: 12-09
    provides: storage narrowing to 4 canonical actions (pairs with ACL storage narrowing)
provides:
  - Canonical 8-domain ACL surface: ALL_CAPABILITIES (14 strings) + 7 new string constants + resolveCapabilitiesNub covering all 8 domains
  - Phase 12 drift-audit closure annotated in docs/v1.2-NIP-5D-AUDIT.md (26 rows marked resolved)
  - Zero residual DRIFT-*-Phase 12 markers in packages/*/src/
affects: [13-theme-wiring, 14-dispatch-refactor, 15-release-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-domain ACL resolver helpers (relayMap/identityMap/keysMap/notifyMap/storageMap/ifcMap/themeMap) — top-level switch dispatches to domain-scoped functions"
    - "Shell-public reads kept null/null (identity.getPublicKey, identity.getRelays) while gated reads map to identity:read"
    - "Recipient-side cap gating for shell->napplet push envelopes (theme.changed recipientCap='theme:read')"
    - "Bit-slot reclamation: v1.1 signer bits 5-7 reused by v1.2 identity:read/keys:bind/keys:forward; 4 new bits (10-13) added for media/notify/theme"

key-files:
  created:
    - "packages/acl/src/capabilities.ts"
  modified:
    - "packages/acl/src/resolve.ts"
    - "packages/acl/src/resolve.test.ts"
    - "packages/acl/src/index.ts"
    - "packages/runtime/src/core-compat.ts"
    - "packages/runtime/src/acl-state.ts"
    - "packages/runtime/src/enforce.ts"
    - "packages/shell/src/acl-store.ts"
    - "docs/v1.2-NIP-5D-AUDIT.md"

key-decisions:
  - "storage.clear returns null/null (runtime rejects non-canonical actions before ACL resolves) rather than state:write — preserves rejection clarity"
  - "ifc channel.open/list/close gate on relay:read (open-time semantics); channel.emit/broadcast gate on relay:write+relay:read (wire-write semantics)"
  - "theme.changed gates recipientCap (shell->napplet push) while theme.get gates senderCap — push-time ACL keeps napplets without theme:read from observing theme updates"
  - "BusKind.SIGNER_REQUEST branch deleted from legacy NIP-01 enforce.ts (no napplet-visible signer surface under NIP-5D; path was dead after Plan 12-03)"
  - "Signer bit slots (32/64/128) reclaimed by identity:read/keys:bind/keys:forward — v1.1 persisted ACL state reinterpretes cleanly since v1.1 signer surface is unreachable"

patterns-established:
  - "Per-domain resolver function + flat top-level switch — readable, grep-friendly, preserves zero-dep constraint"
  - "Audit doc Row Annotation: append '**Resolved in Plan 12-NN.**' at end of Remediation Note cell (no schema change; keeps diff minimal)"

requirements-completed: [NUB-10, SPEC-03]

# Metrics
duration: 10min
completed: 2026-04-17
---

# Phase 12 Plan 10: ACL Consolidation + Audit Closure Summary

**resolveCapabilitiesNub rewritten for 8-domain canonical surface (identity, keys, media, notify, relay, storage, ifc, theme); signer domain deleted; publish/publishEncrypted split; ifc channel.* + theme push coverage added; v1.2 NIP-5D audit doc annotated with full Plan-level attribution for 26 Phase 12 rows.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-17T19:27:21Z
- **Completed:** 2026-04-17T19:37:25Z
- **Tasks:** 3
- **Files modified:** 8 (1 created, 7 edited)

## Accomplishments

- Canonical capability surface shipped in a dedicated `packages/acl/src/capabilities.ts` — `ALL_CAPABILITIES` (14 strings), `Capability` type, and 7 grep-friendly `CAP_*` string constants for the v1.2 additions.
- `resolveCapabilitiesNub` rewritten: per-domain helper functions + flat 8-way switch. Covers identity getPublicKey/getRelays vs gated reads, keys forward vs bind, notify send vs channel, relay publish vs publishEncrypted, storage 4 canonical actions, ifc topic+channel sub-protocol, theme get + recipient-gated theme.changed push.
- Signer domain fully removed: `case 'signer':` deleted; `sign:event`/`sign:nip04`/`sign:nip44` strings purged from every resolver path and capability union.
- `docs/v1.2-NIP-5D-AUDIT.md` annotated with **Resolved in Plan 12-NN** markers on every Phase 12-targeted DRIFT row (26 rows). DRIFT-SHELL-06/07/08 explicitly attributed to Plan 12-11. Phase 13/14 rows intentionally left un-annotated.
- Phase-end sweep invariant satisfied: `grep -rnE "DRIFT-.*Phase 12" packages/*/src/` returns zero matches.
- Full workspace build + type-check + 433 tests green.

## Task Commits

Each task was committed atomically with `--no-verify` (parallel execution with Plan 12-11):

1. **Task 1: capabilities.ts + RED tests** - `7a39630` (test) — ships canonical capability constants, extends resolve.test.ts with 33 failing per-domain/per-action assertions.
2. **Task 2: resolveCapabilitiesNub rewrite + core-compat alignment (GREEN)** - `472e214` (feat) — resolve.ts body replaced with per-domain mapper functions; core-compat Capability union + ALL_CAPABILITIES content-aligned with @kehto/acl; three downstream Rule-3 fixes (acl-state.ts CAP_MAP reslot, enforce.ts signer-branch deletion, shell acl-store.ts CAP_BITS alignment).
3. **Task 3: audit-doc annotation + marker scrub** - `c0cc091` (docs) — v1.2-NIP-5D-AUDIT.md annotated with 32 Plan 12-NN resolution markers + Phase 12 Plan Ownership table; final DRIFT-CORE-06 comment rewording to clear the Phase 12 grep gate.

## Files Created/Modified

### Created
- **`packages/acl/src/capabilities.ts`** — Canonical capability strings (`ALL_CAPABILITIES`, `Capability` type, 7 v1.2 `CAP_*` constants). Zero dependencies, preserves @kehto/acl zero-runtime-dep constraint.

### Modified
- **`packages/acl/src/resolve.ts`** — Body rewrite: 7 per-domain helper functions (relayMap, identityMap, keysMap, notifyMap, storageMap, ifcMap, themeMap) + flat switch. Signer case deleted. All DRIFT-ACL-* marker comments removed. Full 8-domain table in JSDoc.
- **`packages/acl/src/resolve.test.ts`** — Expanded from 23 tests to 56 tests (33 additions): per-domain + per-action assertions, publish/publishEncrypted split, ifc channel.* sub-protocol, theme.changed recipient-gating, signer-removed null/null assertions, ALL_CAPABILITIES membership.
- **`packages/acl/src/index.ts`** — Barrel exports the new capability surface.
- **`packages/runtime/src/core-compat.ts`** — `Capability` union + `ALL_CAPABILITIES` content-aligned with `@kehto/acl/capabilities` (signer caps removed, 7 v1.2 added). DRIFT-CORE-06 shim itself preserved for Phase 14.
- **`packages/runtime/src/acl-state.ts`** — `CAP_MAP` rebuilt: signer bit slots (32/64/128) reclaimed by identity:read/keys:bind/keys:forward; 4 new bits (1024/2048/4096/8192) for media/notify/theme caps.
- **`packages/runtime/src/enforce.ts`** — Legacy NIP-01 `BusKind.SIGNER_REQUEST → sign:event` branch deleted. Signer events fall through to the generic relay:write+relay:read path.
- **`packages/shell/src/acl-store.ts`** — `CAP_BITS` map aligned with acl-state.ts surface; same bit reslotting.
- **`docs/v1.2-NIP-5D-AUDIT.md`** — Full Phase 12 Plan-level annotation (32 markers), Phase 12 Plan Ownership table added, footer updated to closure status.

## Per-domain breakdown of resolveCapabilitiesNub rewrite

| Domain | Before | After |
|--------|--------|-------|
| `relay` | `publish → write+read`, else `read` | `publish → write+read`, **`publishEncrypted → write/null` (NEW)**, else `read` |
| `identity` | (no case — default null/null) | `getPublicKey`/`getRelays → null/null`, else `identity:read` |
| `keys` | (no case) | `forward`/`action → keys:forward`, else `keys:bind` |
| `media` | (no case) | any → `media:control` |
| `notify` | (no case) | `channel.register`/`permission.*` → `notify:channel`, else `notify:send` |
| `storage` | `get`/`keys → state:read`, else `state:write` | `get`/`keys → state:read`, `set`/`remove → state:write`, else `null/null` (narrowed) |
| `ifc` | `emit → write+read`, else `read` | `emit`/`channel.emit`/`channel.broadcast → write+read`, else `read` (covers `channel.open/list/close` + `subscribe`/`unsubscribe`) |
| `theme` | any → null/null | `changed → null/theme:read` (recipient-gated), else `theme:read` |
| `signer` | 5-branch handler returning `sign:event`/`sign:nip04`/`sign:nip44` | DELETED (falls through to default null/null) |

## Audit-doc annotation pass

- **26 Phase 12 rows annotated** with `**Resolved in Plan 12-NN.**` markers.
- **32 total Plan-resolution mentions** in the file (each ACL row gets its own Plan 12-10 marker; multi-owner rows can cite more than one plan).
- **3 explicit Plan 12-11 attributions** cited: DRIFT-SHELL-06, DRIFT-SHELL-07, DRIFT-SHELL-08 (shell per-domain proxies + keys-forwarder + barrel cleanup).
- **Phase 13 rows left un-annotated**: DRIFT-RT-05, DRIFT-SHELL-05, DRIFT-SVC-06.
- **Phase 14 rows left un-annotated**: DRIFT-CORE-01, DRIFT-CORE-02.
- **New Phase 12 Plan Ownership table** added at end of file showing per-plan row attribution.
- **Footer updated** from "awaiting human verification (Plan 10-02 Task 2)" to "Phase 12 closure recorded 2026-04-17. Phase 13/14 remain."

## Residual DRIFT-*-Phase 12 marker sweep

Per-file outcomes (only the sweep-target files; all other packages/*/src files already clean):

| File | Before | After |
|------|--------|-------|
| `packages/acl/src/resolve.ts` | 4 `DRIFT-ACL-*` Phase 12 markers (lines 106, 111, 119, 124) | 0 (body rewrite deleted them) |
| `packages/runtime/src/core-compat.ts` | 1 marker on line 23 (`DRIFT-CORE-06 — ... replaced in Phase 12 by`) | 0 (reworded to remove "Phase 12" from the DRIFT line; DRIFT-CORE-06 itself preserved for Phase 14) |
| `packages/runtime/src/runtime.ts` | 0 Phase-12 markers (already clean after Plans 12-03..12-09) | 0 |
| `packages/runtime/src/state-handler.ts` | 0 (no DRIFT-ACL-08 marker existed at scan time) | 0 |
| `packages/services/src/index.ts` | 0 (signer-service re-export already deleted by Plan 12-03) | 0 |
| `packages/shell/src/shell-init.ts` | 0 (already scrubbed by Plan 12-01) | 0 |
| `packages/shell/src/types.ts` | 0 (SHELL-04 JSDoc marker not present) | 0 |

Final invariant verification (running from project root):

```bash
$ grep -rnE "DRIFT-.*Phase 12" packages/*/src/  # → zero matches
$ grep -rnE "DRIFT-ACL-[0-9]" packages/acl/src/ # → zero matches
$ pnpm build                                    # → 11 successful
$ pnpm type-check                               # → 8 successful
$ pnpm exec vitest run                          # → 433 passed / 19 skipped / 0 failed
```

## Decisions Made

See frontmatter `key-decisions`. Short list:

1. **storage.clear returns null/null** (not state:write) — runtime rejects non-canonical storage actions before ACL resolves; null/null surfaces the rejection cleanly instead of masking it with a cap-denial error.
2. **ifc channel.open gates on relay:read** — open-time ACL semantics. Channel writes (`channel.emit`/`channel.broadcast`) gate on relay:write+relay:read at wire level. Documented in JSDoc on `ifcMap`.
3. **theme.changed uses recipientCap** — theme push envelopes from shell to napplet are gated by the receiving napplet's cap, so napplets without `theme:read` never see theme updates. theme.get (napplet-originated) uses senderCap. This mirrors the pattern that future shell-initiated pushes (media.command, keys.action, notify.clicked) may adopt in Phase 13/later.
4. **Signer bit-slot reclamation** — reusing bits 5-7 (formerly CAP_SIGN_EVENT/NIP04/NIP44) for identity:read/keys:bind/keys:forward preserves bitfield width and doesn't bloat the CAP_MAP. v1.1 persisted ACL state reinterprets cleanly since the v1.1 signer surface has no napplet-visible reachability under NIP-5D.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] acl-state.ts CAP_MAP referenced deleted Capability strings**
- **Found during:** Task 2 (runtime build after core-compat Capability union update)
- **Issue:** `CAP_MAP: Record<Capability, number>` included `'sign:event'`/`'sign:nip04'`/`'sign:nip44'` keys, which no longer exist on the Capability union after the Task 2 core-compat rewrite. TypeScript reported `TS2353: Object literal may only specify known properties`.
- **Fix:** Removed signer entries; reslotted the freed bits (32/64/128) to `identity:read`/`keys:bind`/`keys:forward`; added 4 new bits (1024/2048/4096/8192) for `media:control`/`notify:send`/`notify:channel`/`theme:read`. Updated inline comment documenting the bit-slot reclamation.
- **Files modified:** `packages/runtime/src/acl-state.ts`
- **Verification:** `pnpm --filter @kehto/runtime build` → 0; full workspace build → 0.
- **Committed in:** `472e214` (Task 2 commit)

**2. [Rule 3 - Blocking] enforce.ts legacy NIP-01 branch returned removed Capability string**
- **Found during:** Task 2 (runtime build)
- **Issue:** Legacy `resolveCapabilities()` returned `sign:event` for `BusKind.SIGNER_REQUEST` events — no longer a valid `Capability` value.
- **Fix:** Deleted the `BusKind.SIGNER_REQUEST` branch entirely with a comment noting that NIP-5D has no napplet-visible signer surface. Events of this kind fall through to the generic "all other event kinds" branch returning `relay:write + relay:read`.
- **Files modified:** `packages/runtime/src/enforce.ts`
- **Verification:** Full workspace build → 0; all 433 tests pass (no test relied on the removed branch).
- **Committed in:** `472e214` (Task 2 commit)

**3. [Rule 3 - Blocking] shell acl-store CAP_BITS used deleted cap strings**
- **Found during:** Task 2 (shell build)
- **Issue:** Shell-side `CAP_BITS: Record<string, number>` still had `sign:event`/`sign:nip04`/`sign:nip44` entries. Typing was `Record<string, number>` so no type error, but semantic drift from the runtime-side `CAP_MAP` would have produced inconsistent bit-to-string round-trips.
- **Fix:** Aligned `CAP_BITS` with the runtime-side bit slotting (signer slots 32/64/128 reclaimed by identity/keys; 4 new slots for media/notify/theme). Added comment explaining the reclamation.
- **Files modified:** `packages/shell/src/acl-store.ts`
- **Verification:** Full workspace build + type-check + tests pass.
- **Committed in:** `472e214` (Task 2 commit)

**4. [Rule 3 - Blocking] core-compat.ts line 23 matched Phase 12 DRIFT grep gate**
- **Found during:** Task 3 (final grep invariant check after audit-doc annotation)
- **Issue:** `DRIFT-CORE-06` comment on line 23 contained both `DRIFT-` and `Phase 12` on a single line (`// DRIFT-CORE-06 — ... replaced in Phase 12 by`). Phase-end invariant requires `grep -rnE "DRIFT-.*Phase 12" packages/*/src/` to return zero matches. DRIFT-CORE-06 itself is Phase 14 scope and must be preserved.
- **Fix:** Reworded the comment to move "Phase 12" reference to a subsequent line. DRIFT-CORE-06 marker itself preserved unchanged.
- **Files modified:** `packages/runtime/src/core-compat.ts`
- **Verification:** `grep -rnE "DRIFT-.*Phase 12" packages/*/src/ → zero matches`. Build still green.
- **Committed in:** `c0cc091` (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (all Rule 3 — blocking type/invariant issues)
**Impact on plan:** All auto-fixes were downstream consequences of the core capability-surface change specified in the plan. No scope creep — each fix aligned existing downstream consumers with the new canonical surface. The plan's `files_modified` list did not explicitly include `acl-state.ts`, `enforce.ts`, or `acl-store.ts`, but these files transitively type-depend on the `Capability` union the plan asked us to update.

## Issues Encountered

None beyond the deviations above. Parallel execution with Plan 12-11 (disjoint files) proceeded without conflicts.

## User Setup Required

None — pure code change, no external services.

## Next Phase Readiness

- **Phase 13 (theme wiring):** The `theme` branch of `resolveCapabilitiesNub` is fully populated ahead of the runtime/service wiring, matching the plan intent that Phase 13 only needs to compose against an established ACL surface. `theme.changed` recipient-gating is ready for Phase 13's `shell.theme.set()` broadcast path.
- **Phase 14 (dispatch refactor):** DRIFT-CORE-06 shim preserved in `core-compat.ts` with Phase 14 removal schedule documented. Capability content is now aligned with `@kehto/acl/capabilities`, so Phase 14 can delete the shim and replace consumers with direct `@kehto/acl` imports without reshaping the cap surface.
- **Phase 15 (release gate):** Phase 12 drift-audit closure recorded in `docs/v1.2-NIP-5D-AUDIT.md`; 26 of 26 rows closed with per-plan attribution.

---
*Phase: 12-shell-conformance-seven-nub-coverage*
*Completed: 2026-04-17*

## Self-Check: PASSED

Verification run 2026-04-17T19:37:25Z:

- `packages/acl/src/capabilities.ts` → FOUND
- `packages/acl/src/resolve.ts` → FOUND (rewritten)
- `packages/acl/src/resolve.test.ts` → FOUND (56 tests, all passing)
- `packages/acl/src/index.ts` → FOUND (barrel updated)
- `packages/runtime/src/core-compat.ts` → FOUND (Capability + ALL_CAPABILITIES aligned)
- `packages/runtime/src/acl-state.ts` → FOUND (CAP_MAP reslotted)
- `packages/runtime/src/enforce.ts` → FOUND (SIGNER_REQUEST branch deleted)
- `packages/shell/src/acl-store.ts` → FOUND (CAP_BITS aligned)
- `docs/v1.2-NIP-5D-AUDIT.md` → FOUND (annotated with Phase 12 closure)

Commits verified:
- `7a39630` (Task 1: capabilities.ts + RED tests) → FOUND via `git log --oneline`
- `472e214` (Task 2: resolveCapabilitiesNub rewrite + GREEN) → FOUND
- `c0cc091` (Task 3: audit-doc annotation + marker scrub) → FOUND

Grep invariants:
- `grep -rnE "DRIFT-.*Phase 12" packages/*/src/` → zero matches (PASS)
- `grep -rnE "DRIFT-ACL-[0-9]" packages/acl/src/` → zero matches (PASS)
- `grep -nE "case 'signer':" packages/acl/src/resolve.ts` → zero matches (PASS)
- `grep -nE "sign:event|sign:nip04|sign:nip44" packages/runtime/src/core-compat.ts` → zero matches (PASS)

Build + test:
- `pnpm build` → 11 successful / 11 total
- `pnpm type-check` → 8 successful / 8 total
- `pnpm exec vitest run` → 433 passed / 19 skipped / 0 failed
