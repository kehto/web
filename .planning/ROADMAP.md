# Roadmap: Kehto Runtime

## Milestones

- [x] **v1.0: NIP-5D Migration & Gap Analysis** — 5 phases, 7 plans, 17 requirements ([archive](milestones/v1.0-ROADMAP.md))
- [x] **v1.1: NIP-5D Migration Implementation** — 4 phases, 8 plans, 16 requirements ([archive](milestones/v1.1-ROADMAP.md))
- [x] **v1.2: NIP-5D Conformance & Full NUB Coverage** — 6 phases, 19 plans, 26 requirements, 449 tests ([archive](milestones/v1.2-ROADMAP.md) | [audit](milestones/v1.2-MILESTONE-AUDIT.md))
- [ ] **v1.3: Demo Functional & Playwright Parity** — 7 phases, TBD plans, 35 requirements (Phases 16–22)

---

## Milestone Constraints

- `@napplet/core` is not yet published to npm — all `@napplet/*` packages resolve via `pnpm.overrides` `link:` entries to `/home/sandwich/Develop/napplet/*`. Verify deduplication with `pnpm ls @napplet/core --depth 5` before each Playwright run. Demo must never add `@napplet/core` as a direct dep.
- `DRIFT-CORE-06` (`packages/runtime/src/core-compat.ts`) stays intact — do not delete it or add new consumers in v1.3.
- `keys` and `media` reference services remain stub-only; no real backends in v1.3 (hotkey-chord + media-controller napplets deferred to v1.4+).
- `changeset publish` is NOT run in v1.3 — release rehearsal stops at `changeset version` dry-run.
- Playwright runs only against `pnpm preview` builds (`:4173` harness, `:4174` demo) — never `pnpm dev`. The `@napplet/vite-plugin` emits `aggregateHash=""` in dev mode, poisoning ACL state.

---

## Current Milestone: v1.3 — Demo Functional & Playwright Parity

**Milestone Goal:** Adapt `apps/demo` and its bundled napplets to the canonical v1.2 `@kehto/*` + `@napplet/*` NIP-5D interfaces; rewrite the Playwright suite; drive a build→run→Playwright→fix iteration loop until every panel, napplet, and spec is green.

**Phases:** 16–22 (7 phases) | **Requirements:** 35/35 mapped

**Cross-cutting requirement — E2E-11 (iteration-loop discipline):** Every phase from Phase 17 onward must close with a recorded build→run→Playwright (MCP)→fix loop. Phases do not close on `tsc`/`vitest` green alone. E2E-11 is formally closed in Phase 22 when the full green suite is recorded against the built artifact.

## Phases

- [x] **Phase 16: Harness Triage & Playwright Infrastructure** — Delete obsolete specs, extend harness driver API, fix timing/isolation pitfalls (completed 2026-04-17)
- [x] **Phase 17: Demo App Rewire** — Boot demo clean against v1.2 APIs; all 8 service nodes live; signer/ACL/debugger wired (completed 2026-04-18)
- [x] **Phase 18: Napplet SDK Migration** — Migrate `bot` + `chat` from raw `window.addEventListener` to `@napplet/sdk` (completed 2026-04-18)
- [x] **Phase 19: Core-Domain Napplets** — Add `composer`, `preferences`, `toaster`; relay/storage/notify specs green (completed 2026-04-18)
- [x] **Phase 20: Expanded-Domain Napplets** — Add `feed`, `profile-viewer`, `theme-switcher`; full 8-domain showcase complete (completed 2026-04-18)
- [x] **Phase 21: Fixture Napplets & Layer-A Specs** — Per-nub fixture napplets + `nub-*.spec.ts` harness-driven correctness specs (completed 2026-04-18)
- [x] **Phase 22: Docs Refresh & Release Rehearsal** — typedoc API ref, README updates, publint/attw clean, changeset dry-run, full E2E green gate (completed 2026-04-18)

---

## Phase Details

### Phase 16: Harness Triage & Playwright Infrastructure
**Goal**: A clean, trustworthy Playwright baseline where every spec reflects the current v1.2 API surface — no legacy specs, no timing pitfalls, and the harness driver exposes all NIP-5D envelope helpers needed by subsequent phases.
**Depends on**: Nothing (first v1.3 phase; v1.2 runtime is the baseline)
**Requirements**: E2E-01, E2E-02, E2E-03, E2E-04, E2E-05
**Success Criteria** (what must be TRUE):
  1. `pnpm test:e2e` runs with zero legacy specs (`auth-handshake`, `auth.spec`, `signer-delegation`, `acl-matrix-signer`, and any spec referencing `window.nostr`, `BusKind`, or kind 29001/29002) — none exist in the repo.
  2. The harness exposes all 7 new NIP-5D driver globals (`__injectEnvelope__`, `__getNubMessage__`, `__getServiceNames__`, `__registerService__`, `__unregisterService__`, `__getNotifications__`, `__setIdentityPubkey__`) and each returns a structured-clone-safe primitive.
  3. `waitForNappletReady(page, frameSelector)` is callable from any spec and reliably waits for a sandboxed iframe's execution context before proceeding — no spec skips it.
  4. The canonical `beforeEach` fixture (`goto('/') → __aclClear__() → __clearLocalStorage__()`) is shared via a fixture file; no spec uses `page.reload()` on ACL-touching flows.
  5. `playwright.config.ts` runs a two-entry `webServer` array (harness `:4173` + demo `:4174`); `turbo.json` includes a `build:napplets` pipeline task; `@playwright/test` is on `^1.54.0` or higher.
**Plans:** 4/4 plans complete
- [x] 16-01-PLAN.md — Delete legacy specs (E2E-01)
- [x] 16-02-PLAN.md — Playwright 1.54 bump + webServer array + build:napplets turbo task (E2E-02, E2E-03)
- [x] 16-03-PLAN.md — Extend harness with 7 NIP-5D globals + readiness flag + globals.d.ts (E2E-04)
- [x] 16-04-PLAN.md — Shared helpers (waitForNappletReady, aclBeforeEach) + migrate acl-enforcement spec (E2E-05)

### Phase 17: Demo App Rewire
**Goal**: The demo application boots cleanly against the canonical v1.2 `@kehto/*` APIs — zero legacy references, all 8 service nodes visible in topology, signer/NIP-46/ACL/debugger surfaces wired and functional.
**Depends on**: Phase 16
**Requirements**: DEMO-01, DEMO-02, DEMO-03, DEMO-04, DEMO-05, DEMO-06, DEMO-07, DEMO-08, E2E-06, E2E-11 (cross-cutting gate)
**Success Criteria** (what must be TRUE):
  1. Demo loads at `:4174` and shows all 8 service topology nodes with no console errors referencing `window.nostr`, `signer-service`, `BusKind`, or NIP-01 verbs.
  2. The signer modal completes a NIP-46 connect flow and produces a successful `identity.getPublicKey` read + at least one `relay.publish` — no `window.nostr` fallback path is reachable.
  3. The ACL panel lets a user grant and revoke any capability on any loaded napplet, and the change is visible in napplet behavior within the same session.
  4. The debugger pane shows NIP-5D `type` strings (e.g., `relay.publish`, `storage.getItem.result`) — not NIP-01 verbs or BusKind constants.
  5. Layer-B demo-surface specs `demo-boot`, `demo-node-inspector`, `demo-debugger`, `demo-service-toggle`, `demo-notification-service` are all green against the built demo artifact.
**Plans:** 7/7 plans complete
- [x] 17-01-PLAN.md — Purge legacy anti-terms from apps/demo/src/ (DEMO-01 baseline hygiene)
- [x] 17-02-PLAN.md — Register keys+media+theme services; render 8 topology nodes with stub-only markers (DEMO-04, DEMO-05)
- [x] 17-03-PLAN.md — Rewire signer UX to canonical identity.getPublicKey + relay.publish path (DEMO-02)
- [x] 17-04-PLAN.md — Envelope-aware debugger + flow animator + sequence diagram + trace animator (DEMO-04, DEMO-08)
- [x] 17-05-PLAN.md — ACL adapter seam + per-role node inspector + canonical notify envelopes (DEMO-03, DEMO-06, DEMO-07)
- [x] 17-06-PLAN.md — 5 Layer-B demo-surface Playwright specs (E2E-06)
- [x] 17-07-PLAN.md — Build→preview→Playwright MCP→fix iteration loop gate (E2E-11)
**UI hint**: yes

### Phase 18: Napplet SDK Migration
**Goal**: `bot` and `chat` no longer use raw `window.addEventListener('message')`; both are fully on the `@napplet/sdk` envelope API and exercise live `ifc` + `storage` domain traffic that the debugger and Playwright can observe.
**Depends on**: Phase 17
**Requirements**: NAP-01, NAP-02, E2E-07 (ifc-roundtrip, napplet-auth specs), E2E-11 (cross-cutting gate)
**Success Criteria** (what must be TRUE):
  1. `apps/demo/napplets/bot` and `apps/demo/napplets/chat` contain zero `window.addEventListener('message')` calls; all protocol traffic goes through `@napplet/sdk` `ipc.*` / `storage.*` APIs.
  2. The `ifc-roundtrip` Playwright spec is green: a message sent from `bot` via `ipc.emit` is received by `chat` via `ipc.on` and the demo debugger shows both the outbound and inbound envelopes.
  3. The `napplet-auth` Playwright spec is green: both migrated napplets receive their capability grants and the topology node for each shows a non-empty capability state.
**Plans:** 4/4 plans complete
- [x] 18-01-PLAN.md — Migrate bot napplet to @napplet/sdk (NAP-01)
- [x] 18-02-PLAN.md — Migrate chat napplet to @napplet/sdk (NAP-02)
- [x] 18-03-PLAN.md — Layer-B E2E specs napplet-auth + ifc-roundtrip (E2E-07)
- [x] 18-04-PLAN.md — Build → preview → Playwright iteration loop gate (E2E-11)
**UI hint**: yes

### Phase 19: Core-Domain Napplets
**Goal**: `composer`, `preferences`, and `toaster` napplets are live in the demo, each exercising one core NUB domain end-to-end; their Playwright specs are green and the capability-matrix specs confirm ACL enforcement on relay-write and storage-write.
**Depends on**: Phase 18
**Requirements**: NAP-03, NAP-04, NAP-05, E2E-07 (relay-publish, relay-publish-encrypted, storage-persist, notify-lifecycle specs), E2E-08, E2E-11 (cross-cutting gate)
**Success Criteria** (what must be TRUE):
  1. The `composer` napplet publishes an event via `relay.publish` and a second via `relay.publishEncrypted` (NIP-44 default); the demo UI shows OK/denied status for each attempt; the debugger shows both envelope types.
  2. The `preferences` napplet writes a value via `storage.setItem` that survives a full page reload and is retrieved via `storage.getItem` — the debugger shows the round-trip envelopes.
  3. The `toaster` napplet creates, lists, reads, and dismisses a notification; both the host toast layer and the napplet's own UI reflect the change.
  4. The `acl-revoke-relay-write` and `acl-revoke-storage-write` capability-matrix specs are green: revoking the relevant capability blocks the `composer`/`preferences` napplet actions and the ACL history ring shows the denial.
**Plans:** 7/7 plans complete
- [x] 19-01-PLAN.md — Composer napplet scaffold + relay.publish/publishEncrypted (NAP-03)
- [x] 19-02-PLAN.md — Preferences napplet scaffold + storage.setItem/getItem (NAP-04)
- [x] 19-03-PLAN.md — Toaster napplet scaffold + notify.create/list/dismiss envelope dispatch (NAP-05)
- [x] 19-04-PLAN.md — Demo wiring: DEMO_NAPPLETS + dual-register notification-service as notify + ACL panel extensions
- [x] 19-05-PLAN.md — 4 Layer-B E2E-07 specs: relay-publish, relay-publish-encrypted, storage-persist, notify-lifecycle
- [x] 19-06-PLAN.md — 2 Layer-B E2E-08 capability-matrix specs: acl-revoke-relay-write, acl-revoke-storage-write
- [x] 19-07-PLAN.md — E2E-11 iteration loop gate (full v1.3 Layer-B suite = 13 spec files, ~26 tests)
**UI hint**: yes

### Phase 20: Expanded-Domain Napplets
**Goal**: `feed`, `profile-viewer`, and `theme-switcher` napplets are live in the demo, completing the 8-domain end-to-end showcase; all remaining Layer-B domain specs are green.
**Depends on**: Phase 19
**Requirements**: NAP-06, NAP-07, NAP-08, NAP-09, E2E-07 (relay-subscribe, identity-flow, theme-broadcast specs), E2E-11 (cross-cutting gate)
**Success Criteria** (what must be TRUE):
  1. The `profile-viewer` napplet shows a truncated pubkey and, when available, name/about/picture from an `identity.getPublicKey` + `identity.getProfile` round-trip; the `identity-flow` Playwright spec is green.
  2. The `theme-switcher` napplet triggers `bridge.publishTheme()` and at least one other napplet (e.g., `preferences` or `profile-viewer`) visibly reacts to the resulting `theme.changed` push event; the `theme-broadcast` Playwright spec is green.
  3. All 6 non-stub NUB domains (`identity`, `ifc`, `notify`, `relay`, `storage`, `theme`) are exercised end-to-end by at least one live demo napplet; `keys` and `media` appear in the topology as stub-only nodes with a documented service-registration comment explaining the deferral.
  4. The node inspector pane shows per-role content for every topology node: ACL node → grant/revoke table; runtime node → registered NUBs; napplet node → capability state + recent envelopes.

**Decision resolved (via `/gsd:discuss-phase 20`):** feed delivery uses option (b) — in-memory mock relay pool in demo (see `.planning/phases/20-expanded-domain-napplets/20-CONTEXT.md` D-USER-01). Plan 20-01 implements `apps/demo/src/mock-relay-pool.ts` holding 5 kind:1 fixture events. Plan 20-05 extends preferences as the theme-broadcast observer (D-USER-02).

**Plans:** 8/8 plans complete
- [x] 20-01-PLAN.md — Mock relay pool in demo (NAP-06 delivery; D-USER-01)
- [x] 20-02-PLAN.md — feed napplet scaffold + relay.subscribe (NAP-06)
- [x] 20-03-PLAN.md — profile-viewer napplet scaffold + identity.getPublicKey/getProfile (NAP-07)
- [x] 20-04-PLAN.md — theme-switcher napplet scaffold + demo.publishTheme dispatch (NAP-08)
- [x] 20-05-PLAN.md — preferences napplet theme observer extension (D-USER-02; NAP-08)
- [x] 20-06-PLAN.md — Demo wiring: DEMO_NAPPLETS + ACL panels + demo.publishTheme listener (NAP-06/07/08/09)
- [x] 20-07-PLAN.md — 3 Layer-B E2E-07 specs: relay-subscribe, identity-flow, theme-broadcast
- [x] 20-08-PLAN.md — E2E-11 iteration loop gate + NAP-09 coverage verification
**UI hint**: yes

### Phase 21: Fixture Napplets & Layer-A Specs
**Goal**: Protocol correctness is independently verifiable at the harness layer, without the demo server — one fixture napplet per non-stub NUB domain drives the runtime via harness globals and a `nub-*.spec.ts` spec asserts canonical request/response behavior.
**Depends on**: Phase 20
**Requirements**: E2E-09
**Success Criteria** (what must be TRUE):
  1. Six fixture napplets exist under `tests/fixtures/napplets/` — one each for `identity`, `ifc`, `notify`, `relay`, `storage`, `theme` — loadable via `window.__loadNapplet__('nub-<domain>')` from Playwright.
  2. Six `nub-<domain>.spec.ts` Layer-A specs run against the harness at `:4173` using only harness driver globals (`window.__*`); each spec asserts at least one request envelope is dispatched and at least one result envelope is received, without touching the demo server.
  3. `nub-keys.spec.ts` and `nub-media.spec.ts` exist and explicitly document stub scope — they assert the stub response shape (e.g., "not implemented" or empty result) without asserting real backend behavior.
**Plans:** 5/5 plans complete
- [x] 21-01-PLAN.md — Delete legacy fixture napplets (auth/publish/pure) + document removal rationale
- [x] 21-02-PLAN.md — Create 6 SDK-based fixture napplets (nub-identity/ifc/notify/relay/storage/theme) + extend turbo build:napplets outputs
- [x] 21-03-PLAN.md — 6 Layer-A active-domain specs (nub-identity/ifc/notify/relay/storage/theme.spec.ts) targeting :4173
- [x] 21-04-PLAN.md — 2 Layer-A stub-scope specs (nub-keys/nub-media.spec.ts) with explicit STUB SCOPE NOTICE headers
- [x] 21-05-PLAN.md — E2E-11 iteration loop gate (full v1.3 suite green) + 21-ITERATION-LOG.md

### Phase 22: Docs Refresh & Release Rehearsal
**Goal**: All documentation reflects the canonical v1.2 API surface; `pnpm test:e2e` is fully green against the built artifact with zero skipped specs; release-rehearsal tooling confirms the packages are publish-ready (pending upstream npm unblock).
**Depends on**: Phase 21
**Requirements**: DOCS-01, DOCS-02, DOCS-03, REL-01, REL-02, REL-03, REL-04, E2E-10, E2E-11 (closed here)
**Success Criteria** (what must be TRUE):
  1. `pnpm test:e2e` completes fully green — zero skipped specs, zero legacy specs, full suite under 5 minutes locally — against a real `pnpm build` artifact with both webServers running.
  2. `pnpm docs:api` generates `docs/api/` from `typedoc@^0.28` with `entryPointStrategy: "packages"`; all 4 `@kehto/*` packages appear; every public export has JSDoc with `@example`.
  3. `pnpm dlx publint packages/*` reports clean for all 4 packages; `pnpm dlx @arethetypeswrong/cli --profile esm-only packages/*` reports clean for all 4 packages.
  4. `pnpm changeset version` dry-run completes in a throwaway branch; `pnpm install --frozen-lockfile` succeeds after the version bump; diffs show no unexpected peer-dep range changes; branch is discarded. `changeset publish` is explicitly NOT run.
  5. Four v1.3 changesets are staged at `.changeset/v1-3-*.md` (one per `@kehto/*` package), each citing the DEMO-*/NAP-*/E2E-* IDs it covers.
**Plans**: TBD

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 16. Harness Triage & Playwright Infrastructure | v1.3 | 4/4 | Complete    | 2026-04-17 |
| 17. Demo App Rewire | v1.3 | 7/7 | Complete    | 2026-04-18 |
| 18. Napplet SDK Migration | v1.3 | 4/4 | Complete    | 2026-04-18 |
| 19. Core-Domain Napplets | v1.3 | 7/7 | Complete    | 2026-04-18 |
| 20. Expanded-Domain Napplets | v1.3 | 8/8 | Complete    | 2026-04-18 |
| 21. Fixture Napplets & Layer-A Specs | v1.3 | 5/5 | Complete    | 2026-04-18 |
| 22. Docs Refresh & Release Rehearsal | v1.3 | 4/8 | In Progress|  |
