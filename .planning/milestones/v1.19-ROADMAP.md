# Roadmap: Kehto Runtime

## Milestones

- [x] **v1.0: NIP-5D Migration & Gap Analysis** - 5 phases, 7 plans, 17 requirements ([archive](milestones/v1.0-ROADMAP.md))
- [x] **v1.1: NIP-5D Migration Implementation** - 4 phases, 8 plans, 16 requirements ([archive](milestones/v1.1-ROADMAP.md))
- [x] **v1.2: NIP-5D Conformance & Full NUB Coverage** - 6 phases, 19 plans, 26 requirements, 449 tests ([archive](milestones/v1.2-ROADMAP.md) | [audit](milestones/v1.2-MILESTONE-AUDIT.md))
- [x] **v1.3: Demo Functional & Playwright Parity** - 7 phases (16-22), 43 plans, 37 requirements, 47 E2E specs green ([archive](milestones/v1.3-ROADMAP.md) | [audit](milestones/v1.3-MILESTONE-AUDIT.md))
- [x] **v1.4: Productionization & Upstream Unblock** - 6 phases (23-28), 17 plans, 20 requirements, 49 E2E specs green ([archive](milestones/v1.4-ROADMAP.md) | [audit](milestones/v1.4-MILESTONE-AUDIT.md))
- [x] **v1.5: Demo Stability & UAT Coverage** - 3 phases (29-31), 7 plans, 7 requirements, 53 E2E specs green ([archive](milestones/v1.5-ROADMAP.md) | [audit](milestones/v1.5-MILESTONE-AUDIT.md))
- [x] **v1.6: Downstream Unblock & Shell Service Surface** - 5 phases (32-36), 12 plans, 21 requirements, 54 E2E specs green ([archive](milestones/v1.6-ROADMAP.md) | [audit](milestones/v1.6-MILESTONE-AUDIT.md))
- [x] **v1.7: NIP-5D Spec Adoption & New NUB Domains** - 5 phases (37-41), 17 plans, 41/41 requirements, 72 E2E specs green ([archive](milestones/v1.7-ROADMAP.md) | [audit](milestones/v1.7-MILESTONE-AUDIT.md))
- [x] **v1.8: Upstream Alignment & NIP-44 Decrypt** - 5 phases (42-46), 9 plans, 27/27 requirements, 86 E2E specs green ([archive](milestones/v1.8-ROADMAP.md) | [audit](milestones/v1.8-MILESTONE-AUDIT.md))
- [x] **v1.9: Napplet SDK Migration** - 3 phases (47-49), 3 plans, 12/12 requirements, 86 E2E specs green ([archive](milestones/v1.9-ROADMAP.md) | [audit](milestones/v1.9-MILESTONE-AUDIT.md))
- [x] **v1.10: Compatibility Window Cleanup & Decrypt Demo Parity** - 3 phases (50-52), 3 plans, 10/10 requirements, 86 E2E specs green ([archive](milestones/v1.10-ROADMAP.md) | [audit](milestones/v1.10-MILESTONE-AUDIT.md))
- [x] **v1.11: NIP-5A Gateway Artifact Parity** - 3 phases (53-55), 16/16 requirements, production-equivalent opaque-origin gateway artifact loading, 551 unit tests, 87 E2E specs green ([archive](milestones/v1.11-ROADMAP.md) | [audit](milestones/v1.11-MILESTONE-AUDIT.md))
- [x] **v1.12: NIP-5D Contract Conformance** - 4 phases (56-59), 34/34 requirements, 560 unit tests, 89 E2E specs green, pinned-spec contract conformance across shell, shim/runtime, gateway load checks, and 13 playground napplets ([archive](milestones/v1.12-ROADMAP.md) | [requirements](milestones/v1.12-REQUIREMENTS.md) | [audit](milestones/v1.12-MILESTONE-AUDIT.md))
- [x] **v1.13: Documentation Strategy & Monorepo Docs Site** - 5 phases (60-64), 28/28 requirements, content strategy, package docs, tutorials/how-tos, VitePress site, and docs verification ([archive](milestones/v1.13-ROADMAP.md) | [requirements](milestones/v1.13-REQUIREMENTS.md) | [audit](milestones/v1.13-MILESTONE-AUDIT.md))
- [x] **v1.14: GitHub Pages Web Portal** - 3 phases (65-67), 13/13 requirements, public `/web/` portal, playground at `/web/playground/`, docs at `/web/docs/`, and unified Pages deploy gate ([archive](milestones/v1.14-ROADMAP.md) | [requirements](milestones/v1.14-REQUIREMENTS.md) | [audit](milestones/v1.14-MILESTONE-AUDIT.md))
- [x] **v1.15: Address AI Slop** - 5 phases (68-72), 20/20 original requirements complete, local `aislop` scan no longer Critical, 563 unit tests green ([archive](milestones/v1.15-ROADMAP.md) | [requirements](milestones/v1.15-REQUIREMENTS.md) | [audit](milestones/v1.15-MILESTONE-AUDIT.md))
- [x] **v1.16: Structural Code Quality Refactor** - 4 phases (73-76), 18/18 requirements, local `aislop` scan clean, 563 unit tests green ([archive](milestones/v1.16-ROADMAP.md) | [requirements](milestones/v1.16-REQUIREMENTS.md) | [audit](milestones/v1.16-MILESTONE-AUDIT.md))
- [x] **v1.17: Beautify the SPA Landing Page** - 3 phases (77-79), 15/15 requirements, static `/web/` brand system, GSAP motion, liquid accent, and visual proof ([archive](milestones/v1.17-ROADMAP.md) | [requirements](milestones/v1.17-REQUIREMENTS.md) | [audit](milestones/v1.17-MILESTONE-AUDIT.md))
- [x] **v1.18: Napplet Firewall** - 3 phases (80-82), 24 requirements, new `@kehto/firewall` pure core + runtime integration for behavioral rate/burst/content anti-abuse with allow/deny/ask policy and focus-aware tightening (shipped — merged to main, PRs #25/#27)
- [ ] **v1.19: NAP Ontology Alignment** - 1 phase (83), 8 requirements (in progress on `milestone/v1.19-nap-ontology`)

---

## Active Milestone: v1.19 NAP Ontology Alignment

**Goal:** Align the `@kehto/*` `shell.init` capability handshake (and the INC dispatch rail) with the NAP renames `@napplet/*` adopted at `0.9.0`, so napplets built against `@napplet/* >=0.9.0` negotiate capabilities correctly inside a kehto shell. Resolves kehto/web#24.

**Branch:** `milestone/v1.19-nap-ontology` (off `main`)

**Note:** Phase numbering starts at 83 to avoid collision with the parallel in-flight v1.18 Firewall milestone (phases 80-82) on its own branch.

## Phases

- [x] **Phase 83: NAP Ontology Alignment** - Align capability handshake and dispatch rail with `@napplet/* >=0.9.0` NAP renames; add shim@0.9.0 conformance test; stage changeset. (completed 2026-06-15)

## Phase Details

### Phase 83: NAP Ontology Alignment
**Goal**: Napplets built against `@napplet/* >=0.9.0` negotiate capabilities correctly inside a kehto shell — the handshake emits `naps`/`inc`/`inc:NAP-0N`, the runtime routes `inc.*` messages, and the real shim@0.9.0 `createShellSupports` confirms the outcome.
**Depends on**: Nothing (first phase of this milestone; v1.18 phases 80-82 are parallel on a separate branch)
**Requirements**: ALIGN-01, ALIGN-02, ALIGN-03, ALIGN-04, ALIGN-05, ALIGN-06, ALIGN-07, ALIGN-08
**Success Criteria** (what must be TRUE):
  1. Calling `supports('inc')` on the `window.napplet.shell` object inside a kehto-hosted `>=0.9.0` napplet returns `true` — the shell advertises the `inc` domain.
  2. Calling `supports('inc', 'NAP-01')` (and other `inc:NAP-0N` protocol queries) against the kehto-emitted `shell.init` capabilities returns `true` via the real `@napplet/shim@0.9.0` `createShellSupports` function — not just string matching.
  3. The `shell.init` postMessage carries both `naps` (consumed by shim 0.9.0) and `nubs` (back-compat for shim <0.9.0) capability arrays, and the `naps` array contains `inc:NAP-0N` protocol IDs with no unaliased `ifc`/`NUB-NN` identifiers.
  4. A `>=0.9.0` napplet sending `inc.emit`, `inc.subscribe`, or `inc.unsubscribe` wire messages is routed through the existing IFC handler at the runtime dispatch layer, and legacy `ifc.*` messages continue to be handled during the transition window.
  5. The ACL gate authorizes `inc.*` actions identically to the corresponding `ifc.*` actions, so a napplet using the new `inc` domain key passes the same capability check as one using the legacy `ifc` key.
**Plans**: 3 plans
- [x] 83-01-PLAN.md — ACL resolver maps `inc` identically to `ifc` (ALIGN-06)
- [x] 83-02-PLAN.md — Runtime registers `inc` dispatch key + domain-aware IFC handler (ALIGN-05)
- [x] 83-03-PLAN.md — Shell `naps`/`nubs` dual-emit + shim@0.9.0 conformance test + changeset (ALIGN-01/02/03/04/07/08)
**UI hint**: no

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 83. NAP Ontology Alignment | v1.19 | 3/3 | Complete   | 2026-06-15 |
---

## Completed Milestone: v1.18 Napplet Firewall (shipped 2026-06-15)

### v1.18 Napplet Firewall

**Milestone goal:** Add `@kehto/firewall` — a behavioral anti-abuse gate that observes napplet messages at the runtime choke point (after a successful ACL check, before dispatch) and applies configurable rate/burst/content rules with allow/deny/ask policies and focus-aware tightening. It composes with the ACL (static authorization) without replacing it: the ACL answers *is this napplet allowed to do X?*; the firewall answers *is this napplet abusing X over time?*

**Phase numbering:** Continues from v1.17 (ended at Phase 79). v1.18 spans Phases 80–82.

**Scope boundary:** Engine + runtime integration + test coverage only. No host/shell management UI for editing rules (FWUI-01), no playground demo napplet (FWUI-02), no real WASM build of the hot path (FWX-01) — all deferred.

### Phases

- [x] **Phase 80: Firewall Pure Core (`@kehto/firewall`)** - Zero-dep, WASM-ready engine: normalized `Observation`, pure `evaluate()` (token-bucket rate, init-burst guard, content matchers, focus multiplier, precedence), pure config mutations + serialize, built-in defaults, pure-core unit suite. (completed 2026-06-15)
- [x] **Phase 81: Runtime Container & Choke-Point Integration** - Stateful `firewall-state` container, new `RuntimeAdapter` hooks, message-handler wiring after the ACL check, allow/deny/ask decision-to-action mapping with shell-sourced focus, and named-attack integration tests. (completed 2026-06-15)
- [ ] **Phase 82: Verification & Closeout** - Full unit suite (563+) and 87–89 E2E specs green, changeset for the new package and the runtime change, milestone closeout.

## Phase Details

### Phase 80: Firewall Pure Core (`@kehto/firewall`)
**Goal**: A pure, zero-dependency, WASM-ready `@kehto/firewall` package (mirroring `@kehto/acl`) that can evaluate a normalized observation against firewall config + counter state and return a decision plus the next counter state, with all rate/burst/content/focus/precedence logic and config serialization implemented as pure functions.
**Depends on**: Nothing (first phase of v1.18; new package, no runtime coupling yet)
**Requirements**: CORE-01, CORE-02, CORE-03, CORE-04, RATE-01, RATE-02, RATE-03, BURST-01, BURST-02, CONTENT-01, CONTENT-02, CONTENT-03, POLICY-03, FOCUS-02, VERIFY-01
**Success Criteria** (what must be TRUE):
  1. Calling the pure `evaluate()` with an `Observation` (`napplet`, `opClass`, `kind?`, `size?`, `initElapsedMs?`, `focused`, `msSinceFocusGain?`, `now`), a config, and counter state returns a decision (`pass` / `reject` / `prompt`) carrying `action`, `ruleId`, and `reason` plus the next counter state, with no I/O, mutation, or wall-clock read.
  2. A napplet that exceeds its per-`(dTag, opClass)` token-bucket budget triggers its configured exceed-action (`flag` / `block` / `ignore`); buckets refill from the injected `now` with O(1) fixed state, a per-napplet global budget acts as the fallback for op-classes with no specific rule, and the built-in defaults apply conservative rate/burst limits to every napplet with default exceed-action `flag`.
  3. The init-burst guard catches a napplet emitting more than the configured number of ops within its init window and defaults to `block`.
  4. Content matchers match on op-class, event `kind`(s) (including kind-5 delete spam), and/or payload `size`, can additionally condition on focus (`focused`, `maxMsSinceFocusGain`), and the unfocused-multiplier tightens an unfocused napplet's rate budget without ever hard-blocking on focus alone.
  5. Rule precedence resolves first-match-wins, most-to-least specific (per-napplet policy → per-napplet × op-class → per-napplet global fallback → global defaults); config mutates only through pure functions that return new config and round-trips through serialize/deserialize without loss; and pure-core unit tests cover refill, burst windows, matcher/focus matching, precedence, and serialize round-trip using injected `now`.
**Plans**: 3 plans
Plans:
- [x] 80-01-PLAN.md — Scaffold @kehto/firewall package + full types.ts surface + vitest alias
- [x] 80-02-PLAN.md — defaults.ts (built-in limits, flag/block defaults) + config.ts (immutable mutations, serialize, defensive deserialize) + tests
- [x] 80-03-PLAN.md — pure evaluate() engine (token bucket, init-burst, content matchers, focus multiplier, precedence) + barrel index.ts + tests

### Phase 81: Runtime Container & Choke-Point Integration
**Goal**: Wire the pure firewall into the runtime: a stateful container holding persisted config plus ephemeral counters and per-window init/focus tracking, new `RuntimeAdapter` hooks, and evaluation at the message-handler choke point after a successful ACL check, mapping allow/deny/ask decisions to dispatch/reject/consent actions with shell-sourced focus — proven by integration tests for each named attack.
**Depends on**: Phase 80
**Requirements**: POLICY-01, POLICY-02, FOCUS-01, RUNTIME-01, RUNTIME-02, RUNTIME-03, RUNTIME-04, VERIFY-02
**Success Criteria** (what must be TRUE):
  1. Every napplet message that passes the ACL check is evaluated by the firewall before dispatch; a `reject` decision sends an error envelope back to the napplet and drops the message, while a `flag` (allowed) operation still dispatches and emits an `onFirewallEvent` audit event.
  2. A per-napplet `allow` / `deny` / `ask` policy keyed by dTag (applies to any version) overrides rate/burst/content rules; an `ask` verdict rejects the current message, fires a consent prompt, and persists the user's choice as a per-napplet policy so subsequent messages are not re-prompted (no message buffering).
  3. The runtime exposes new `RuntimeAdapter` hooks — `firewallPersistence` (load/persist config), `onFirewallEvent` (audit callback for flag/block/prompt), and `getFocusContext(windowId)` — and firewall config persists across runtime reloads via `firewallPersistence` while ephemeral counters reset on reload.
  4. Focus context (`focused`, `msSinceFocusGain`) supplied to the firewall is sourced shell-side from the window manager via `getFocusContext`, never self-reported by the napplet.
  5. Runtime integration tests cover each named attack: publish flood (flag → block), init-burst block, backgrounded + init-burst, kind-5 delete spam, `ask` (reject + prompt + remembered), and unfocused-multiplier tightening.
**Plans**: 3 plans
Plans:
- [x] 81-01-PLAN.md — Workspace dep + firewall types + firewall-state container + container unit tests
- [x] 81-02-PLAN.md — Choke-point firewall gate, consent-handler hoist, container wiring in runtime.ts
- [x] 81-03-PLAN.md — Named-attack integration tests (flood, burst, kind-5, ask/remember, unfocused)

### Phase 82: Verification & Closeout
**Goal**: Prove the milestone is regression-clean and release-ready: the existing unit suite and full E2E baseline stay green with the firewall integrated, and a changeset is staged covering the new package and the runtime change.
**Depends on**: Phase 81
**Requirements**: VERIFY-03
**Success Criteria** (what must be TRUE):
  1. The existing unit suite (563+ tests) passes with the new `@kehto/firewall` package and runtime integration in place.
  2. The 87–89 E2E specs remain green, confirming the firewall choke-point change did not regress existing napplet message flows.
  3. A changeset is added covering the new `@kehto/firewall` package and the `@kehto/runtime` change.
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 80 → 81 → 82

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 80. Firewall Pure Core | 3/3 | Complete   | 2026-06-15 |
| 81. Runtime Container & Choke-Point Integration | 3/3 | Complete   | 2026-06-15 |
| 82. Verification & Closeout | 0/TBD | Not started | - |

## Backlog

### Backlog 999.1: Fix decrypt-demo fixture delivery pending state

**Goal:** Investigate and fix the playground `decrypt-demo` staying in `waiting for fixtures` / `[pending]` for NIP-04, NIP-44, NIP-17, and Class-2 probe rows.

**Captured:** 2026-05-23 via `$gsd-capture --backlog`

**Context:** `.planning/backlog/999.1-fix-decrypt-demo-fixture-pending/999.1-CONTEXT.md`

**Observed symptom:** User screenshot shows the decrypt demo panel stuck with:
- `waiting for fixtures`
- `NIP-04 [pending]`
- `NIP-44 [pending]`
- `NIP-17 [pending]`
- `Class-2 [pending]`

**Acceptance direction:**
- The playground decrypt demo receives fixtures reliably after boot.
- NIP-04, NIP-44, NIP-17, and Class-2 rows leave `[pending]` and settle to the expected terminal state.
- Regression coverage catches fixture-delivery stalls in the real playground path.

---

*ROADMAP.md last updated: 2026-06-15 - v1.19 NAP Ontology Alignment roadmap created (Phase 83); v1.18 Napplet Firewall shipped (Phases 80-82).*
