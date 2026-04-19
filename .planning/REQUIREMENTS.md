# Requirements: v1.5 Demo Stability & UAT Coverage

**Milestone:** v1.5
**Defined:** 2026-04-19
**Status:** Active (roadmap defined)

## Overview

v1.5 is a **UAT-fix + CI-coverage** milestone. Post-v1.4 manual demo testing surfaced 6 issues (documented in `.planning/v1.5-UAT-FINDINGS.md`) that were missed by v1.4's automated checks because:

- Playwright Layer-B specs load **one napplet at a time** — the full 10-napplet concurrent boot was never exercised.
- Shell-UI state surfaces (ACL matrix, service activity counters, sequence-diagram lanes) had no CI assertions tying them to NUB envelope traffic.

v1.5 fixes the bugs AND closes the coverage gap so regressions of this shape can't ship again.

**REQ-ID format:** `[CATEGORY]-[NUMBER]` — categories: `DEMO`, `UI`, `E2E`.

**Anti-features carried forward from v1.4 (enforced every phase):**
- No `window.nostr` on any napplet-visible surface
- No `signer-service` or `signer.*` messages
- No raw `window.addEventListener('message')` in new or migrated napplets (use `@napplet/sdk`)
- No `BusKind` / kind 29001 / kind 29002 in napplet code
- No new consumers of `packages/runtime/src/core-compat.ts` (deleted in v1.4 Phase 24)
- No `allow-same-origin` on napplet iframe sandbox

**E2E iteration-loop discipline (canon):** Every phase that ships or touches a Playwright spec closes with a recorded `pnpm clean && pnpm build && pnpm test:e2e` loop against the built `:4174` demo (not `pnpm dev`).

---

## Category 1: Demo Stability (DEMO)

Fixes for the `:4174` demo when all 10 napplets are mounted concurrently from `topology.ts`.

- [x] **DEMO-01**: When `pnpm --filter @kehto/demo dev` (or `pnpm preview`) boots the demo, all 10 napplets in `DEMO_NAPPLETS` reach the `AUTHENTICATED` state within a reasonable timeout (default: 10s). Current state (post-v1.4): `bot` + `chat` reach AUTHENTICATED; `composer`, `feed`, `hotkey-chord`, `media-controller`, `preferences`, `profile-viewer`, `theme-switcher` stall on `LOADING`.
- [x] **DEMO-02**: With all 10 napplets AUTHENTICATED (DEMO-01 satisfied), Play and Pause buttons in `media-controller` trigger the expected `navigator.mediaSession.playbackState` transitions ('playing' / 'paused') and update the `#media-controller-status` DOM sentinel. Current state: buttons noop because napplet never reaches AUTHENTICATED.

---

## Category 2: Shell UI State Wiring (UI)

Pre-existing shell-UI state surfaces that never populated under NUB traffic. These are v1.3-era gaps that v1.4 didn't address.

- [x] **UI-01**: Service node activity counters (`ACTIVITY: N recent` on each service node in the topology panel) increment on NUB envelope traffic. Every `theme.changed` / `storage.get` / `relay.publish` / `media.session.create` / `keys.action` / etc. bumps the corresponding service's counter. `LAST ACTION: —` populates with the most-recent envelope `type` string.
- [x] **UI-02**: ACL Capability Matrix modal (System Policy → ACL Capability Matrix) lists every authenticated napplet as a row and renders the per-capability grant/revoke state for each. Current state: the matrix shows "No authenticated napplets" even when bot + chat are AUTHENTICATED.
- [x] **UI-03**: Debugger Sequence Diagram renders a lane for every authenticated napplet (not only the first 2-3). Messages originated by any AUTHENTICATED napplet appear in that napplet's lane. Current state: only `Chat`, `Shell`, `Bot` lanes render; other authenticated napplets are missing.

---

## Category 3: E2E Coverage (E2E)

Continues numbering from v1.4 E2E-14.

- [x] **E2E-15**: New Layer-B spec `tests/e2e/demo-concurrent-boot.spec.ts` loads the full `:4174` demo (no `__loadNapplet__` single-frame helper — uses the native `DEMO_NAPPLETS` topology load), waits up to 10s, and asserts every napplet in `DEMO_NAPPLETS` reaches `AUTHENTICATED` (asserted via each napplet's per-frame status sentinel). Spec passes on the built demo artifact. Guards DEMO-01 from regressing.
- [ ] **E2E-16**: New Layer-B spec `tests/e2e/shell-ui-state-surfaces.spec.ts` loads the full demo (same as E2E-15), then asserts: (a) ACL Capability Matrix opens and lists at least N authenticated napplets as rows (where N ≥ bot + chat + any napplet that AUTHs); (b) at least one service node's `ACTIVITY` counter increments after a triggered NUB envelope (e.g., clicking theme-switcher's button bumps the `theme` service counter); (c) the Sequence Diagram renders a lane for each authenticated napplet after a short delay. Spec passes on the built demo artifact. Guards UI-01/02/03 from regressing.

---

## Future Requirements (deferred past v1.5)

- **PERF-01 — Chat boot storage batching.** Chat napplet performs 18+ serial `storage.get` round-trips at boot (observed in sequence diagram). Replace with a single batched read or parallel `Promise.all`. Deferred — not a correctness bug, just latency. Re-scope in v1.6 if startup time becomes a concern.
- **Electron / Tauri host-bridge reference impls** — v1.4 defined `HostKeysBridge` + `HostMediaBridge`; actual reference implementations deferred. v1.6+ if demand surfaces.
- **Multi-OS CI matrix** — v1.4 + v1.5 run on `ubuntu-latest` only. Cross-OS coverage is a v1.6+ concern.

---

## Out of Scope (explicit exclusions)

- **Protocol-level changes to `@kehto/*`** — v1.2 is canonical; v1.5 does not modify the wire protocol. Reason: the v1.4 npm release is live; protocol stability is load-bearing.
- **New napplets for the demo** — v1.4 landed the 10th napplet (media-controller). v1.5 stabilizes the existing 10; no 11th.
- **New service backends** — `identity`, `keys`, `media`, `notify`, `relay`, `storage`, `theme` are all real. No new reference services in v1.5.
- **Republication to npm** — v1.5 fixes are local until a v1.5 tag is cut. Release cadence is orthogonal to this milestone's scope.
- **Shell-level UI redesign** — the activity counters, ACL matrix, and sequence diagram are being wired to existing DOM, not redesigned. Visual polish deferred.

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| DEMO-01 | Phase 29 | Complete |
| DEMO-02 | Phase 29 | Complete |
| UI-01 | Phase 30 | Complete |
| UI-02 | Phase 30 | Complete |
| UI-03 | Phase 30 | Complete |
| E2E-15 | Phase 31 | Complete |
| E2E-16 | Phase 31 | Pending |

**Coverage:** 7/7 v1.5 requirements mapped. No orphans.

---

*Traceability table populated by roadmapper 2026-04-19.*
