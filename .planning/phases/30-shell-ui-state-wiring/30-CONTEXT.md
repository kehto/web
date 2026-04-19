# Phase 30: Shell UI State Wiring - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning
**Mode:** Smart-discuss batch acceptance (user accepted all 3 grey-area recommendations)

<domain>
## Phase Boundary

Fix three shell-UI state surfaces that never populated under NUB envelope traffic. All three are pre-existing v1.3-era gaps that v1.4 didn't address; surfaced by post-v1.4 UAT. Each has a concrete root cause confirmed during scout:

- **UI-01:** Service node activity counters (`ACTIVITY: 0 recent` on every service node) stay at zero even while NUB traffic flows. Root cause: `apps/demo/src/node-details.ts:installActivityProjection()` routes `pushActivity` to shell/acl/runtime nodes + per-napplet nodes + the signer service node, but **NOT to other service-level nodes** (identity/ifc/keys/media/notify/relay/storage/theme). Fix: route tapped envelopes to `topology-node-service-${domain}` by parsing the first dotted segment of `msg.type`.

- **UI-02:** ACL Capability Matrix modal ("System Policy → ACL Capability Matrix") shows "No authenticated napplets" even when 10 napplets are authenticated. Root cause: `apps/demo/src/shell-host.ts:aclAdapter.snapshot()` line 1107 contains `if (!info.pubkey) continue;` — filters out NIP-5D napplets (which have empty pubkey and identify via dTag). Of v1.4's 10 napplets, 8 are NIP-5D and get dropped from the snapshot; the 2 NIP-01 napplets (bot/chat) are included but the rest are not — AND even those 2 may be excluded if `info.pubkey` is empty. Fix: include Path B (NIP-5D, info.authenticated=true) napplets in the snapshot regardless of pubkey value.

- **UI-03:** Debugger Sequence Diagram renders exactly three lanes (Chat / Shell / Bot) regardless of which napplets are actually sending traffic. Root cause: `apps/demo/src/sequence-diagram.ts:29` hardcodes `const LANE_NAMES = ['Chat', 'Shell', 'Bot'];`. Fix: derive lanes from the set of napplet names observed in the captured messages (resolve `msg.windowId` → napplet name via the nappletInfos map).

In scope:
- `apps/demo/src/node-details.ts:installActivityProjection()` — add service-level routing.
- `apps/demo/src/shell-host.ts:aclAdapter.snapshot()` — accept Path B napplets.
- `apps/demo/src/sequence-diagram.ts` — replace hardcoded `LANE_NAMES` with a dynamic derivation from observed messages.
- Manual UAT (automated via Playwright MCP) at phase close to confirm all three surfaces work with the fix applied.
- Hard gate on 49/0/0 existing Playwright specs.
- No new specs in Phase 30 — automated regression coverage is E2E-16 (Phase 31 scope).

Out of scope:
- New E2E specs (E2E-16 is Phase 31).
- Visual redesign of any of the three surfaces — wiring only, against existing DOM.
- Legacy `audio-service` integration — not in `topology.services`; out of v1.5 scope.
- New UI components or layout changes.

</domain>

<decisions>
## Implementation Decisions

### Area 1: UI-01 Service Activity Counter Wiring (ACCEPTED)

- **Location:** `apps/demo/src/node-details.ts:installActivityProjection()` — extend the existing routing block that handles shell/acl/runtime/signer/per-napplet with a new service-level routing pass.
- **Domain extraction:** Parse `msg.type` by splitting on the first `.`. Example: `'storage.get'` → `'storage'`; `'theme.changed'` → `'theme'`; `'media.session.create.result'` → `'media'`. `.result` / `.error` suffixes inherit the same domain as the root type.
- **Service-node ID:** `topology-node-service-${domain}` — already the convention for signer (`topology-node-service-signer`). Domain values from envelope types map directly to topology.services array entries **except for one rename**: envelope domain `'notify'` → topology service id fragment `'notifications'`. Implement as:
  ```ts
  const SERVICE_DOMAIN_ALIAS: Record<string, string> = {
    'notify': 'notifications',
  };
  const serviceKey = SERVICE_DOMAIN_ALIAS[domain] ?? domain;
  if (topology.services.includes(serviceKey)) {
    pushActivity(`topology-node-service-${serviceKey}`, entry);
  }
  ```
  The `topology.services.includes()` guard ensures unknown domains don't create orphan rings.
- **Legacy audio-service:** Untouched. `audio-service` is pre-NIP-5D and uses the topic-based `audio:*` channel, not a NUB domain. Not in `topology.services` → guard skips it.
- **Existing routes preserved:** shell/acl/runtime route every message; signer route stays keyed on `'identity-request' | 'relay-publish-signed'`; per-napplet routes preserved. The new service-level pass is additive.

### Area 2: UI-02 + UI-03 Fixes (ACCEPTED)

#### UI-02 — shell-host.ts aclAdapter.snapshot()

- **Current bug:** Line 1107 `if (!info.pubkey) continue;` drops all NIP-5D napplets from the snapshot. Path B napplets always have `pubkey === ''`.
- **Fix:** Replace the filter with a gate that accepts either Path A OR Path B:
  ```ts
  // Accept both Path A (NIP-01, pubkey populated) and Path B (NIP-5D, authenticated via dTag).
  if (!info.authenticated) continue;
  ```
  `info.authenticated` is set to true for both paths (shell-host.ts:810-840 AUTH tracking).
- **ACL check calls inside snapshot:** Already pass `info.pubkey ?? ''`, `info.dTag ?? ''`, `info.aggregateHash ?? ''` to `aclState.check()`. aclState already handles empty-pubkey + dTag-keyed lookups correctly (v1.2 canonical behavior). No changes needed to the check calls.
- **Row count at boot:** With the fix applied, the snapshot returns one row per authenticated napplet. At post-v1.4 boot that's 10 rows. The "No authenticated napplets" fallback only displays if `snapshot()` returns `[]` (i.e., no napplet has auth'd yet).

#### UI-03 — sequence-diagram.ts

- **Current bug:** Line 29 hardcodes `const LANE_NAMES = ['Chat', 'Shell', 'Bot'];`. Line 5 docblock explicitly says "three lanes: Left: Chat, Center: Shell, Right: Bot."
- **Fix:** Derive lanes dynamically from the set of napplet names observed in the captured messages:
  ```ts
  function deriveLanes(messages: TappedMessage[], nappletInfos: Map<string, NappletInfo>): string[] {
    const napplets = new Set<string>();
    for (const m of messages) {
      if (!m.windowId) continue;
      const info = nappletInfos.get(m.windowId);
      if (info?.name) napplets.add(info.name);
    }
    // Shell in center; napplet lanes sorted alphabetical on either side.
    const sorted = Array.from(napplets).sort();
    const mid = Math.ceil(sorted.length / 2);
    return [...sorted.slice(0, mid), 'Shell', ...sorted.slice(mid)];
  }
  ```
- **Lane ordering:** Alphabetical except Shell is always centered. Napplets split roughly evenly left/right of Shell (by count, not by character). Deterministic + readable.
- **SVG width scaling:** Current layout assumes 3 lanes at fixed X-coords. Replace with dynamic width = `laneCount * LANE_WIDTH + PADDING`. Each message arrow resolves the source/target lane X by `lanes.indexOf(name)`.
- **`renderSequenceDiagram()` signature:** Needs access to the `nappletInfos` map. Current signature takes `messages: TappedMessage[]`; extend to accept `nappletInfos` as a second arg OR read it from a shared accessor (already exposed via `getNapplets()` from shell-host.ts). Prefer passing explicitly for testability.
- **Docblock update:** Replace the "Left: Chat / Center: Shell / Right: Bot" text with a description of dynamic derivation.

### Area 3: Plan Structure & Verification (ACCEPTED)

- **3 plans — one per REQ-ID**:
  - `30-01-PLAN.md` — UI-01 fix in `node-details.ts`. Files: `apps/demo/src/node-details.ts`.
  - `30-02-PLAN.md` — UI-02 fix in `shell-host.ts`. Files: `apps/demo/src/shell-host.ts`.
  - `30-03-PLAN.md` — UI-03 fix in `sequence-diagram.ts`. Files: `apps/demo/src/sequence-diagram.ts` (+ possibly `debugger.ts` if renderSequenceDiagram signature changes propagate).
- **All 3 plans in wave 1, parallel.** No code dependencies between them — each touches a different file. Parallel-safe.
- **Verification strategy:**
  - Hard gate on 49/0/0 existing Playwright specs.
  - Phase-close Playwright MCP UAT (automated by Claude, like Phase 29 pattern) captures evidence for all three surfaces:
    - Service activity counters — assert at least one service node's `ACTIVITY` counter increments after the boot-storm of NUB traffic.
    - ACL Capability Matrix — assert the modal renders ≥ 1 authenticated napplet row (boot shows 10).
    - Sequence Diagram — assert ≥ 4 lanes rendered (Shell + at least 3 napplets, typically 10+1=11 at boot).
  - Automated regression coverage deferred to Phase 31's E2E-16.
- **No UI-SPEC.** Wiring-only changes against existing DOM. No visual design, layout, or copywriting decisions. `gsd:ui-phase` skipped.

</decisions>

<code_context>
## Existing Code Insights

### Root cause evidence

- `apps/demo/src/node-details.ts:installActivityProjection` lines 425-455: routes to shell, acl, runtime, signer, and per-napplet nodes. NO service-level routing for other domains.
- `apps/demo/src/shell-host.ts:aclAdapter.snapshot` line 1105-1137: filter at line 1107 drops napplets with empty pubkey.
- `apps/demo/src/sequence-diagram.ts` line 29: `const LANE_NAMES = ['Chat', 'Shell', 'Bot'];` hardcoded.

### Playwright MCP baseline (captured during Phase 29 UAT at :4174 post-29-01)

```
Services (all at ACTIVITY: 0 recent, LAST ACTION: —):
  identity, keys, media, notifications, relay, storage, theme
  (signer is the exception — already wired; showed activity: 4 recent, last action: identity-request)

Authenticated napplets: all 10 (bot, chat, composer, feed, hotkey-chord, media-controller,
  preferences, profile-viewer, theme-switcher, toaster) — per topology cards.

ACL Matrix: opens, shows capability column headers, renders "No authenticated napplets" as body.

Sequence Diagram: 3 lanes (Chat / Shell / Bot). Chat lane has 18+ storage.get round-trips
  visible. Other 8 napplets' traffic is absent from the diagram.
```

### Reusable Assets

- `pushActivity(nodeId, entry)` private helper in node-details.ts — adds to bounded ring buffer.
- `topology.services` DemoTopology field — canonical service list (identity/ifc/keys/media/notifications/relay/signer/storage/theme).
- `napplets` Map<windowId, NappletInfo> in shell-host.ts — authoritative napplet state.
- `getNapplets()` and `getAclAdapter()` accessors from shell-host.ts — already exported.
- `info.authenticated: boolean` — Path A and Path B both set this to true.

### Established Patterns

- Activity rings are bounded per-node (ACTIVITY_RING_SIZE constant).
- pushActivity is idempotent per-message — no dedupe needed.
- SVG lanes use fixed LANE_WIDTH constant; scale by lane count.
- Service-node IDs follow `topology-node-service-${name}` — one established precedent (`topology-node-service-signer`).

### Integration Points

- `apps/demo/src/node-details.ts` — `installActivityProjection()` (30-01 only).
- `apps/demo/src/shell-host.ts` — `aclAdapter.snapshot()` (30-02 only).
- `apps/demo/src/sequence-diagram.ts` — `LANE_NAMES` + `renderSequenceDiagram` signature (30-03 only).
- `apps/demo/src/debugger.ts` — may need a small touch if 30-03 changes `renderSequenceDiagram`'s signature (new arg). Acceptable within 30-03 scope.

</code_context>

<specifics>
## Specific Ideas

- **UI-01 acceptance criterion:** After fix, Playwright MCP loads `:4174`, waits 12s, reads the text content of `#topology-node-service-storage` — should show `ACTIVITY: N recent` where N ≥ 1 (storage.get traffic fires on boot for every napplet). Also assert `LAST ACTION: storage.get` or `storage.get.result`.
- **UI-02 acceptance criterion:** Playwright MCP opens ACL Matrix modal via clicking the "System Policy" action (or whatever triggers `openPolicyModal()`), then reads the table body — should contain ≥ 10 rows (one per authenticated napplet), not "No authenticated napplets".
- **UI-03 acceptance criterion:** Playwright MCP clicks the "Sequence" tab in the debugger, waits for render, counts the number of lanes in the SVG — should be ≥ 4 (at least Shell + 3 napplets). After boot-storm, expect 10 napplet lanes + Shell = 11 lanes total.
- **notify→notifications rename:** Single-alias Map is the cleanest pattern. Extension via adding more aliases later if domain-vs-topology-id drift reappears.
- **sequence-diagram lane alphabetization:** With 10 napplets, sorted alphabetical = `bot, chat, composer, feed, hotkey-chord, media-controller, preferences, profile-viewer, theme-switcher, toaster`. Split at midpoint index 5 → left: bot, chat, composer, feed, hotkey-chord + Shell center + right: media-controller, preferences, profile-viewer, theme-switcher, toaster.

</specifics>

<deferred>
## Deferred Ideas

- **E2E-15/16 spec coverage** — Phase 31.
- **Visual polish** of service nodes (design refresh) — out of v1.5 scope per REQUIREMENTS.md Out of Scope.
- **Legacy audio-service integration** — not in topology.services; not addressed in v1.5.
- **Chat storage.get storm perf fix (PERF-01)** — deferred to v1.6.

</deferred>
