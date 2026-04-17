# Phase 7: @kehto/runtime Implementation - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning
**Source:** PRD Express Path (docs/RUNTIME-MIGRATION.md)

<domain>
## Phase Boundary

Implement all code changes to @kehto/runtime described in docs/RUNTIME-MIGRATION.md. Clean break — no backward compat, no dual-mode dispatch. Envelope-only.

</domain>

<decisions>
## Implementation Decisions

### NUB Dispatch (RT-I01)
- Replace NIP-01 verb switch with NUB domain-prefix dispatch
- Envelope-only — no Array.isArray fallback, no dual-mode
- Clean break: array messages are silently dropped or rejected

### AUTH Removal (RT-I02)
- Remove ALL AUTH machinery: pendingChallenges, authInFlight, pendingAuthQueue, pendingRegistrations, key-derivation, REGISTER/IDENTITY/AUTH handlers
- No deprecation period — full removal
- Identity via source-based assignment at iframe creation (MessageEvent.source)

### Handler Rewrites (RT-I03)
- Rewrite relay, signer, storage, ifc handlers for NappletMessage envelope format
- Import resolveCapabilitiesNub() from @kehto/acl for capability checks
- Dedicated .error type suffix for error responses

### Session Identity (RT-I04)
- SessionEntry gets identitySource: 'auth' | 'source' discriminant
- Empty string pubkey for source-based sessions
- Synchronous originRegistry.register() at iframe creation

### Claude's Discretion
- Internal refactoring approach (incremental vs big-bang within each file)
- Test organization

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `docs/RUNTIME-MIGRATION.md` — THE authoritative spec for all runtime changes
- `docs/GAP-ANALYSIS.md` section 5.2 — Runtime boundary contract
- `packages/runtime/src/` — Current runtime implementation
- `packages/acl/src/resolve.ts` — resolveCapabilitiesNub() (Phase 6 output, import this)

</canonical_refs>

<specifics>
## Specific Ideas

- No ACL for getPublicKey/getRelays (already implemented in Phase 6 resolveCapabilitiesNub)
- pubkey field name for signer responses (not publicKey)
- ~24% of runtime.ts is AUTH machinery to remove

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>
