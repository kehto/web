# Requirements: Kehto Runtime — v1.1 NIP-5D Migration Implementation

**Defined:** 2026-04-07
**Core Value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Milestone:** v1.1 — Implement migration changes from v1.0 docs. Clean break, no backward compat.

## ACL Implementation

Spec: `docs/ACL-MIGRATION.md`

- [x] **ACL-I01**: Implement Identity key schema change (pubkey:dTag:hash → dTag:hash) in acl types and toKey()
- [x] **ACL-I02**: Update capability enforcement to use NUB domain resolution (resolveCapabilitiesNub)
- [x] **ACL-I03**: Implement migrateAclState() utility for persisted ACL data

## Runtime Implementation

Spec: `docs/RUNTIME-MIGRATION.md`

- [x] **RT-I01**: Replace NIP-01 verb switch with NUB domain-prefix dispatch (envelope-only, no dual-mode)
- [x] **RT-I02**: Remove AUTH machinery entirely (~24% of runtime.ts)
- [x] **RT-I03**: Rewrite relay/signer/storage/ifc handlers for envelope format
- [x] **RT-I04**: Implement SessionEntry identity anchor (empty string + identitySource discriminant)

## Shell Implementation

Spec: `docs/SHELL-MIGRATION.md`

- [ ] **SH-I01**: Replace Array.isArray envelope guard with envelope-only check
- [ ] **SH-I02**: Implement window.nostr injection for sandboxed iframes
- [ ] **SH-I03**: Implement shell.supports() capability advertisement
- [ ] **SH-I04**: Integrate migrateAclState() trigger in acl-store.ts

## Services Implementation

Spec: `docs/SERVICES-MIGRATION.md`

- [ ] **SVC-I01**: Update ServiceHandler interface (unknown[] → NappletMessage)
- [ ] **SVC-I02**: Migrate signer service handler to envelope format
- [ ] **SVC-I03**: Migrate audio and notifications handlers to IFC envelope format
- [ ] **SVC-I04**: Migrate relay-pool, cache, and coordinated-relay handlers
- [ ] **SVC-I05**: Add identitySource guard for getPubkey() calls

## Future Requirements

- CI/CD pipeline and npm publishing
- Theme NUB support
- IFC channel mode support
- Test suite for new envelope format

## Out of Scope

- Backward compatibility with NIP-01 array format — clean break
- Dual-mode dispatch — removed per user decision
- Theme NUB implementation — deferred
- IFC channel mode — deferred

## Traceability

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| ACL-I01 | Phase 6 | TBD | Pending |
| ACL-I02 | Phase 6 | TBD | Pending |
| ACL-I03 | Phase 6 | TBD | Pending |
| RT-I01 | Phase 7 | TBD | Pending |
| RT-I02 | Phase 7 | TBD | Pending |
| RT-I03 | Phase 7 | TBD | Pending |
| RT-I04 | Phase 7 | TBD | Pending |
| SH-I01 | Phase 8 | TBD | Pending |
| SH-I02 | Phase 8 | TBD | Pending |
| SH-I03 | Phase 8 | TBD | Pending |
| SH-I04 | Phase 8 | TBD | Pending |
| SVC-I01 | Phase 9 | TBD | Pending |
| SVC-I02 | Phase 9 | TBD | Pending |
| SVC-I03 | Phase 9 | TBD | Pending |
| SVC-I04 | Phase 9 | TBD | Pending |
| SVC-I05 | Phase 9 | TBD | Pending |

---
*Requirements defined: 2026-04-07*
