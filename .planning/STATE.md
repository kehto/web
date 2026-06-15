---
gsd_state_version: 1.0
milestone: v1.18
milestone_name: Napplet Firewall
status: verifying
last_updated: "2026-06-15T14:22:00.000Z"
last_activity: "2026-06-15 — Plan 81-03 complete: 12 VERIFY-02 integration tests green (840/840 root suite, type-check clean)"
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 6
  completed_plans: 6
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-15, v1.18 started)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** v1.18 Napplet Firewall — build `@kehto/firewall` pure core, then runtime integration, then verification.

## Current Position

Phase: 81 — Runtime Container & Choke-Point Integration — COMPLETE (3/3 plans done)
Plan: 03 (complete)
Status: Phase 81 complete — firewall state container, choke-point gate, and VERIFY-02 integration tests all green; 840/840 unit tests; ready for Phase 82
Last activity: 2026-06-15 — Plan 81-03 complete: 12 VERIFY-02 firewall integration tests green (840/840 root suite, type-check clean)

## v1.18 Phase Sequence

- **Phase 80** (not started): Firewall pure core — new zero-dep `@kehto/firewall` package (mirrors `@kehto/acl`): normalized `Observation`, pure `evaluate()` (token-bucket rate, init-burst guard, content matchers, focus multiplier, precedence), pure config mutations + serialize, built-in defaults, pure-core unit tests. Covers CORE-01..04, RATE-01..03, BURST-01..02, CONTENT-01..03, POLICY-03, FOCUS-02, VERIFY-01 — 15 reqs.
- **Phase 81** (not started): Runtime container & choke-point integration — stateful `packages/runtime/src/firewall-state.ts` (persisted config + ephemeral counters + init/focus tracking), new `RuntimeAdapter` hooks (`firewallPersistence`, `onFirewallEvent`, `getFocusContext`), wiring in `runtime.ts`/`createMessageHandler` after the ACL check, allow/deny/ask decision-to-action mapping, shell-sourced focus, runtime integration tests for each named attack. Covers POLICY-01, POLICY-02, FOCUS-01, RUNTIME-01..04, VERIFY-02 — 8 reqs.
- **Phase 82** (not started): Verification & closeout — full unit suite (563+) and 87–89 E2E specs green, changeset for the new package + runtime change. Covers VERIFY-03 — 1 req.

Coverage: 24/24 requirements mapped, 0 unmapped.

## Design Anchors (user-approved, do not re-derive)

- `@kehto/firewall` is a NEW pure, zero-dep, WASM-ready package mirroring `@kehto/acl`; it is NOT real WASM — pure TypeScript structured for a later WASM swap (FWX-01).
- Clean dependency order drives the phase split: pure core (no runtime coupling) → stateful runtime container + choke-point wiring → verification/closeout.
- Firewall runs only after a successful ACL check, before dispatch. ACL = static authorization; firewall = behavioral abuse-over-time.
- `ask` is "reject now, prompt async, remember choice" — no message buffering.
- Policy and counters key on dTag (version-agnostic); counters are ephemeral (reset on reload), config persists.
- Focus is shell-owned/forge-proof via `@kehto/wm`; supplied through `getFocusContext(windowId)`, never self-reported by the napplet. Focus alone never hard-blocks.
- Constraints: ESM-only, zero framework deps, `@napplet/core` + `nostr-tools` peer deps, pnpm + turborepo + tsup + changesets, TS strict + `verbatimModuleSyntax`, 2-space indent, lowercase-hyphen filenames, JSDoc on public API.

## Accumulated Context

Full decision log (v1.0 → v1.17) lives in `.planning/PROJECT.md` Key Decisions table and per-milestone archives under `.planning/milestones/`.

### Blockers/Concerns

- No active blockers.
- v1.18 entering baseline: every napplet message flows through `createMessageHandler` (`packages/runtime/src/runtime.ts`) where `enforceNub` does the static ACL check. `@kehto/acl` is the pure/zero-dep precedent to mirror; `acl-state.ts` is the stateful-container precedent for `firewall-state.ts`. `@kehto/wm` owns focus.
- Verification gate to preserve: existing unit suite (563+) and 87–89 E2E specs must stay green; reload-heavy E2E specs need `test.setTimeout(120s)`.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260522-kvd | Remove old inter-frame terminology | 2026-05-22 | b844b25 | [260522-kvd-replace-old-interframe-terminology](./quick/260522-kvd-replace-old-interframe-terminology/) |
| 260522-lb0 | Determine vite-single-file playground napplet validity | 2026-05-22 | 8d763b5 | [260522-lb0-determine-validity-of-building-napplets-](./quick/260522-lb0-determine-validity-of-building-napplets-/) |
| 260523-h64 | Use published @napplet packages and remove submodules | 2026-05-23 | 32cc987, 791a2f9 | [260523-h64-use-published-napplet-packages-and-remov](./quick/260523-h64-use-published-napplet-packages-and-remov/) |
| 260523-ikp | Separate runtime demo surfaces from napplet cards | 2026-05-23 | 24af3d4, 91f8fb3 | [260523-ikp-runtime-helper-panes-should-not-be-label](./quick/260523-ikp-runtime-helper-panes-should-not-be-label/) |
| 260523-jev | Publish playground to GitHub Pages | 2026-05-23 | c89e746 | [260523-jev-create-a-workflow-that-publishes-the-pla](./quick/260523-jev-create-a-workflow-that-publishes-the-pla/) |
| 260523-alpha | Clarify alpha runtime positioning | 2026-05-23 | b0de00d | README/docs/splash |
| 260524-maf | Add the aislop-badge GitHub Action | 2026-05-24 | b5c39f7 | [260524-maf-add-the-aislop-badge-github-action-to-a-](./quick/260524-maf-add-the-aislop-badge-github-action-to-a-/) |
| 260606-g9z | Deslopify aislop duplicate exported type declarations | 2026-06-06 | 191a187 | [260606-g9z-deslopify-aislop-duplicate-exported-type](./quick/260606-g9z-deslopify-aislop-duplicate-exported-type/) |
| 260608-izc | Iterate Kehto static site landing page feedback | 2026-06-08 | 0a97b90, 633998a, 7e7679e, e16bc41 | [260608-izc-iterate-the-kehto-static-site-landing-pa](./quick/260608-izc-iterate-the-kehto-static-site-landing-pa/) |
| fast-web-runtime-label | Rename web landing label to Kehto Web Runtime | 2026-06-08 | 2e0f69e | web/index.html |
| 260608-lsu | Explore Kehto typography options | 2026-06-08 | 288df7d | [260608-lsu-explore-more-typographical-options-for-t](./quick/260608-lsu-explore-more-typographical-options-for-t/) |
| 260610-xa6 | Implement playground relay service with Applesauce and worker cache | 2026-06-10 | working tree | [260610-xa6-implement-playground-relay-service-with-](./quick/260610-xa6-implement-playground-relay-service-with-/) |
| 260611-2m4 | Remove fake playground feed data and scope feed subscriptions to NAP-IDENTITY | 2026-06-11 | working tree | [260611-2m4-remove-fake-feed-seed-data-and-make-play](./quick/260611-2m4-remove-fake-feed-seed-data-and-make-play/) |
| 260611-2ut | Get npx aislop scan to 100 | 2026-06-11 | working tree | [260611-2ut-get-npx-aislop-scan-to-100](./quick/260611-2ut-get-npx-aislop-scan-to-100/) |
| 260611-3pq | Adapt Kehto playground feed napplet to Hyprgate-style identity and shell relay flow | 2026-06-11 | working tree | [260611-3pq-adapt-kehto-playground-feed-napplet-to-h](./quick/260611-3pq-adapt-kehto-playground-feed-napplet-to-h/) |
| 260611-3x1 | Feed napplet must recover when signer connects after initial empty identity | 2026-06-11 | working tree | [260611-3x1-feed-napplet-must-recover-when-signer-co](./quick/260611-3x1-feed-napplet-must-recover-when-signer-co/) |
| 260611-42d | Persist playground signer login across reloads and store NIP-46 bunker secret | 2026-06-11 | working tree | [260611-42d-persist-playground-signer-login-across-r](./quick/260611-42d-persist-playground-signer-login-across-r/) |
| 260611-iok | Switch playground feed to Hyprgate-style following outbox feed | 2026-06-11 | working tree | [260611-iok-switch-playground-feed-to-hyprgate-style](./quick/260611-iok-switch-playground-feed-to-hyprgate-style/) |
| 260611-l1s | Show profile images and names in playground feed | 2026-06-11 | working tree | [260611-l1s-show-profile-images-and-names-in-playgro](./quick/260611-l1s-show-profile-images-and-names-in-playgro/) |
| 260611-ln6 | Replace NIP-66 fixture panel with relay activity stats | 2026-06-11 | working tree | [260611-ln6-replace-nip-66-fixture-panel-with-relay-](./quick/260611-ln6-replace-nip-66-fixture-panel-with-relay-/) |
| 260611-lwz | Show feed publish time instead of truncated pubkey | 2026-06-11 | working tree | [260611-lwz-show-feed-publish-time-instead-of-trunca](./quick/260611-lwz-show-feed-publish-time-instead-of-trunca/) |
| 260611-mq3 | Implement NAP-01 profile viewer and clickable feed profiles | 2026-06-11 | working tree | [260611-mq3-implement-nap-01-profile-viewer-and-clic](./quick/260611-mq3-implement-nap-01-profile-viewer-and-clic/) |
| 260611-o91 | Improve playground theme switcher discovery | 2026-06-11 | working tree | [260611-o91-improve-playground-theme-switcher-discov](./quick/260611-o91-improve-playground-theme-switcher-discov/) |
| 260611-prm | Define and wire NAP-IDENTITY identity.changed handshake | 2026-06-11 | working tree | [260611-prm-define-and-wire-nap-identity-identity-ch](./quick/260611-prm-define-and-wire-nap-identity-identity-ch/) |
| 260611-q7p | Persist playground UI session state | 2026-06-11 | working tree | [260611-q7p-persist-playground-ui-session-state](./quick/260611-q7p-persist-playground-ui-session-state/) |

## Session Continuity

Last session: 2026-06-15T16:22:00.000Z
Resume: Phase 81 Plan 03 complete — VERIFY-02 integration tests green (840/840). Phase 81 complete. Ready to execute Phase 82 (verification & closeout: E2E + changeset).
Current milestone: v1.18 Napplet Firewall.

## Decisions Made

- **BurstGuard is first-class field in NappletRules** (not ContentMatcher) — per RESEARCH Open Question 2 resolution
- **@kehto/firewall scaffolded as exact structural mirror of @kehto/acl** — zero runtime deps, ESM-only, tsup build, verbatimModuleSyntax
- **setGlobalRate is a separate exported function** (not an overload of setRateLimit) — clearer API, mirrors acl's distinct setQuota
- **DEFAULT_EXCEED_ACTION='flag', DEFAULT_BURST_ACTION='block'** — conservative allow+audit default with documented burst exception (CORE-04, BURST-02)
- **DEFAULT_UNFOCUSED_MULTIPLIER=0.25** — tightens unfocused budget without zeroing it (FOCUS-02 invariant)
- **ruleId encodes resolution tier (rate:opclass|global|default)** — not 'rate:ok' — ruleId is the audit trail for callers
- **utf8ByteLength replaces TextEncoder in extractKindSize** — ES2022 lib does not include DOM types; mirrors existing state-handler.ts helper
- **consentHandlerRef mutable cell bridges outer/inner closure scopes** — POLICY-02 prompt flow: createRuntime allocates { current }, registerConsentHandler sets it, fireConsent reads it

## Operator Next Steps

- Phase 81 complete. Execute Phase 82 (verification & closeout): E2E green confirmation + changesets for @kehto/firewall (new package) and @kehto/runtime (firewall integration).
- VERIFY-02 requirements satisfied. VERIFY-03 (E2E green + changeset) is Phase 82's scope.
