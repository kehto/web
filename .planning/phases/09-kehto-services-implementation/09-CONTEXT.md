# Phase 9: @kehto/services Implementation - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning
**Source:** PRD Express Path (docs/SERVICES-MIGRATION.md)

<domain>
## Phase Boundary

Implement all code changes to @kehto/services described in docs/SERVICES-MIGRATION.md. Clean break — envelope-only.

</domain>

<decisions>
## Implementation Decisions

### ServiceHandler Interface (SVC-I01)
- Change from handleMessage(windowId, msg: unknown[], send) to NappletMessage envelope format
- Update service-dispatch.ts routing from topic-prefix to msg.type domain prefix

### Signer Service (SVC-I02)
- All 7 signer operations via envelope format
- Consent gating preserved
- pubkey field name, dedicated .error type suffix

### Audio + Notifications (SVC-I03)
- IFC-routed via ifc.emit with topic prefix
- Eliminate parseContent/extractTopic/createResponseEvent helpers

### Relay Services (SVC-I04)
- relay-pool, cache, coordinated-relay handlers to envelope format

### Identity Guard (SVC-I05)
- Check session.identitySource before getPubkey() calls
- Handle empty-string pubkey for source-based sessions

### Claude's Discretion
- Internal refactoring approach, test structure

</decisions>

<canonical_refs>
## Canonical References

- `docs/SERVICES-MIGRATION.md` — THE authoritative spec
- `packages/services/src/` — Current services implementation
- `packages/runtime/src/types.ts` — Updated SessionEntry, NappletMessage types
- `docs/GAP-ANALYSIS.md` section 5.4 — Services boundary contract

</canonical_refs>

<specifics>
## Specific Ideas

- Clean break: unknown[] references should fail to compile
- pubkey field name, .error type suffix
- IFC-routed services receive ifc.emit with topic prefix

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>
