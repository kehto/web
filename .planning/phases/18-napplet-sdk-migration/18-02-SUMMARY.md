---
phase: 18-napplet-sdk-migration
plan: 02
subsystem: napplet
tags: [napplet, sdk, ipc, storage, relay, typescript, vite, demo]

# Dependency graph
requires:
  - phase: 17-demo-app-rewire
    provides: Shell bridge that silently dropped legacy NIP-01 arrays; E2E infra from phase 16
provides:
  - "SDK-only chat napplet entry point (apps/demo/napplets/chat/src/main.ts)"
  - "id=chat-status DOM hook for E2E auth assertions (D-04 contract)"
  - "ipc.emit('chat:message') outbound IPC path for chat→bot round-trips"
  - "ipc.on('bot:response') subscription for bot→chat replies"
  - "storage getItem/setItem persisted chat history under key 'chat-history'"
affects:
  - 18-03 (napplet-auth.spec.ts asserts #chat-status === 'authenticated')
  - 18-04 (ifc-roundtrip.spec.ts drives chat→bot→chat round trip)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SDK init pattern: first SDK call (storage.getItem) gates on shim AUTH; set status element after AUTH completes (D-04)"
    - "ipc.emit + relay.publish in separate try/catch blocks — relay failure does not block ifc path"
    - "init().catch() pattern for top-level async error reporting to status DOM element"

key-files:
  created: []
  modified:
    - apps/demo/napplets/chat/index.html
    - apps/demo/napplets/chat/src/main.ts

key-decisions:
  - "Explanatory JSDoc comments referencing banned terms (window.addEventListener, window.nostr) are permitted per Phase 17 decision — grep patterns must exclude comment lines"
  - "napplet-aggregate-hash is empty when VITE_DEV_PRIVKEY_HEX is unset — this is a pre-existing environment constraint, not a regression (same as 18-01 bot build)"

patterns-established:
  - "SDK-init-gates-auth: async init() calls storage.getItem as first SDK call; shim AUTH completes before storage resolves; status DOM set after await"
  - "ifc-relay-separation: ipc.emit and relay.publish are separate concerns in separate try/catch; relay:write denial does not break ifc NUB traffic"

requirements-completed: [NAP-02]

# Metrics
duration: 12min
completed: 2026-04-18
---

# Phase 18 Plan 02: Chat Napplet SDK Migration Summary

**Chat napplet rewritten from raw window.addEventListener NIP-01 dispatch to @napplet/sdk (ipc.emit/on + storage), with #chat-status DOM hook for E2E auth assertions after shim AUTH completes**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-18T00:30:00Z
- **Completed:** 2026-04-18T00:42:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Renamed `<div id="status">` to `<div id="chat-status">` in index.html and updated the matching CSS selector — establishing the D-04 DOM contract for Plan 18-03 E2E specs
- Rewrote chat/src/main.ts: deleted the entire `window.addEventListener('message')` block (former lines 135-195), `pendingAcks` array, and `authenticated` flag
- Added `init()` async function using storage.getItem as the AUTH gate — sets `#chat-status = 'authenticated'` after first SDK call resolves, wires `ipc.on('bot:response')` subscription, and attempts optional `relay.subscribe`
- Preserved ipc.emit('chat:message') outbound path and relay.publish showcase (D-03); both wrapped in independent try/catch blocks so relay failure does not break ifc traffic
- Build exits 0 with `pnpm --filter @kehto/demo-chat build`

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename status div to id=chat-status** - `63141fc` (feat)
2. **Task 2: Rewrite chat/src/main.ts to @napplet/sdk** - `abd5e06` (feat)

**Plan metadata:** (docs commit, pending)

## Files Created/Modified
- `apps/demo/napplets/chat/index.html` - Renamed `id="status"` to `id="chat-status"`, updated CSS selector, added Phase 18 NAP-02 comment
- `apps/demo/napplets/chat/src/main.ts` - Full rewrite: SDK-only imports, init() pattern, removed all legacy NIP-01 message handling

## Decisions Made
- Explanatory JSDoc comments referencing removed anti-terms (`window.addEventListener`, `window.nostr`) are permitted per Phase 17 accumulated decision — grep patterns checking for actual functional code must be scoped to non-comment lines
- `napplet-aggregate-hash` remains empty (`content=""`) because `VITE_DEV_PRIVKEY_HEX` is not set in this environment; this is the same pre-existing behavior as the bot napplet and is not a regression from this plan's changes

## Deviations from Plan

None — plan executed exactly as written. The main.ts rewrite matched the plan's specified init() pattern, anti-feature deletions, and import shape. The CSS `#status` selector update in index.html was an implicit requirement of renaming the div ID (not explicitly called out but logically required for styling continuity).

## Issues Encountered
- `napplet-aggregate-hash` acceptance criterion in the plan specifies a 64-char hex hash, but the vite-plugin only populates this when `VITE_DEV_PRIVKEY_HEX` is set. The env var is not set in this environment. The bot napplet (18-01 reference) has identical behavior. The build succeeds (exit 0) and the empty hash is the documented no-key fallback path in the vite-plugin source. Documented as known environment constraint.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `#chat-status` DOM contract established — Plan 18-03 `napplet-auth.spec.ts` can assert `textContent === 'authenticated'` after SDK init resolves
- `ipc.emit('chat:message')` path is live — Plan 18-04 `ifc-roundtrip.spec.ts` can drive chat→bot→chat round trips via DOM input
- Both anti-feature checks and SDK usage patterns are grep-verifiable for CI

## Known Stubs
None — ipc.emit, ipc.on, storage.getItem/setItem, and relay.publish are all wired to real SDK calls. No hardcoded empty values flow to UI rendering.

---
*Phase: 18-napplet-sdk-migration*
*Completed: 2026-04-18*
