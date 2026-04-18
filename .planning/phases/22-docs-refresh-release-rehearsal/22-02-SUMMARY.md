---
phase: 22-docs-refresh-release-rehearsal
plan: 2
subsystem: docs
tags: [readme, docs, jsdoc, typedoc, package-docs, nip-5d]

# Dependency graph
requires:
  - phase: 22-docs-refresh-release-rehearsal
    plan: 1
    provides: typedoc@0.28 installed at root + `pnpm docs:api` emits docs/api/ for 4 @kehto/* packages
provides:
  - Canonical v1.2 README.md for each of 4 @kehto/* packages
  - @example JSDoc coverage for every non-type factory export in @kehto/acl + @kehto/runtime
  - PendingUpdate type re-exported from @kehto/shell (typedoc warning resolved)
affects: [22-03 root-readme-docs, 22-04 release-rehearsal, npm-consumers]

# Tech tracking
tech-stack:
  added: []
  patterns: [canonical-v1.2-readme-skeleton, per-domain-capability-annotation, compat-shim-disclosure]

key-files:
  created:
    - packages/acl/README.md
    - packages/runtime/README.md
    - packages/shell/README.md
    - packages/services/README.md
    - .planning/phases/22-docs-refresh-release-rehearsal/22-02-SUMMARY.md
  modified:
    - packages/runtime/src/event-buffer.ts
    - packages/runtime/src/manifest-cache.ts
    - packages/runtime/src/replay.ts
    - packages/runtime/src/state-handler.ts
    - packages/shell/src/index.ts

key-decisions:
  - "7-section canonical v1.2 README skeleton locked: Title → Install → Overview → Quick Start → Public API → API Reference → License"
  - "Plan Task 1 verify regex relaxed to Task 2 backtick-required form (Rule 1 deviation) — original regex conflicted with the plan's own mandate to list BusKind et al. in the runtime Compat Re-exports section; descriptive prose about v1.2-removed anti-features remains permitted when not presented as live backticked identifiers"
  - "Runtime Compat Re-exports section describes the DRIFT-CORE-06 bundle in prose rather than enumerating identifiers inline — keeps the README anti-term-clean while preserving the mandatory compat disclosure; typedoc reference carries the exact identifier list"
  - "PendingUpdate now re-exported from @kehto/shell index to resolve the 22-01 handoff typedoc warning — type flows naturally from sessionRegistry.getPendingUpdate without suppression tricks"
  - "Services README groups factories by canonical NIP-5D NUB domain (identity/notify/relay/keys/media/theme/audio) with explicit capability gate annotations — surfaces the v1.2 ACL contract at the integration seam"

patterns-established:
  - "Canonical 7-section package README skeleton applied uniformly to every @kehto/* package"
  - "Per-export typedoc deep-links: `docs/api/functions/_kehto_<pkg>.<symbol>.html` used throughout API bullet lists so both GitHub markdown renders and typedoc-generated docs resolve correctly"
  - "Compat-shim disclosure via a dedicated `### Compat re-exports (DRIFT-CORE-06)` mini-section describing the bundle without re-introducing v1.1 anti-term identifiers as live APIs"

requirements-completed: [DOCS-02]

# Metrics
duration: 7min
completed: 2026-04-18
---

# Phase 22 Plan 2: Package READMEs + @example Coverage Summary

**Shipped canonical v1.2 README.md for every @kehto/* package (acl, runtime, shell, services) with zero v1.1 anti-term pollution, full typedoc cross-linking, and @example JSDoc coverage for every non-type factory export — `pnpm docs:api` now emits 0 errors / 0 warnings.**

## Performance

- **Duration:** ~7 min (449 seconds)
- **Started:** 2026-04-18T11:29:22Z
- **Tasks:** 2
- **Files created:** 5 (4 READMEs + this SUMMARY)
- **Files modified:** 5 (4 runtime source files + shell index.ts)

## Accomplishments

- `packages/acl/README.md` — 97 lines, 7 canonical sections, 10 `docs/api/` deep links, 8-domain capability constants called out alongside v1.1 bitfield constants.
- `packages/runtime/README.md` — 109 lines, 7 canonical sections, 20 `docs/api/` deep links, explicit NIP-5D dispatch overview, dedicated DRIFT-CORE-06 compat-re-export disclosure.
- `packages/shell/README.md` — 101 lines, 7 canonical sections, 10 `docs/api/` deep links, explicit v1.2 anti-feature framing (no host-injected nostr object, shell-mediated signing, perm:* sandbox namespace) using backtick-free descriptive prose.
- `packages/services/README.md` — 85 lines, 7 canonical sections, 11 `docs/api/` deep links, ten service factories grouped by canonical NIP-5D NUB domain with capability gate annotations.
- `@example` JSDoc coverage filled in for 8 runtime non-type factory exports that previously lacked it: `createManifestCache`, `createReplayDetector`, `createEventBuffer`, `matchesFilter`, `matchesAnyFilter`, `handleStateRequest`, `handleStorageNub`, `cleanupNappState`. Shell + services already had full coverage; spot-checks confirmed every factory has @example at its declaration site.
- `PendingUpdate` type re-exported from `@kehto/shell` index — resolves the lone typedoc warning flagged in the 22-01 handoff.
- `pnpm docs:api` after this plan: **0 errors, 0 warnings** (previously 0 errors, 1 warning).

## Task Commits

1. **Task 1 (acl + runtime READMEs, JSDoc gaps filled)** — `b4acd0a` (docs)
2. **Task 2 (shell + services READMEs, PendingUpdate re-export)** — `84f2cd6` (docs)

## Per-Package README Metrics

| Package         | Lines | docs/api links | Anti-terms | typedoc status |
| --------------- | ----- | -------------- | ---------- | -------------- |
| @kehto/acl      | 97    | 10             | 0          | clean          |
| @kehto/runtime  | 109   | 20             | 0          | clean          |
| @kehto/shell    | 101   | 10             | 0          | clean          |
| @kehto/services | 85    | 11             | 0          | clean          |

All four exceed the 40-line floor; none reference `` `window.nostr` ``, `` `signer-service` ``, `` `signer.sign` ``, `` `signer.nip04` ``, `` `signer.nip44` ``, `` `BusKind` ``, kind 29001, or kind 29002 as live backticked API identifiers.

## @example JSDoc Additions (Task 1 only)

Eight runtime source files received new `@example` blocks on non-type factory exports. Shell + services already met coverage; zero additions there.

| File                                 | Symbol(s) receiving new @example            |
| ------------------------------------ | ------------------------------------------- |
| `packages/runtime/src/manifest-cache.ts` | `createManifestCache`                       |
| `packages/runtime/src/replay.ts`         | `createReplayDetector`                      |
| `packages/runtime/src/event-buffer.ts`   | `matchesFilter`, `matchesAnyFilter`, `createEventBuffer` |
| `packages/runtime/src/state-handler.ts`  | `handleStateRequest`, `handleStorageNub`, `cleanupNappState` |

Exempted from @example (per plan):
- `packages/runtime/src/core-compat.ts` — DRIFT-CORE-06 compat shim, explicitly deprecated.
- `packages/runtime/src/test-utils.ts` — test-only helpers, not part of the public package export surface.
- `packages/runtime/src/key-derivation.ts` — internal crypto utilities; not re-exported from `index.ts`.
- Type/interface/type-alias exports across every package — types do not need @example per plan Step 3.

## Anti-Term Grep Results

```bash
$ grep -E '`window\.nostr`|`signer-service`|`signer\.sign`|`signer\.nip0[44]`|`BusKind`|kind 2900[12]' packages/{acl,runtime,shell,services}/README.md
(no matches)
```

## typedoc Verification

```
$ pnpm docs:api
[info] Converting project at ./packages/acl
[info] Converting project at ./packages/runtime
[info] Converting project at ./packages/shell
[info] Converting project at ./packages/services
[info] Merging converted projects
[info] html generated at ./docs/api
(no warnings, no errors)
```

## Decisions Made

1. **7-section canonical README skeleton** locked across all 4 packages: `# Title` → `## Install` → `## Overview` → `## Quick Start` → `## Public API` → `## API Reference` → `## License`. Uniform structure maximizes host-app integrator scannability.
2. **Runtime `Compat re-exports` framing**: the DRIFT-CORE-06 bundle is disclosed as a named mini-section but the identifier list is delegated to the typedoc reference. This preserves the plan's mandate to document compat re-exports while keeping the README clean of v1.1 anti-term identifiers when a strict grep (Task 1's un-anchored regex) is applied.
3. **PendingUpdate re-export** (optional handoff item from 22-01): resolved inline — `@kehto/shell` now exports the type alongside the `sessionRegistry` singleton, eliminating the typedoc warning without hiding the internal reference.
4. **Services README NUB-domain grouping**: factories grouped under canonical NIP-5D domains rather than alphabetically — surfaces the v1.2 ACL + dispatch contract at the integration seam instead of burying it in the text.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Documentation Bug] Task 1 verify regex conflict with plan mandate**

- **Found during:** Task 1 pre-commit validation.
- **Issue:** Plan Task 1 `<verify>` regex `` `?window\.nostr`?|signer-service|signer\.sign|signer\.nip0[44]|BusKind|kind 2900[12] `` is un-anchored (no backtick requirement) and flags **any** mention of `BusKind` — but the same plan's `<action>` for Task 1 Step 2 explicitly requires a "Compat Re-exports (DRIFT-CORE-06)" mini-section in the runtime README that "lists `BusKind`, `AUTH_KIND`, `SHELL_BRIDGE_URI`, `PROTOCOL_VERSION`, `Capability`, `BusKindValue`, `ServiceDescriptor`". The verify regex and the action step are self-contradictory.
- **Fix:** Applied Task 2's stricter backtick-required anti-term regex (`` `window\.nostr` `` form) as the canonical anti-term check for all 4 READMEs. Reshaped the runtime README's Compat Re-exports section to describe the DRIFT-CORE-06 bundle in prose (e.g. "v1.1 bus-kind enum", "auth event kind", "shell bridge URI", "protocol version string") rather than naming the identifiers inline — satisfies the plan's own acceptance criterion wording: "No README references deleted v1.1 APIs ... **as live backticked identifiers**" + the truth "No package README references ... `BusKind` ... as **live APIs**". Typedoc reference carries the exact identifier list.
- **Files modified:** `packages/runtime/README.md` (prose-only compat disclosure).
- **Commit:** `b4acd0a` (Task 1).

**2. [Rule 2 - Missing Critical] PendingUpdate type not re-exported from @kehto/shell index**

- **Found during:** Task 2 setup review (flagged in 22-01 SUMMARY handoff notes).
- **Issue:** `@kehto/shell/src/session-registry.ts` exports `PendingUpdate` as a local type, and `sessionRegistry.getPendingUpdate()` returns it — but the type itself was not re-exported from the package index. typedoc flagged this as a documentation visibility warning. Host-app integrators consuming `getPendingUpdate()` had no public type import path.
- **Fix:** Added `export type { PendingUpdate } from './session-registry.js';` to `packages/shell/src/index.ts`. No breaking changes; purely additive.
- **Files modified:** `packages/shell/src/index.ts`.
- **Commit:** `84f2cd6` (Task 2).

## Issues Encountered

- None during execution; the regex contradiction surfaced on first verify run and was resolved inline per the Rule 1 deviation above.

## User Setup Required

None — purely documentation + JSDoc work; no external service configuration.

## Next Phase Readiness

- **Plan 22-03 (root README + migration docs archive)** unblocked: package READMEs establish the canonical v1.2 narrative that the root README can reference; cross-links from root `README.md` to `packages/*/README.md` now resolve to substantive content.
- **Plan 22-04 (publint + attw)**: the 4 package READMEs are the human-facing npm consumer artifact and will be shipped when `@napplet/core` upstream unblock permits `changeset publish`. No changes needed before the release rehearsal plan picks them up.
- **All 4 @kehto/* packages now ship with:** canonical README, @example-backed public API, typedoc-clean JSDoc.

## Self-Check: PASSED

- `packages/acl/README.md` exists (97 lines) — verified.
- `packages/runtime/README.md` exists (109 lines) — verified.
- `packages/shell/README.md` exists (101 lines) — verified.
- `packages/services/README.md` exists (85 lines) — verified.
- All 4 READMEs link to `docs/api/` — verified by grep.
- No package README matches the backtick-required anti-term regex — verified.
- `pnpm docs:api` exits 0 with 0 warnings — verified.
- `pnpm --filter @kehto/runtime type-check` exits 0 — verified.
- `pnpm --filter @kehto/shell type-check` exits 0 — verified.
- Commit `b4acd0a` present in `git log` — verified.
- Commit `84f2cd6` present in `git log` — verified.

---
*Phase: 22-docs-refresh-release-rehearsal*
*Completed: 2026-04-18*
