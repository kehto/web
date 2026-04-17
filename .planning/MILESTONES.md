# Milestones: Kehto Runtime

## Completed

### v1.0: NIP-5D Migration & Gap Analysis

**Shipped:** 2026-04-07
**Phases:** 5 | **Plans:** 7 | **Requirements:** 17/17

**Key Accomplishments:**

1. Gap analysis with wire format before/after for 19 NUB message types and 6 silent failure points
2. ACL identity key schema migration design (pubkey:dTag:hash → dTag:hash) with localStorage migration utility
3. NUB domain-prefix dispatch design replacing NIP-01 verb switch, AUTH removal inventory (~24% of runtime.ts)
4. SessionEntry identity anchor: Option B (empty string + identitySource discriminant)
5. Shell migration: window.nostr injection via postMessage handshake, shell.supports() capability advertisement
6. All 6 service handler migrations from NIP-01 arrays to NappletMessage envelopes

**Deliverables:**

- `docs/GAP-ANALYSIS.md` (567 lines)
- `docs/ACL-MIGRATION.md` (346 lines)
- `docs/RUNTIME-MIGRATION.md` (897 lines)
- `docs/SHELL-MIGRATION.md` (663 lines)
- `docs/SERVICES-MIGRATION.md` (1023 lines)

**Archive:** [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) | [v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)

### v1.1: NIP-5D Migration Implementation

**Shipped:** 2026-04-07
**Phases:** 4 | **Plans:** 8 | **Requirements:** 16/16

**Key Accomplishments:**

1. @kehto/acl: 2-segment identity keys, NUB domain resolution, localStorage migration (75 tests)
2. @kehto/runtime: NUB dispatch (envelope-only), AUTH removed (~269 lines), 4 domain handlers (61 tests)
3. @kehto/shell: Envelope-only guard, window.nostr injection, capability advertisement, ACL migration trigger
4. @kehto/services: All 6 handlers migrated to NappletMessage envelope format (34 tests)

**Archive:** [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) | [v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md)

### v1.2: NIP-5D Conformance & Full NUB Coverage

**Shipped:** 2026-04-17
**Phases:** 6 | **Plans:** 19 | **Requirements:** 26/26

**Delivered:** Kehto fully conforms to the canonical NIP-5D spec (`dskvr/nips` branch `nip/5d`) and covers all 8 napplet NUB domains end-to-end with formal `createDispatch()`/`registerNub()`/`dispatch()` routing.

**Key Accomplishments:**

1. Canonical NIP-5D pinned at `specs/NIP-5D.md` (byte-identical to `dskvr/nips` nip/5d); README `## Specification` section anchors the sync source. Cross-package drift audit (`docs/v1.2-NIP-5D-AUDIT.md`, 40 DRIFT rows across 5 stable namespaces) closes SPEC-01/02/03.
2. Shell conformance: hard-deleted `window.nostr` injection (reversed v1.1 `SH-I02`), introduced `perm:<permission>` namespace for sandbox permissions via `shell.supports()`, routed signing/encryption through shell-internal `relay.publish` / `relay.publishEncrypted` (NIP-44 default, NIP-04 opt-in).
3. All 8 napplet nub packages consumed as peer deps at `^0.2.0`; every hand-copied NUB type migrated to `import type { ... } from '@napplet/nub-<domain>'`. `@napplet/core` range bumped `>=0.1.0` → `^0.2.0`.
4. Seven non-theme nubs (identity, ifc, keys, media, notify, relay, storage) fully dispatched with reference services; signer domain split (identity takes read-only pubkey/relays; sign/encrypt subsumed into relay.publishEncrypted) and removed entirely.
5. Theme NUB implemented end-to-end: runtime dispatch + reference service + shell adapter API (`bridge.publishTheme`) + ACL enforcement test. All 8 domains now covered.
6. Dispatch refactor: hand-rolled switch replaced with napplet/core's `createDispatch()` + 8 `registerNub()` calls using per-runtime instance + closure-scoped `windowId` bridge. Zero domain-specific branching remains in `runtime.ts`.
7. Shell per-domain proxies + keys-forwarder (host→napplet keydown pump) + barrel cleanup (5 new proxies exported; no signer residuals).

**Validation:** 449 tests passing / 0 skipped; `pnpm build` + `pnpm type-check` green; 4 changesets staged (`.changeset/v1-2-{acl,runtime,shell,services}.md`, all minor bumps).

**Known intentional debt:**
- `packages/runtime/src/core-compat.ts` (DRIFT-CORE-06) preserves `@napplet/core` v0.1 legacy exports. Preserved intentionally until napplet/core restores the symbols upstream.

**Archive:** [v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) | [v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md) | [v1.2-MILESTONE-AUDIT.md](milestones/v1.2-MILESTONE-AUDIT.md)
