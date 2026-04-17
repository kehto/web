---
phase: 08-kehto-shell-implementation
plan: "02"
subsystem: shell
tags: [typescript, nip-5d, shell-bridge, nostr-injection, capability-advertisement, envelope-guard]

requires:
  - phase: 08-kehto-shell-implementation
    plan: "01"
    provides: ShellCapabilities interface, NappletMessage re-export, ShellAdapter.services, originRegistry.getIframeWindow

provides:
  - ShellBridge envelope-only guard (NIP-5D clean break — no Array.isArray fallback)
  - sendChallenge fully removed from ShellBridge interface and createShellBridge return
  - shell.ready/shell.init handshake handler routing capability set and service list
  - shell-init.ts module with buildShellCapabilities() and generateNostrBootstrap()
  - generateNostrBootstrap() srcdoc fallback: all 7 NIP-07 method groups covered
  - buildShellCapabilities() derives NUB list from hooks.relayPool presence
  - ShellCapabilities, NappletMessage, generateNostrBootstrap, buildShellCapabilities exported from barrel

affects:
  - Host apps using bridge.sendChallenge() must migrate to NIP-5D session flow
  - Napplets using @napplet/shim can now complete shell.ready/shell.init handshake
  - Shim-less napplets can use generateNostrBootstrap() srcdoc injection

tech-stack:
  added: []
  patterns:
    - "Envelope-only guard: typeof msg === 'object' && msg !== null && typeof msg.type === 'string'"
    - "shell.ready handled locally in handleMessage, never forwarded to runtime"
    - "shell.init response shape: { type: 'shell.init', capabilities: ShellCapabilities, services: string[] }"
    - "generateNostrBootstrap uses ES5 var/function syntax for iframe compat + crypto.randomUUID() for request IDs"
    - "buildShellCapabilities: relay NUB conditional on hooks.relayPool presence; signer/storage/ifc always present"

key-files:
  created:
    - packages/shell/src/shell-init.ts
  modified:
    - packages/shell/src/shell-bridge.ts
    - packages/shell/src/index.ts

key-decisions:
  - "Clean break — no Array.isArray fallback in handleMessage per user decision in CONTEXT.md"
  - "sendChallenge removed from interface entirely (not deprecated) — NIP-5D has no AUTH challenge"
  - "shell.ready handled locally in the bridge, not forwarded to runtime — runtime has no concept of shell handshake"
  - "generateNostrBootstrap uses pending map (not per-call listeners) for cleaner response routing"
  - "buildShellCapabilities does not derive sandbox from iframe attribute — shell does not control iframe creation; left empty for host apps to extend"

metrics:
  duration: "~2 min"
  tasks: 3
  files_created: 1
  files_modified: 2
  completed: 2026-04-07
---

# Phase 08 Plan 02: Shell Bridge Envelope Guard + Nostr Injection Summary

**ShellBridge rewritten for NIP-5D envelope-only dispatch with shell.ready/shell.init handshake; shell-init.ts created with generateNostrBootstrap() srcdoc fallback and buildShellCapabilities() NUB capability set**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-07T22:42:55Z
- **Completed:** 2026-04-07T22:45:47Z
- **Tasks:** 3 (all auto)
- **Files created:** 1
- **Files modified:** 2

## Accomplishments

- shell-bridge.ts rewritten with envelope-only guard: `typeof msg === 'object' && msg !== null && typeof msg.type === 'string'`. The old `Array.isArray` guard (GAP-ANALYSIS.md Failure Point 1) that silently dropped 100% of NIP-5D envelope traffic is eliminated.
- `sendChallenge` fully removed from `ShellBridge` interface and `createShellBridge` return object. NIP-5D has no AUTH challenge handshake.
- `shell.ready` messages handled locally in `handleMessage` — bridge responds with `shell.init` containing `ShellCapabilities` and service list. Not forwarded to runtime.
- `shell-init.ts` created with `buildShellCapabilities()` (derives NUB list from hooks configuration) and `generateNostrBootstrap()` (ES5-compatible window.nostr proxy covering all 7 NIP-07 method groups).
- `index.ts` updated to export `ShellCapabilities`, `NappletMessage`, `generateNostrBootstrap`, and `buildShellCapabilities` from the `@kehto/shell` barrel.
- Full monorepo build passes: 11/11 tasks, zero TypeScript errors.

## Task Commits

Each task was committed atomically:

1. **Tasks 1+2: shell-bridge rewrite + shell-init.ts creation** - `c6387f3` (feat)
2. **Task 3: index.ts export updates** - `fb3015c` (feat)

## Files Created/Modified

- `packages/shell/src/shell-bridge.ts` — envelope-only guard, sendChallenge removed, shell.ready/shell.init handler, buildShellCapabilities import
- `packages/shell/src/shell-init.ts` — new module: buildShellCapabilities(), generateNostrBootstrap()
- `packages/shell/src/index.ts` — added ShellCapabilities, NappletMessage, generateNostrBootstrap, buildShellCapabilities to public exports

## Decisions Made

- Clean break: no Array.isArray fallback in handleMessage — per user decision in CONTEXT.md
- sendChallenge removed from interface entirely (not deprecated) — no AUTH challenge in NIP-5D
- shell.ready handled locally in bridge, not forwarded to runtime
- generateNostrBootstrap uses a pending map keyed by request UUID instead of per-call listeners — cleaner and avoids listener leaks on error paths
- buildShellCapabilities leaves sandbox=[] — shell does not control iframe creation; host apps extend if needed

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — both functions are fully implemented. buildShellCapabilities derives real NUB list from hooks configuration. generateNostrBootstrap produces a working proxy script.

---

## Self-Check

### Files verified to exist:
- `packages/shell/src/shell-bridge.ts` ✓
- `packages/shell/src/shell-init.ts` ✓
- `packages/shell/src/index.ts` ✓

### Commits verified to exist:
- `c6387f3` ✓
- `fb3015c` ✓

### Verification checks passed:
- Array.isArray count in shell-bridge.ts: 0 ✓
- sendChallenge count in shell-bridge.ts: 0 ✓
- shell.ready count in shell-bridge.ts: ≥1 (5) ✓
- window.nostr count in shell-init.ts: ≥1 (6) ✓
- buildShellCapabilities count in shell-init.ts: ≥1 (3) ✓
- shell-init reference count in index.ts: ≥1 (1) ✓

## Self-Check: PASSED

*Phase: 08-kehto-shell-implementation*
*Completed: 2026-04-07*
