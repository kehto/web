---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: NIP-5D Conformance & Full NUB Coverage
status: defining_requirements
stopped_at: Milestone started — gathering requirements
last_updated: "2026-04-17T00:00:00.000Z"
last_activity: 2026-04-17
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-17)

**Core value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Current focus:** Milestone v1.2 — NIP-5D Conformance & Full NUB Coverage

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-17 — Milestone v1.2 started

Progress: [----------] 0% (v1.2)

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (v1.2)
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*

## Accumulated Context

### Decisions

- Clean break — no dual-mode dispatch, no backward compatibility with NIP-01 arrays
- Migration order: acl → runtime → (shell ‖ services) — shell and services can parallelize after runtime
- `pubkey` field name for signer.getPublicKey.result (nostr convention)
- No ACL required for read-only signer operations (getPublicKey, getRelays)
- Dedicated `.error` type suffix for error responses
- [Phase 06-kehto-acl-implementation]: resolveCapabilitiesNub placed in @kehto/acl alongside CAP_* constants — canonical capability mapping
- [Phase 06-kehto-acl-implementation]: NubMessage defined locally in resolve.ts to preserve zero-dep constraint of @kehto/acl
- [Phase 06-kehto-acl-implementation]: toKey() is the single point of change for ACL key schema — all mutations delegate to it, updating it propagates NIP-5D 2-segment format everywhere
- [Phase 06-kehto-acl-implementation]: migrateAclState() uses conservative merge semantics: OR caps, OR blocked, MAX quota — never silently removes permissions
- [Phase 07-kehto-runtime-implementation]: identitySource discriminant 'auth'|'source' on SessionEntry — explicit field preferred over optional pubkey presence check
- [Phase 07-kehto-runtime-implementation]: createNubEnforceGate resolves identity by windowId — necessary for NIP-5D sessions where pubkey is empty string
- [Phase 07-kehto-runtime-implementation]: resolveCapabilitiesNub re-exported from enforce.ts (not re-implemented) — single canonical source in @kehto/acl
- [Phase 07-kehto-runtime-implementation]: NUB handler stubs respond with .error type suffix — Plan 03 will fill in full implementations
- [Phase 07-kehto-runtime-implementation]: handleShellCommand and handleHotkeyForward kept in runtime.ts — will be migrated in Phase 8 (shell)
- [Phase 07-kehto-runtime-implementation]: discoverySubscriptions removed — dead code after handleReq deletion (only consumer)
- [Phase 07-kehto-runtime-implementation]: isBusKind check uses filters.length > 0 guard to avoid vacuous true on empty filter arrays
- [Phase 07-kehto-runtime-implementation]: handleStorageNub placed in state-handler.ts alongside legacy handleStateRequest — both exported
- [Phase 08-kehto-shell-implementation]: Shell SessionEntry identitySource mirrors runtime's version exactly — same field, same values, keeps types in sync
- [Phase 08-kehto-shell-implementation]: OriginEntry stores optional dTag/aggregateHash for NIP-5D iframes; nullable for legacy non-NIP-5D iframes
- [Phase 08-kehto-shell-implementation]: ACL migration at deserialization boundary: detect 3-segment keys, migrate via migrateAclState, re-persist immediately — no dual-mode
- [Phase 08-kehto-shell-implementation]: sendToNapplet parameter types inferred from SendToNapplet type (remove explicit msg: unknown[]) — accepts NappletMessage | unknown[]
- [Phase 08-kehto-shell-implementation]: Clean break: no Array.isArray fallback in handleMessage — NIP-5D envelope-only per CONTEXT.md decision
- [Phase 08-kehto-shell-implementation]: sendChallenge removed from ShellBridge interface entirely — NIP-5D has no AUTH challenge handshake
- [Phase 08-kehto-shell-implementation]: shell.ready handled locally in bridge, not forwarded to runtime — shell handshake is adapter concern only
- [Phase 09-kehto-services-implementation]: ServiceHandler.handleMessage is NappletMessage-only — unknown[] removed, compile errors catch all missed migrations
- [Phase 09-kehto-services-implementation]: routeServiceMessage routes NUB-domain by message.type prefix; IFC services by message.topic prefix on ifc.emit
- [Phase 09-kehto-services-implementation]: signer-service.ts switches on message.type for 7 operations, responds with typed .result/.error envelopes; other service handlers deferred to Plan 09-02
- [Phase 09-kehto-services-implementation]: IFC-routed services (audio, notifications) read action from topic.slice(prefix.length) on ifc.emit messages
- [Phase 09-kehto-services-implementation]: Legacy helpers parseContent/extractTopic/createResponseEvent deleted — payload is already parsed in envelope format

### Blockers/Concerns

- @napplet/core not yet published to npm — uses workspace override
- No CI/CD yet

## Session Continuity

Last session: 2026-04-17T00:00:00.000Z
Stopped at: Milestone v1.2 started
Resume: Run `/gsd:plan-phase 10` after roadmap is approved
