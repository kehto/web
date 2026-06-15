# Requirements: Kehto Runtime - v1.18 Napplet Firewall

**Defined:** 2026-06-15
**Core Value:** Modular, framework-agnostic runtime for hosting napplet applications.

**Milestone goal:** Add `@kehto/firewall` — a behavioral anti-abuse gate that observes napplet messages at the runtime choke point and applies configurable rate/burst/content rules with allow/deny/ask policies and focus-aware tightening. It composes with the ACL (static authorization) without replacing it: the ACL answers *is this napplet allowed to do X?*; the firewall answers *is this napplet abusing X over time?*

**Baseline entering v1.18:** Every napplet message flows through `createMessageHandler` (`packages/runtime/src/runtime.ts`), where `enforceNub` performs the static ACL capability check and rejects disallowed ops. `@kehto/acl` is a pure, zero-dep, WASM-ready module wrapped by a stateful `acl-state.ts` container with persistence. `@kehto/wm` owns window focus (`focusedWindowId`, `focus(id)`, `WindowState.focused`). Napplets are sandboxed cross-origin iframes; their internal pointer events are not observable by the shell.

**Scope boundary:** This milestone delivers the firewall engine, its runtime integration, and test coverage. It does not deliver a host/shell management UI for editing firewall rules, nor a real WASM build of the hot path — both are deferred. The firewall observes only messages that have already passed the ACL check.

## v1.18 Requirements

### Pure Core (`@kehto/firewall`)

- [ ] **CORE-01**: A host can evaluate a normalized `Observation` against firewall config + counter state via a pure function and receive a decision (`pass` / `reject` / `prompt`) with `action`, `ruleId`, and `reason`, plus the next counter state — with no I/O, mutation, or wall-clock reads.
- [x] **CORE-02**: The pure core operates only on the normalized `Observation` (`napplet`, `opClass`, `kind?`, `size?`, `initElapsedMs?`, `focused`, `msSinceFocusGain?`, `now`) and never parses protocol envelopes.
- [ ] **CORE-03**: Firewall config can be mutated through pure functions (set per-napplet policy, set rate limit, add content matcher) that return new config, and can be serialized and deserialized round-trip without loss.
- [ ] **CORE-04**: Built-in defaults apply conservative rate/burst limits to every napplet out of the box, with default exceed-action `flag`.

### Rate Limiting

- [ ] **RATE-01**: A napplet exceeding its per-operation-class rate budget triggers the configured exceed-action (`flag` / `block` / `ignore`).
- [ ] **RATE-02**: Rate limits use a token bucket keyed by `(napplet dTag, opClass)` with O(1) fixed state and time-based refill driven by the injected `now`.
- [ ] **RATE-03**: A per-napplet global rate budget applies as a fallback to operation classes that have no specific rule.

### Init-Burst Guard

- [ ] **BURST-01**: A napplet emitting more than the configured number of operations within its init window is caught by the burst guard.
- [ ] **BURST-02**: The init-burst guard defaults to `block` (no legitimate napplet needs a large burst in its first moments).

### Content Matchers

- [ ] **CONTENT-01**: A host can declare content matchers that match on operation class, event `kind`(s), and/or payload `size`, each with its own action.
- [ ] **CONTENT-02**: Content matchers can additionally condition on focus (`focused`, `maxMsSinceFocusGain`).
- [ ] **CONTENT-03**: Delete-spam (event kind 5) is detectable and actionable via a content matcher.

### Per-Napplet Policy (allow / deny / ask)

- [ ] **POLICY-01**: A per-napplet policy of `allow` / `deny` / `ask` overrides rate/burst/content rules for that napplet, keyed by dTag (applies to any version).
- [ ] **POLICY-02**: An `ask` verdict rejects the current message and fires a consent prompt; the user's choice is persisted as a per-napplet policy so subsequent messages are not re-prompted (no message buffering).
- [ ] **POLICY-03**: Rule precedence is first-match-wins, most-to-least specific: per-napplet policy → per-napplet × op-class rule → per-napplet global fallback → global defaults.

### Focus Context

- [ ] **FOCUS-01**: Focus context (`focused`, `msSinceFocusGain`) is sourced shell-side from the window manager and supplied to the firewall, never self-reported by the napplet.
- [ ] **FOCUS-02**: An unfocused napplet's rate budget is tightened by a configurable `unfocusedMultiplier`; focus alone never hard-blocks an operation.

### Runtime Integration

- [ ] **RUNTIME-01**: Every napplet message that passes the ACL check is evaluated by the firewall before dispatch; a `reject` decision sends an error envelope back to the napplet and drops the message.
- [ ] **RUNTIME-02**: The runtime exposes new `RuntimeAdapter` hooks: `firewallPersistence` (load/persist config), `onFirewallEvent` (audit callback for flag/block/prompt), and `getFocusContext(windowId)`.
- [ ] **RUNTIME-03**: Firewall config persists across runtime reloads via `firewallPersistence`; counters are ephemeral and reset on reload.
- [ ] **RUNTIME-04**: A `flag` (allowed) operation emits an `onFirewallEvent` audit event and still dispatches.

### Verification

- [ ] **VERIFY-01**: Pure-core unit tests cover token-bucket refill, burst windows, matcher matching (including focus conditions), rule precedence, and serialize round-trip, using injected `now`.
- [ ] **VERIFY-02**: Runtime integration tests cover each named attack: publish flood (flag → block), init-burst block, backgrounded + init-burst, kind-5 delete spam, `ask` (reject + prompt + remembered), and unfocused-multiplier tightening.
- [ ] **VERIFY-03**: The existing unit suite (563+) and the 87–89 E2E specs remain green, and a changeset is added for the new package and the runtime change.

## Future Requirements

Deferred to later milestones.

### Firewall Management & Visibility

- **FWUI-01**: Host/shell surface to view firewall events (flags, blocks) and edit per-napplet rules interactively.
- **FWUI-02**: Playground demo napplet(s) exercising the firewall behaviors end-to-end in the browser.

### Engine Extensions

- **FWX-01**: Real WASM port of the firewall hot path, gated on a benchmark proving the pure-TS core is the bottleneck.
- **FWX-02**: Observe and limit ACL-denied traffic (a napplet spamming ops it is not permitted to perform).
- **FWX-03**: Cross-napplet aggregate anomaly detection (system-wide abuse signals, not per-napplet).

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real WASM compilation now | Per-message work is tiny; content inspection forces JS↔WASM string marshalling that would be slower. Pure-TS WASM-ready mirrors `@kehto/acl`. Deferred to FWX-01. |
| Buffering/replaying the triggering message on `ask` | Chose "reject now, prompt async, remember choice" to avoid pending-message state at the hot path (POLICY-02). |
| Per-version firewall keys (dTag:hash) | Policy and counters key on dTag (version-agnostic), per the "any version" requirement (POLICY-01). |
| Persisting counters across reload | Counters are ephemeral by design; rate windows are short, so reset-on-reload is acceptable (RUNTIME-03). |
| Limiting ACL-denied messages | Firewall runs only after a successful ACL check in v1; observing denied traffic is FWX-02. |
| Firewall management UI / playground demo | Engine + adapter hooks only this milestone; host-facing UI is FWUI-01/02. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | Phase 80 | Pending |
| CORE-02 | Phase 80 | Complete |
| CORE-03 | Phase 80 | Pending |
| CORE-04 | Phase 80 | Pending |
| RATE-01 | Phase 80 | Pending |
| RATE-02 | Phase 80 | Pending |
| RATE-03 | Phase 80 | Pending |
| BURST-01 | Phase 80 | Pending |
| BURST-02 | Phase 80 | Pending |
| CONTENT-01 | Phase 80 | Pending |
| CONTENT-02 | Phase 80 | Pending |
| CONTENT-03 | Phase 80 | Pending |
| POLICY-01 | Phase 81 | Pending |
| POLICY-02 | Phase 81 | Pending |
| POLICY-03 | Phase 80 | Pending |
| FOCUS-01 | Phase 81 | Pending |
| FOCUS-02 | Phase 80 | Pending |
| RUNTIME-01 | Phase 81 | Pending |
| RUNTIME-02 | Phase 81 | Pending |
| RUNTIME-03 | Phase 81 | Pending |
| RUNTIME-04 | Phase 81 | Pending |
| VERIFY-01 | Phase 80 | Pending |
| VERIFY-02 | Phase 81 | Pending |
| VERIFY-03 | Phase 82 | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24 (Phase 80: 15, Phase 81: 8, Phase 82: 1)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-15*
*Last updated: 2026-06-15 — v1.18 roadmap created; traceability mapped to Phases 80-82.*
