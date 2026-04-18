# Milestones: Kehto Runtime

## v1.3 Demo Functional & Playwright Parity (Shipped: 2026-04-18)

**Phases completed:** 7 phases, 43 plans, 68 tasks

**Key accomplishments:**

- Seven obsolete v1.1 signer/AUTH/BusKind spec files deleted from tests/e2e/, leaving an 11-spec v1.2-aligned baseline with zero anti-term hits
- @playwright/test bumped to ^1.54.0 (resolved 1.59.1), playwright.config.ts migrated to array-form webServer with harness :4173 + demo :4174, and turbo build:napplets pipeline task wired into @kehto/demo#build
- Shipped waitForNappletReady + aclBeforeEach Playwright helpers under tests/e2e/helpers/ barrel, and sanity-migrated acl-enforcement.spec.ts to use the shared fixture (4 inline setup lines replaced by 1 helper call)
- Purged all BusKind/AUTH_KIND/window.nostr/signer-service/kind===29001 references from 9 apps/demo/src files; renamed DemoProtocolPath union to canonical identity-request/relay-publish-signed; wired notification-demo to ifc.emit envelopes
- `createDemoHooks()` extended from 2 to 5 registered services (+ 3 topology-only); all 8 NIP-5D topology nodes visible on boot with stub-only visual markers on keys/media
- Post-connect identity.getPublicKey diagnostic probe routed through real identity ServiceHandler; test-sign button calls signer.signEvent host-internally — zero window.nostr surface in demo
- MessageTap extended with NIP-5D envelope capture; debugger/flow-animator/sequence-diagram rewired to display and route on literal envelope `type` strings instead of NIP-01 verb+BusKind lookups
- 1. [Rule 1 - Bug] Fixed Capability type arrays referencing deleted v1.1 capabilities
- SATISFIED
- Bot napplet rewritten from raw NIP-01 window.addEventListener AUTH to @napplet/sdk async init() pattern; ipc and storage exercised end-to-end; #status-text posts 'authenticated' after shim AUTH resolves
- Chat napplet rewritten from raw window.addEventListener NIP-01 dispatch to @napplet/sdk (ipc.emit/on + storage), with #chat-status DOM hook for E2E auth assertions after shim AUTH completes
- Two Playwright Layer-B specs locking the @napplet/sdk migration: napplet-auth asserts both iframes reach 'authenticated', ifc-roundtrip proves the chat→bot→chat ipc envelope path end-to-end at :4174
- Full 20-test v1.3 Layer-B suite passed on first build+run iteration — SDK migration from Plans 18-01..03 is regression-free with zero fix cycles needed
- @kehto/demo-composer napplet skeleton and SDK-wired main.ts exercising relay.publish + relay.publishEncrypted (NIP-44) with deterministic D-02 DOM contract
- One-liner:
- @kehto/demo-toaster buildable napplet dispatching notify.create/list/dismiss NIP-5D envelopes via raw window.parent.postMessage with a single narrowly-guarded message handler (Plan 19-03 SDK gap deviation)
- 4 Layer-B Playwright specs locking NAP-03/04/05 contracts with frame.evaluate click pattern for sandboxed cross-origin iframes and NIP-5D session pre-registration fix in demo shell-host.
- One-liner:
- v1.3 Layer-B suite (13 specs, 27 tests) fully green via 3-iteration loop that fixed nub-relay relay.publish.error handling and turbo cache poisoning from external workspace packages
- In-memory SimplePool-shaped mock relay pool with 5 kind:1 fixture events, wired into createDemoHooks() to unblock feed napplet relay.subscribe delivery
- feed napplet (@kehto/demo-feed) — relay.subscribe to { kinds:[1], limit:5 } with DOM sentinel connecting->authenticated->subscribed->loaded(5) and #feed-list rendering 5 fixture events from the Phase 20-01 mock relay pool
- profile-viewer napplet wiring identity.getPublicKey + identity.getProfile with 'connecting...' -> 'authenticated' -> 'loaded' DOM sentinel and truncated pubkey display
- One-liner:
- File 1: `apps/demo/napplets/preferences/index.html`
- DEMO_NAPPLETS extended to 8 entries, demo.publishTheme listener bridges theme-switcher postMessage to relay.publishTheme fan-out, completing the theme-broadcast round-trip and NAP-09 coverage gate
- 3 serial-mode Layer-B Playwright specs covering feed relay.subscribe, profile-viewer identity.getPublicKey, and theme-switcher → preferences theme.changed round-trip — all asserting against demo at :4174
- 4-cycle iteration loop closes Phase 20: 5 root-cause fixes (registry fan-out, identity response, relay observable, debugger display, stale spec) achieve 39 E2E specs green with NAP-09 6-domain coverage gate satisfied
- Six SDK-based fixture napplets (nub-identity/ifc/notify/relay/storage/theme) scaffolded, built clean to dist/, and registered in pnpm workspace; turbo.json build:napplets extended to track fixture dist outputs
- nub-identity.spec.ts
- 1. [Rule 1 - Bug] handler.descriptor required by runtime.registerService()
- Total iterations:
- 1. [Rule 1 - Documentation Bug] Task 1 verify regex conflict with plan mandate
- Rewrote root README as the v1.3 reference-integration narrative (apps/demo + 4 @kehto packages + quick integration example) and archived 6 legacy docs/ migration snapshots under docs/migrations/ with terminal-state headers; operationalizes DOCS-03.
- None.
- 1. [Rule 3 - Blocking] Working-tree leak cleanup after `git checkout main`
- 4 v1.3 `patch`-bump changeset files authored for @kehto/{acl,runtime,shell,services}, each citing the DEMO-/NAP-/E2E-/DOCS- requirement IDs its package work covers; REL-04 evidence appended to 22-ITERATION-LOG.md with file paths, ls -la, line counts, frontmatter heads, citation counts, and anti-term grep proof.
- 7 legacy spec files deleted via `git rm`; `pnpm test:e2e` reports 47 passed / 0 failed / 0 skipped / 18.4s (exit 0); E2E-10 closed; ROADMAP Phase 22 Success Criterion 1 verifiably satisfied.
- Fresh-build `pnpm build` + `pnpm test:e2e` loop recorded in 22-ITERATION-LOG.md against the post-22-07 zero-skip baseline (47 passed / 0 failed / 0 skipped / 16.7s on iteration 1); E2E-11 formally closed per D-08; v1.3 milestone READY TO CLOSE with all 9 requirements CLOSED.

---

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
