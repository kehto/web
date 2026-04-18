---
phase: 17-demo-app-rewire
plan: 04
subsystem: ui
tags: [typescript, envelope, nip-5d, debugger, flow-animator, sequence-diagram, message-tap]

# Dependency graph
requires:
  - phase: 17-demo-app-rewire-01
    provides: anti-term clearance — BusKind/AUTH_KIND/window.nostr purged from apps/demo/src
  - phase: 17-demo-app-rewire-02
    provides: topology 8-node render + service toggle wiring
provides:
  - MessageTap captures NIP-5D envelope-shape messages (plain objects with .type string) in both directions
  - TappedMessage.envelope, TappedMessage.envelopeType, TappedMessage.parsed.domain fields
  - recordOutboundEnvelope/recordInboundEnvelope on MessageTap
  - Debugger classifyTappedMessagePath dispatches on envelope domain prefix first
  - Debugger row label shows literal envelope type strings (e.g. "relay.publish")
  - flow-animator detectServiceTarget routes by envelope domain prefix
  - sequence-diagram getLanePct has envelope branch; formatLabel returns envelopeType directly
  - All 5 color modes still function (flash/rolling/decay/last-message/trace)
affects:
  - 17-05-debugger-sequence-diagram
  - 17-07-e2e-specs

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TappedMessage.verb === 'ENVELOPE' for plain-object envelope-shape messages"
    - "msg.envelopeType first-check pattern in all downstream consumers"
    - "Array.isArray(msg.raw) guard before numeric raw indexing"

key-files:
  created: []
  modified:
    - apps/demo/src/shell-host.ts
    - apps/demo/src/debugger.ts
    - apps/demo/src/flow-animator.ts
    - apps/demo/src/sequence-diagram.ts

key-decisions:
  - "TappedMessage.raw widened to unknown[] | NappletMessage — downstream code must use Array.isArray() guard before numeric indexing"
  - "verb='ENVELOPE' used for plain-object messages so existing verb-based filters remain compatible"
  - "Debugger row header shows msg.envelopeType when present, msg.verb for legacy NIP-01 arrays"
  - "flow-animator counters group by envelopeType ?? verb for meaningful per-type counts"

patterns-established:
  - "Envelope-shape check: !Array.isArray(raw) && typeof raw.type === 'string'"
  - "Domain extraction: envelope.type.includes('.') ? envelope.type.split('.')[0] : envelope.type"
  - "All downstream consumers check msg.envelopeType first before legacy NIP-01 verb branches"

requirements-completed:
  - DEMO-04
  - DEMO-08

# Metrics
duration: 25min
completed: 2026-04-17
---

# Phase 17 Plan 04: Envelope Visibility Rewire Summary

**MessageTap extended with NIP-5D envelope capture; debugger/flow-animator/sequence-diagram rewired to display and route on literal envelope `type` strings instead of NIP-01 verb+BusKind lookups**

## Performance

- **Duration:** 25 min
- **Started:** 2026-04-17T00:00:00Z
- **Completed:** 2026-04-17T00:25:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Extended `TappedMessage` with `envelope`, `envelopeType`, and `parsed.domain` fields; added `recordOutboundEnvelope`/`recordInboundEnvelope` to `MessageTap`; implemented `parseEnvelope()` that extracts domain from `envelope.type.split('.')` 
- Rewired `createMessageTap.record()` to branch on plain-object envelope shape (verb=`ENVELOPE`) vs NIP-01 array, capturing both in both directions
- Updated `createPostMessageProxy` to intercept envelope-shape outbound `postMessage` calls; updated `install()` to capture envelope-shape inbound messages
- Rewrote `classifyTappedMessagePath` in `debugger.ts` to dispatch on `msg.envelopeType` domain prefix first, with full legacy NIP-01 array fallback retained
- Added `getRowLabel()` to `NappletDebugger` that returns `msg.envelopeType` as the row header string for envelope messages
- Rewrote `detectServiceTarget` in `flow-animator.ts` to route by envelope domain prefix (identity/notify/keys/media/theme/storage/relay); added envelope branch to `isNotificationTopic`
- Updated `getLanePct` in `sequence-diagram.ts` with envelope branch; updated `formatLabel` to return `msg.envelopeType` directly when present

## Task Commits

1. **Task 1: Extend MessageTap to capture envelope-shape messages in both directions** - `23081c8` (feat)
2. **Task 2: Rewire debugger/flow-animator/sequence-diagram to use envelope type strings** - `981fc42` (feat)

## Files Created/Modified

- `apps/demo/src/shell-host.ts` — NappletMessage import; TappedMessage/MessageTap interfaces extended; parseEnvelope() + createMessageTap() rewritten; createPostMessageProxy + install() + bootShell handleMessage wrap updated; rawArr guards added in downstream callers
- `apps/demo/src/debugger.ts` — ENVELOPE in VERB_COLORS; classifyTappedMessagePath envelope dispatch; getRowLabel(); formatDetail envelope branch; Array.isArray guard on extractEvent + formatDetail
- `apps/demo/src/flow-animator.ts` — detectServiceTarget envelope domain routing; isNotificationTopic envelope branch; counters keyed by envelopeType; rawArr guards
- `apps/demo/src/sequence-diagram.ts` — ENVELOPE in VERB_COLORS; getLanePct envelope branch; formatLabel returns envelopeType; rawArr guards

## Decisions Made

- Widened `TappedMessage.raw` to `unknown[] | NappletMessage` rather than keeping two separate fields — single `raw` field with type union forces all downstream code to handle both shapes explicitly via `Array.isArray()` guards, making it impossible to accidentally index into an envelope object.
- Used `verb = 'ENVELOPE'` for all plain-object messages so existing `verb`-based filter dropdowns in the debugger UI continue to work without UI changes — users can still filter by `ENVELOPE` to see all envelope traffic.
- Counter grouping in flow-animator uses `msg.envelopeType ?? msg.verb` as key so each distinct envelope type (e.g. `relay.publish`, `storage.getItem`) gets its own counter row.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed all downstream raw-array indexing to use Array.isArray() guard**
- **Found during:** Task 1 (TappedMessage.raw type widening)
- **Issue:** Widening `TappedMessage.raw` from `unknown[]` to `unknown[] | NappletMessage` caused TypeScript errors in `debugger.ts`, `flow-animator.ts`, `node-details.ts`, `sequence-diagram.ts`, and `main.ts` wherever code used `msg.raw[n]` numeric indexing
- **Fix:** Added `const rawArr = Array.isArray(msg.raw) ? msg.raw : null` pattern at each call site; used `rawArr?.[n]` instead of `msg.raw[n]`
- **Files modified:** apps/demo/src/debugger.ts, apps/demo/src/flow-animator.ts, apps/demo/src/node-details.ts, apps/demo/src/sequence-diagram.ts, apps/demo/src/main.ts
- **Verification:** `tsc --noEmit` zero errors in modified files; build passes
- **Committed in:** `23081c8` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — type errors caused by planned interface widening)
**Impact on plan:** Required fix for correctness. No scope creep — all changes directly caused by the planned type widening.

## Issues Encountered

Pre-existing type errors in out-of-scope files (`acl-modal.ts`, `acl-panel.ts`, `node-details.ts` sign:event capabilities; `shell-host.ts` randomBytes/sendChallenge; `main.ts` @napplet/services) were logged to `deferred-items.md` and left untouched per scope boundary rules.

## Domain → DemoProtocolPath Mapping (classifier table)

| Domain prefix | Action | DemoProtocolPath |
|---|---|---|
| `identity` | any | `identity-request` |
| `relay` | `publish`/`publishEncrypted` | `relay-publish` |
| `relay` | `subscribe`/`event`/`eose` | `relay-subscribe` |
| `relay` | other | direction-based |
| `storage` | `getItem`/`keys`/`*.result` | `state-read` |
| `storage` | `setItem`/`removeItem`/`clear` | `state-write` |
| `ifc` | any | `ipc-send` (out) / `ipc-receive` (in) |
| `notify` | any | `ipc-receive` |
| `theme`/`keys`/`media` | any | `ipc-send` (out) / `ipc-receive` (in) |
| `shell` | any | `auth` |

## Flow-Animator Domain → Service Node Routing Table

| Envelope domain | Service node |
|---|---|
| `identity` | `identity` |
| `notify` | `notifications` |
| `keys` | `keys` |
| `media` | `media` |
| `theme` | `theme` |
| `storage` | `storage` |
| `relay` | `relay` |

## Anti-term Grep Confirmation

`grep -rnE "BusKind|AUTH_KIND|kind === 2900[12]|window\.nostr" apps/demo/src/` — **zero code references**; only explanatory comments in `demo-config.ts`, `signer-demo.ts`, `signer-modal.ts`, `signer-connection.ts`, `notification-demo.ts`. All permitted per DEMO-01 spec.

## Known Stubs

None — this plan wires live envelope routing from the tap; no data rendered from stubs.

## Next Phase Readiness

- Debugger and flow-animator are now envelope-aware; ready for Plan 05 (sequence diagram full implementation)
- `TappedMessage.envelopeType` field is the canonical signal for all downstream consumers
- Pre-existing type errors in ACL panels and node-details should be resolved in Plan 05/06

---
*Phase: 17-demo-app-rewire*
*Completed: 2026-04-17*
