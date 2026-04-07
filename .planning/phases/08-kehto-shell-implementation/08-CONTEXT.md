# Phase 8: @kehto/shell Implementation - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning
**Source:** PRD Express Path (docs/SHELL-MIGRATION.md)

<domain>
## Phase Boundary

Implement all code changes to @kehto/shell described in docs/SHELL-MIGRATION.md. Clean break — envelope-only.

</domain>

<decisions>
## Implementation Decisions

### Envelope Guard (SH-I01)
- Replace Array.isArray guard with envelope-only check
- Reject non-NappletMessage messages silently

### window.nostr Injection (SH-I02)
- PostMessage handshake approach (Option B from spec) with srcdoc fallback (Option A)
- NIP-07 methods map to signer.* NUB types
- ACL enforcement, consent gating preserved

### Capability Advertisement (SH-I03)
- shell.supports() returns boolean for declared capabilities
- ShellCapabilities data shape: { nubs: string[], sandbox: string[] }

### ACL Migration Trigger (SH-I04)
- Call migrateAclState() from @kehto/acl in acl-store.ts on first load
- Import from @kehto/acl (Phase 6 output)

### Claude's Discretion
- Internal refactoring, test structure

</decisions>

<canonical_refs>
## Canonical References

- `docs/SHELL-MIGRATION.md` — THE authoritative spec
- `packages/shell/src/` — Current shell implementation
- `packages/acl/src/migrate.ts` — migrateAclState() to import
- `docs/GAP-ANALYSIS.md` section 5.3 — Shell boundary contract

</canonical_refs>

<specifics>
## Specific Ideas

- Clean break: no Array.isArray fallback
- pubkey field name for signer responses
- Dedicated .error type suffix

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>
