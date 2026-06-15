# Phase 81: Runtime Container & Choke-Point Integration - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning
**Source:** Approved design brief (brainstorming session, 2026-06-15)

<domain>
## Phase Boundary

This phase integrates the pure `@kehto/firewall` engine (delivered in Phase 80) into `@kehto/runtime`. It adds a stateful container (`packages/runtime/src/firewall-state.ts`, mirroring `acl-state.ts`), wires firewall evaluation into the existing message choke point (`createMessageHandler` in `packages/runtime/src/runtime.ts`), adds new `RuntimeAdapter` hooks, implements the allow/deny/ask decision→action mapping (including the consent flow), sources focus context shell-side, and adds runtime integration tests.

In scope: `firewall-state.ts` container; `Observation` extraction from `NappletMessage` envelopes; new `RuntimeAdapter` hooks (`firewallPersistence`, `onFirewallEvent`, `getFocusContext`); the post-ACL firewall gate in `createMessageHandler`; per-napplet allow/deny/ask policy with consent-and-remember; ephemeral counters + persisted config + per-window init/focus tracking; runtime integration tests for the named attacks.

Out of scope: the pure engine itself (done, Phase 80 — consume it by import, do NOT modify `packages/firewall/`); the changeset + whole-repo/E2E green closeout (Phase 82); any host/shell management UI; observing ACL-denied traffic.
</domain>

<decisions>
## Implementation Decisions (LOCKED — user-approved)

### Integration point (RUNTIME-01)
- The firewall gate runs in `createMessageHandler` (`packages/runtime/src/runtime.ts`, ~line 161) **immediately AFTER a successful ACL `enforceNub` check and BEFORE `dispatchNubEnvelope`**. Messages the ACL already rejected never reach the firewall (v1).
- On a `reject` decision: send an error envelope back to the napplet (mirror the existing ACL denial path — `hooks.sendToNapplet(windowId, { type: '<type>.error' | '<storage>.result', id, error: 'firewall: <reason>' })`) and DROP the message (return, no dispatch).
- On a `pass` decision with action `flag`: emit `onFirewallEvent` (audit) then dispatch normally.
- On a `pass` decision (action `ignore` or allow policy): dispatch normally.
- On a `prompt` decision (`ask` policy): reject the current message (as above) AND fire the consent flow (see POLICY-02).

### Stateful container (mirror `acl-state.ts`) (RUNTIME-03)
- `packages/runtime/src/firewall-state.ts` wraps the pure `@kehto/firewall` engine, exactly mirroring how `acl-state.ts` wraps `@kehto/acl`.
- Holds: the immutable `FirewallConfig` (persisted) and the mutable counter state (`FirewallState`, ephemeral — in-memory, reset on reload; rate windows are short).
- Tracks per-window: init timestamp (for `initElapsedMs`) — though focus is sourced via the adapter hook, init time is runtime-owned (set when the napplet window is registered/created).
- Imperative API mirroring acl-state: `evaluate(observation)`, `setPolicy`, `setRateLimit`, `addMatcher`, `getRules`/`getConfig`, `persist`, `load`, `clear`.
- `persist`/`load` use the new `firewallPersistence` hook (config only — counters are never persisted), exactly like `aclPersistence`.

### New RuntimeAdapter hooks (RUNTIME-02)
Add to `RuntimeAdapter` (in `packages/runtime/src/types.ts`), mirroring existing hook conventions:
- `firewallPersistence: FirewallPersistence` (or optional with a no-op default — match how `aclPersistence` is required/typed; prefer required to mirror acl, OR optional if that's cleaner for host migration — planner decides, but default behavior must not break existing hosts). Define the `FirewallPersistence` interface mirroring `AclPersistence` (`persist(serialized: string): void; load(): string | null`).
- `onFirewallEvent?: (event: FirewallEvent) => void` — optional audit callback, analogous to `onAclCheck`. `FirewallEvent` carries `{ napplet/windowId, opClass, decision, action, ruleId, reason, message? }`.
- `getFocusContext?: (windowId: string) => { focused: boolean; msSinceFocusGain?: number }` — optional; when absent, default to `{ focused: true }` (a host without a window manager treats everything as focused, so focus never tightens — safe default).

### Observation extraction (the runtime-side boundary) (CORE-02 boundary on the runtime side; RUNTIME-01)
- A runtime helper builds the normalized `Observation` from the `NappletMessage` envelope + `windowId`:
  - `napplet` = the dTag from `sessionRegistry.getEntryByWindowId(windowId)` (version-agnostic key).
  - `opClass` = derived from `envelope.type` (e.g. `relay.publish` → `relay:write`, `outbox.publish` → `outbox:publish`, `intent.invoke` → `intent:invoke`). Reuse the existing capability-resolution that `resolveCapabilitiesNub` already performs where possible.
  - `kind` / `size` = extracted from publish-style payloads (the event object's `kind`; serialized byte size) when present; otherwise undefined.
  - `initElapsedMs` = `now - windowInitTime[windowId]`.
  - `focused` / `msSinceFocusGain` = from `hooks.getFocusContext(windowId)` (or the safe default).
  - `now` = `Date.now()` (the runtime owns the clock; the PURE engine still never reads it — the runtime injects it here).
- The pure engine never sees the envelope — only this Observation. This is the runtime's job, not the package's.

### Per-napplet policy allow/deny/ask (POLICY-01, POLICY-02)
- POLICY-01: per-napplet policy keyed by dTag overrides rules. Exposed via the container's `setPolicy`.
- POLICY-02 (ask): on a `prompt` decision, reject the current message AND invoke the existing `ConsentHandler` (already registered via `runtime.registerConsentHandler`) — reuse it; do NOT build a second consent mechanism. When the user's choice resolves, persist it as a per-napplet policy (`setPolicy(dTag, 'allow' | 'deny')`) via the container + `firewallPersistence`, so subsequent messages are NOT re-prompted. No message buffering — the triggering message is simply dropped ("reject now, prompt async, remember choice").

### Focus sourced shell-side (FOCUS-01)
- The runtime never trusts napplet self-reported interaction. Focus comes only from `hooks.getFocusContext(windowId)`, which the shell implements on top of `@kehto/wm` (`focusedWindowId`, focus-change timestamps). Phase 81 defines + consumes the hook; the shell-side `@kehto/wm` implementation of it is the host's concern (a reference wiring may be added but the runtime contract is the hook).

### Flagged-event still dispatches (RUNTIME-04)
- A `flag` action emits `onFirewallEvent` and then dispatches — the message is NOT dropped.

### Tests (VERIFY-02)
Runtime integration tests (mirror existing runtime `*.test.ts` style, e.g. `dispatch.test.ts`, `acl-state.test.ts`) covering each named attack through `handleMessage`:
- publish flood → flag then block (as budget exhausts / rule escalates)
- init-burst → block
- backgrounded (unfocused) + init-burst → block (sharper)
- kind-5 delete spam → matcher action
- ask → reject current + consent fired + choice remembered (no re-prompt)
- unfocused-multiplier → tighter budget than focused
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The pure engine being integrated (Phase 80 — consume, do not modify)
- `packages/firewall/src/index.ts` — the public surface (evaluate, config mutations, defaults, types).
- `packages/firewall/src/types.ts` — `Observation`, `FirewallConfig`, `FirewallState`, decision/action types.
- `packages/firewall/src/evaluate.ts` — the `evaluate(config, state, observation)` contract.

### Mirror targets in @kehto/runtime
- `packages/runtime/src/acl-state.ts` — the container pattern to mirror for `firewall-state.ts`.
- `packages/runtime/src/runtime.ts` — `createMessageHandler` (the choke point), `createRuntime` (where `aclState`/`enforceNub` are built — build the firewall container here too), the existing ACL denial path to mirror for firewall reject.
- `packages/runtime/src/enforce.ts` — `resolveCapabilitiesNub` (envelope→capability) — reuse for opClass derivation.
- `packages/runtime/src/types.ts` — `RuntimeAdapter` (line ~589), `AclPersistence` (line ~169), `ConsentHandler` (line ~318), `AclCheckEvent` / `onAclCheck` (line ~663) — the exact shapes to mirror for the new hooks.
- `packages/runtime/src/session-registry.ts` — `getEntryByWindowId` (windowId → dTag).
- `packages/runtime/src/index.ts` — barrel; export new public types (FirewallPersistence, FirewallEvent, etc.).

### Window manager (focus source)
- `packages/wm/src/index.ts` — `focusedWindowId`, `focus(id)`, `WindowState.focused` (what `getFocusContext` is built on, host-side).

### Requirements
- `.planning/REQUIREMENTS.md` — the 8 phase-81 requirement IDs and exact wording.
</canonical_refs>

<specifics>
## Specific Ideas

- Wire the firewall container into `createRuntime` right next to `createAclState`/`createNubEnforceGate`, and pass `firewall.evaluate(...)` into the message handler the same way `enforceNub` is passed.
- Backward compatibility: existing hosts must keep working. If `firewallPersistence` is made required, provide an in-repo no-op/in-memory default OR make it optional with a safe default so current callers (playground, tests) don't break. The whole-repo suite (819 tests) and E2E (87–89) must stay green — that's enforced in Phase 82 but keep it in mind here.
- `getFocusContext` absent → `{ focused: true }`: a host with no WM never gets focus-tightened (focus only ever relaxes the default, never penalizes a host that can't report focus).
- Keep `createMessageHandler` readable — extract the Observation-building and the decision→action mapping into small helpers rather than inflating the handler (the repo has an aislop structural-complexity gate; Phase 76 decomposed runtime.ts for exactly this reason).

## Open questions for the planner/researcher to resolve
- Exact opClass mapping table from `envelope.type` (lean on `resolveCapabilitiesNub`).
- Whether `firewallPersistence` is required vs optional (pick the option that keeps existing hosts/tests green with least friction).
- Where window init-time is recorded (session registry entry creation vs a dedicated map in the container).
</specifics>

<deferred>
## Deferred Ideas

- Changeset for `@kehto/firewall` + `@kehto/runtime`, whole-repo unit + E2E green confirmation → **Phase 82**.
- Real WASM, ACL-denied-traffic observation, cross-napplet anomaly detection, management UI / playground demo → future milestones.
- The concrete `@kehto/wm`-based `getFocusContext` implementation in a real shell → host concern (runtime defines the hook contract).
</deferred>

---

*Phase: 81-runtime-container-choke-point-integration*
*Context gathered: 2026-06-15 from approved design brief*
