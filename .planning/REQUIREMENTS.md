# Requirements: Kehto Runtime — v1.0 NIP-5D Migration & Gap Analysis

**Defined:** 2026-04-07
**Core Value:** Modular, framework-agnostic runtime for hosting napplet applications.
**Milestone:** v1.0 — Produce migration documents for each kehto package and a gap analysis between previous and current NIP-5D specification.

## Gap Analysis

- [ ] **GAP-01**: Document wire format change (NIP-01 arrays → JSON envelopes) with before/after examples
- [ ] **GAP-02**: Document AUTH handshake elimination and identity model change
- [ ] **GAP-03**: Map each window.napplet interface to its NUB domain with optionality status
- [ ] **GAP-04**: Inventory silent failure points where old runtime drops new-format messages
- [ ] **GAP-05**: Document per-package boundary contracts (what each package sends/receives)

## ACL Migration

- [ ] **ACL-01**: Document Identity key schema change (pubkey:dTag:hash → dTag:hash)
- [ ] **ACL-02**: Map capability constants to NUB domains (CAP_RELAY_READ → relay, etc.)
- [ ] **ACL-03**: Document persisted ACL data migration strategy

## Runtime Migration

- [ ] **RT-01**: Document NUB dispatch design replacing NIP-01 verb switch
- [ ] **RT-02**: Document AUTH machinery removal scope (~40% of current code)
- [ ] **RT-03**: Document relay/signer/storage/ifc handler rewrites for envelope format
- [ ] **RT-04**: Document SessionEntry identity anchor decision (post-AUTH)

## Shell Migration

- [ ] **SH-01**: Document envelope guard update in shell-bridge.ts
- [ ] **SH-02**: Document window.nostr injection mechanism for sandboxed iframes
- [ ] **SH-03**: Document shell.supports() capability advertisement design

## Services Migration

- [ ] **SVC-01**: Document ServiceHandler interface change (unknown[] → NappletMessage)
- [ ] **SVC-02**: Document per-handler migration (signer, audio, notifications)

## Future Requirements

- Code implementation of migration changes (separate milestone)
- CI/CD pipeline and npm publishing
- Theme NUB support (@kehto/services or new package)
- IFC channel mode support (point-to-point messaging)

## Out of Scope

- Theme NUB implementation — net-new, no existing kehto infrastructure, deferred
- IFC channel mode — no existing napplets use it, deferred
- Dual-mode dispatch implementation — migration docs will recommend it, code is next milestone

## Traceability

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| (filled by roadmapper) | | | |

---
*Requirements defined: 2026-04-07*
