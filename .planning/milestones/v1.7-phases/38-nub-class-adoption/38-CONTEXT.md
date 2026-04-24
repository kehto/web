# Phase 38: NUB-CLASS Adoption - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning
**Mode:** Smart discuss (grey-area batch — all 12 recommendations accepted by user)

<domain>
## Phase Boundary

Shell resolves class posture synchronously at iframe creation and enforces it uniformly across all NUB domains via a centralized `enforce.ts` gate — so a class-restricted napplet cannot invoke capabilities outside its posture regardless of which NUB domain it uses.

Phase 38 ships **mechanism, not policy**: the 10 existing DEMO_NAPPLETS all keep the permissive default (`class: null`) so no existing E2E spec regresses. The cross-NUB invariant spec exercises class gating via a test-only hook that temporarily assigns a restrictive class to one napplet.

</domain>

<decisions>
## Implementation Decisions

### Grey Area 1: Class taxonomy & data placement
- **D1**: Class value format is **string tokens** (e.g., `'class-1'`, `'class-2'`, `null`). Matches `packages/shell/src/types/provisional-class.ts` which already exports `NappletClass = string | null`. Readable in logs + audit events.
- **D2**: Default class when `CLASS_BY_DTAG` has no entry is **`null` (permissive)**. All 10 existing demo napplets (chat, bot, composer, preferences, toaster, feed, profile-viewer, theme-switcher, hotkey-chord, media-controller) default to `null` — no existing E2E spec regresses.
- **D3**: `CLASS_BY_DTAG` lives in `apps/demo/src/shell-host.ts` **adjacent to `DEMO_NAPPLETS`** (v1.5 Decision 16 data-driven-UI pattern).
- **D4**: CI assertion for `CLASS_BY_DTAG` vs `DEMO_NAPPLETS` coverage is a **module-load assertion in `shell-host.ts`** — throws at import time if any `DEMO_NAPPLETS` entry lacks a corresponding `CLASS_BY_DTAG` entry. Adding a future napplet without updating `CLASS_BY_DTAG` breaks `pnpm build`.

### Grey Area 2: enforce.ts class integration
- **D5**: Class is attached to the **session entry** (packages/runtime/src/session-registry.ts `SessionEntry` gains a `class: NappletClass` field). `enforce.ts` reads class via the existing `resolveIdentity` hook — extended to return `{ dTag, aggregateHash, class }`.
- **D6**: Class check runs **BEFORE capability check**. Class-forbidden failures short-circuit the gate.
- **D7**: `EnforceResult` gains a `reason: 'allowed' | 'capability-missing' | 'class-forbidden'` field. Audit callback (`onAclCheck`) receives the reason.
- **D8**: Class policy lives in a **hardcoded per-class capability allowlist in `packages/runtime/src/enforce.ts`**: `class-1` = all capabilities, `class-2` = excludes `relay:write` (sample restrictive class for the invariant test). Extensible; future classes added as NUB specs mature.

### Grey Area 3: Layer-B invariant spec
- **D9**: E2E spec exercises class gating via a `window.__setNappletClass__(dTag, class)` test hook exposed by demo `main.ts`. Hook mutates the session entry class on the fly; no real policy decisions encoded in `CLASS_BY_DTAG`.
- **D10**: Spec targets **`theme-switcher`** — its only NUB interaction is `theme.changed` (a `relay:write` under `'class-2'`). Clean "blocked when class-2" assertion.
- **D11**: `tests/e2e/class-invariant.spec.ts` contains **one test per active NUB domain** (identity, ifc, keys, media, notify, relay, storage, theme — 8 tests) parameterized via a `test.describe` loop. Each test assigns `class-2` to theme-switcher, attempts a cross-NUB action, asserts block + audit event.
- **D12**: Class assignment **resets between tests** via `test.beforeEach` — no global state leak.

### Claude's Discretion
- The provisional-class.ts `ClassAssignmentPayload` shape is already set; Phase 38 may extend it minimally if needed (e.g., add audit timestamp) but prefer keeping it as-is.
- Naming of the internal class-policy allowlist (e.g., `CLASS_CAPABILITY_ALLOWLIST` vs `CLASS_POLICY`) is at Claude's discretion.
- The audit event type for `class-forbidden` can either reuse `AclCheckEvent` with the new `reason` field or introduce a `ClassCheckEvent` — Claude decides based on existing audit-event patterns in `packages/runtime/src/types.ts`.
- Exact test-hook signature (`window.__setNappletClass__(dTag, class)`) may be adjusted for consistency with existing test hooks (e.g., `__grantKeysForward__`, `__grantMediaControl__` per v1.4).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/shell/src/types/provisional-class.ts` — `NappletClass = string | null`, `ClassAssignmentPayload` ready to use (Phase 37)
- `packages/shell/src/types.ts:297` — `onNip5dIframeCreate?: (windowId: string) => { dTag: string; aggregateHash: string } | null;` — hook to expand
- `packages/shell/src/shell-bridge.ts:213-224` — shell.init emission site (post shell.ready handshake)
- `packages/shell/src/session-registry.ts` — `SessionEntry` structure; add `class` field here
- `packages/runtime/src/enforce.ts` — `createEnforceGate()` + `EnforceConfig`/`EnforceResult`/`IdentityResolver` types
- `apps/demo/src/shell-host.ts:126` — `DEMO_NAPPLETS` array (10 entries); add `CLASS_BY_DTAG` adjacent
- Test-hook precedent: v1.4 `__grantKeysForward__`, `__grantMediaControl__` on window for E2E

### Established Patterns
- Data-driven demo UI (Decision 16 v1.5) — any new per-napplet config lives alongside DEMO_NAPPLETS as a parallel map/array
- Closure-scoped factory patterns for services
- Audit callback pattern: `onAclCheck(event: AclCheckEvent)` — extend with `reason` field
- Breaking API changes for public hooks documented with minor-bump changeset (v1.4+)

### Integration Points
- `onNip5dIframeCreate` signature expansion → breaking for host apps (demo + hyprgate)
- `createEnforceGate` wiring in `packages/runtime/src/runtime.ts` — needs updated `resolveIdentity` that returns class
- Demo shell-host class-assignment map + module-load assertion
- Demo main.ts test hook exposure (`window.__setNappletClass__`)

</code_context>

<specifics>
## Specific Ideas

- Sample restrictive class `'class-2'` excludes `relay:write` — this is the single sample policy shipped in v1.7 Phase 38. Future phases / milestones can expand.
- The cross-NUB invariant test for `theme-switcher` blocked under `'class-2'` exercises the `relay:write` path (theme broadcasts are relay publishes).
- `ClassCheckEvent` vs extending `AclCheckEvent` — prefer extending `AclCheckEvent` with `reason` field to avoid audit-sink proliferation. Claude to verify existing audit-event shape.
- Breaking change rollout: Phase 38 changeset is a `minor` bump for `@kehto/shell` (public hook contract change). Hyprgate coordinates in parallel per user choice.

</specifics>

<deferred>
## Deferred Ideas

- Multi-class support (more than `class-1` + `class-2`) — follow-up milestones add classes as NUB specs require
- Runtime class re-assignment — canonical NUB-CLASS is at-most-once per iframe; do NOT plan mid-session re-assignment
- Class-posture audit UI in the demo shell — optional polish; not required for Phase 38 scope

</deferred>

---

*Phase: 38-nub-class-adoption*
*Context gathered: 2026-04-24 via smart-discuss (batch accepted wholesale)*
