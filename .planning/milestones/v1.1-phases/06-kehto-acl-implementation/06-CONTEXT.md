# Phase 6: @kehto/acl Implementation - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning
**Source:** PRD Express Path (docs/ACL-MIGRATION.md)

<domain>
## Phase Boundary

Implement all code changes to @kehto/acl described in docs/ACL-MIGRATION.md. Clean break — no backward compat.

</domain>

<decisions>
## Implementation Decisions

### Identity Key Schema (ACL-I01)
- Change Identity composite key from `pubkey:dTag:hash` to `dTag:hash`
- Update `toKey()` function to produce new format
- Single point of change in types/key generation

### Capability Resolution (ACL-I02)
- Implement `resolveCapabilitiesNub()` for NUB domain-based capability resolution
- No ACL required for read-only signer operations (getPublicKey, getRelays)
- Map all 10 CAP_* constants to NUB domains

### ACL State Migration (ACL-I03)
- Implement `migrateAclState()` utility
- Rewrites old `pubkey:dTag:hash` keys to `dTag:hash`
- Conservative merge logic (OR caps, OR blocked, MAX quota)
- Note: migration trigger lives in @kehto/shell (Phase 8), utility lives here

### Claude's Discretion
- Test structure and naming
- Internal code organization within existing files

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### ACL Package
- `docs/ACL-MIGRATION.md` — Complete migration spec (THE authoritative source)
- `packages/acl/src/` — Current ACL implementation to modify
- `docs/GAP-ANALYSIS.md` section 5.1 — Boundary contract

</canonical_refs>

<specifics>
## Specific Ideas

- Clean break: remove old key format entirely, don't keep backward compat code
- `resolveCapabilitiesNub()` should return null for getPublicKey/getRelays (no ACL gate)

</specifics>

<deferred>
## Deferred Ideas

- migrateAclState() trigger in acl-store.ts belongs to Phase 8 (shell)

</deferred>
