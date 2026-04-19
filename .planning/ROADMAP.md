# Roadmap: Kehto Runtime

## Milestones

- [x] **v1.0: NIP-5D Migration & Gap Analysis** — 5 phases, 7 plans, 17 requirements ([archive](milestones/v1.0-ROADMAP.md))
- [x] **v1.1: NIP-5D Migration Implementation** — 4 phases, 8 plans, 16 requirements ([archive](milestones/v1.1-ROADMAP.md))
- [x] **v1.2: NIP-5D Conformance & Full NUB Coverage** — 6 phases, 19 plans, 26 requirements, 449 tests ([archive](milestones/v1.2-ROADMAP.md) | [audit](milestones/v1.2-MILESTONE-AUDIT.md))
- [x] **v1.3: Demo Functional & Playwright Parity** — 7 phases (16–22), 43 plans, 37 requirements, 47 E2E specs green ([archive](milestones/v1.3-ROADMAP.md) | [audit](milestones/v1.3-MILESTONE-AUDIT.md))
- [x] **v1.4: Productionization & Upstream Unblock** — 6 phases (23–28), 17 plans, 20 requirements, 49 E2E specs green ([archive](milestones/v1.4-ROADMAP.md) | [audit](milestones/v1.4-MILESTONE-AUDIT.md))
- [ ] **v1.5: Demo Stability & UAT Coverage** — 3 phases (29–31), 7 requirements (in progress)

---

## Current Milestone: v1.5 — Demo Stability & UAT Coverage

**Goal:** Fix the 6 demo bugs surfaced by post-v1.4 UAT and close the CI coverage gap that let them ship — so the full `:4174` demo is continuously validated, not just isolated Layer-B spec frames.

**Phase numbering:** Continues from Phase 28 (v1.4). v1.5 starts at Phase 29.

### Milestone Constraints (carried from v1.4)

**Anti-feature enforcement (enforced every phase):**
- No `window.nostr` on any napplet-visible surface
- No `signer-service` or `signer.*` messages
- No raw `window.addEventListener('message')` in new or migrated napplets (use `@napplet/sdk`)
- No `BusKind` / kind 29001 / kind 29002 in napplet code
- No new consumers of `packages/runtime/src/core-compat.ts` (deleted Phase 24)
- No `allow-same-origin` on napplet iframe sandbox

**E2E iteration-loop discipline (canon):** Every phase that ships or touches a Playwright spec closes with a recorded `pnpm clean && pnpm build && pnpm test:e2e` loop against the built `:4174` demo (not `pnpm dev`).

**Port conventions:** Harness at `:4173`, full demo at `:4174`. Layer-B specs that assert the concurrent-boot scenario use `:4174` only (no `__loadNapplet__` single-frame helper).

**CI:** Runs on `ubuntu-latest` only. Multi-OS coverage deferred to v1.6+.

**Anti-term grep hygiene:** Use tight patterns (e.g., word-boundary or file-exclusion) to suppress JSDoc and docblock false positives from prior milestones' documented anti-features.

### Phases

- [x] **Phase 29: Concurrent-boot AUTH Fix + Demo Stability** — Root-cause the concurrency regression; fix it; verify all 10 napplets reach AUTHENTICATED on the full `:4174` demo boot.
- [x] **Phase 30: Shell UI State Wiring** — Wire service activity counters, ACL Capability Matrix authenticated-napplet lookup, and sequence-diagram lane generation to live NUB envelope traffic. (completed 2026-04-19)
- [ ] **Phase 31: E2E Coverage + Milestone Iteration Loop** — Ship two new Layer-B specs guarding DEMO-01 and UI-01/02/03; close with the canonical iteration loop targeting 49 → 51 specs.

### Phase Details

### Phase 29: Concurrent-boot AUTH Fix + Demo Stability
**Goal**: All 10 demo napplets reach AUTHENTICATED state when booted concurrently from `topology.ts`
**Depends on**: Nothing (root-cause + fix is the foundation; all other phases verify against a working demo)
**Requirements**: DEMO-01, DEMO-02
**Success Criteria** (what must be TRUE):
  1. `pnpm --filter @kehto/demo preview` (built artifact, not `pnpm dev`) boots and all 10 napplets in `DEMO_NAPPLETS` display their AUTHENTICATED sentinel within 10 seconds — none stall on `LOADING`.
  2. The root cause is identified and documented (e.g., AUTH-reply routing collision, sessionRegistry race, iframe contention) — a comment or commit message captures the mechanism so the fix is auditable.
  3. With all 10 napplets AUTHENTICATED, clicking Play in `media-controller` transitions `navigator.mediaSession.playbackState` to `'playing'` and the `#media-controller-status` DOM sentinel updates accordingly; clicking Pause transitions to `'paused'`.
  4. The fix introduces no regression in the 49 existing Playwright specs — `pnpm test:e2e` still exits with 49 passed / 0 failed / 0 skipped after the change.
  5. The anti-feature inventory (no `window.nostr`, no `signer-service`, no `allow-same-origin`, no `BusKind`) remains clean — zero new violations introduced by the fix.
**Plans**: 2 plans

Plans:
- [x] 29-01-PLAN.md — DEMO-01: rewrite refreshAclPanelsIfNeeded() as data-driven loop over DEMO_NAPPLETS; remove stale aclRendered.size < 8 guard
- [x] 29-02-PLAN.md — DEMO-02: cascade-fixed by 29-01 (bucket:cascade-fixed); automated Playwright MCP UAT confirmed Play/Pause working; no code change; 49/0/0

### Phase 30: Shell UI State Wiring
**Goal**: Shell UI state surfaces (service activity counters, ACL Capability Matrix, sequence-diagram lanes) reflect live NUB envelope traffic for all authenticated napplets
**Depends on**: Phase 29 (all 10 napplets AUTH → state surfaces are verifiable with realistic traffic)
**Requirements**: UI-01, UI-02, UI-03
**Success Criteria** (what must be TRUE):
  1. Every service node in the topology panel shows a non-zero `ACTIVITY: N recent` count and a populated `LAST ACTION: <type>` string after any NUB envelope of that service's domain is processed (e.g., `theme.changed`, `storage.get`, `media.session.create`, `keys.action`).
  2. The ACL Capability Matrix modal (System Policy → ACL Capability Matrix) lists every napplet that has reached AUTHENTICATED as a distinct row — not "No authenticated napplets" — and renders the per-capability grant/revoke state for each row.
  3. The Debugger Sequence Diagram renders a dedicated lane for every authenticated napplet; messages originated by any AUTHENTICATED napplet appear in that napplet's lane (not only Chat/Shell/Bot).
  4. The wiring changes touch only existing DOM surfaces — no new shell UI components are introduced (visual polish deferred per Out of Scope).
  5. The 49 existing Playwright specs remain fully green after the shell wiring changes.
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 30-01-PLAN.md — UI-01: add service-level routing pass to installActivityProjection() in node-details.ts with notify→notifications alias and topology.services.includes guard
- [x] 30-02-PLAN.md — UI-02: swap snapshot() gate in shell-host.ts aclAdapter from info.pubkey to info.authenticated (accepts Path B NIP-5D napplets)
- [x] 30-03-PLAN.md — UI-03: replace LANE_NAMES hardcode in sequence-diagram.ts with deriveLanes(messages, nappletInfos) helper; propagate new signature through debugger.ts

### Phase 31: E2E Coverage + Milestone Iteration Loop
**Goal**: Two new Layer-B Playwright specs lock the concurrent-boot and shell-UI-state contracts in CI, and the milestone closes with a verified fresh-build iteration loop
**Depends on**: Phase 29 AND Phase 30 (new specs assert the fixed demo + wired UI simultaneously)
**Requirements**: E2E-15, E2E-16
**Success Criteria** (what must be TRUE):
  1. `tests/e2e/demo-concurrent-boot.spec.ts` exists, loads the full `:4174` demo without `__loadNapplet__`, and asserts every napplet in `DEMO_NAPPLETS` reaches AUTHENTICATED within the configured timeout — spec passes on the built artifact.
  2. `tests/e2e/shell-ui-state-surfaces.spec.ts` exists and asserts: (a) ACL Capability Matrix opens with at least N authenticated-napplet rows; (b) at least one service node `ACTIVITY` counter increments after a triggered NUB envelope; (c) the Sequence Diagram renders a lane for each authenticated napplet.
  3. The canonical milestone iteration loop (`pnpm clean && pnpm build && pnpm test:e2e`) runs against the built `:4174` demo and exits with exactly 51 passed / 0 failed / 0 skipped (delta: 49 → 51, +2 new specs).
  4. Both new spec files contain no single-napplet `__loadNapplet__` helper calls — they rely exclusively on the native `DEMO_NAPPLETS` topology boot.
  5. The iteration loop result and both new spec file paths are recorded in a phase ITERATION-LOG.md entry, closing the E2E-11 iteration-loop discipline for v1.5.
**Plans**: TBD

---

### Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 29. Concurrent-boot AUTH Fix + Demo Stability | 2/2 | Complete    | 2026-04-19 |
| 30. Shell UI State Wiring | 3/3 | Complete   | 2026-04-19 |
| 31. E2E Coverage + Milestone Iteration Loop | 0/0 | Not started | - |

---

## Progress

All v1.0–v1.4 phases complete. Phase-level progress archived per milestone:

- [v1.0 phase archive](milestones/v1.0-phases/)
- [v1.1 phase archive](milestones/v1.1-phases/)
- [v1.2 phase archive](milestones/v1.2-phases/)
- [v1.3 phase archive](milestones/v1.3-phases/)
- [v1.4 phase archive](milestones/v1.4-phases/)
