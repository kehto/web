# Roadmap: Kehto Runtime

## Overview

This milestone produces five migration/analysis documents — one gap analysis that establishes shared boundary contracts, followed by per-package migration documents for acl, runtime, shell, and services. The gap analysis comes first because its boundary contracts inform every package-level document that follows. Runtime migration precedes shell and services because those packages depend on runtime interfaces.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Gap Analysis** - Document spec delta between previous and NIP-5D v0.1.0, establishing boundary contracts for all packages (completed 2026-04-07)
- [x] **Phase 2: ACL Migration Doc** - Document identity schema changes, capability constant remapping, and persisted data migration for @kehto/acl (completed 2026-04-07)
- [ ] **Phase 3: Runtime Migration Doc** - Document NUB dispatch design, AUTH removal scope, handler rewrites, and session identity changes for @kehto/runtime
- [ ] **Phase 4: Shell Migration Doc** - Document envelope guard update, window.nostr injection, and capability advertisement design for @kehto/shell
- [ ] **Phase 5: Services Migration Doc** - Document ServiceHandler interface change and per-handler migration for @kehto/services

## Phase Details

### Phase 1: Gap Analysis
**Goal**: A gap analysis document exists that maps all specification changes between the previous napplet protocol and NIP-5D v0.1.0, with boundary contracts per package that downstream migration docs can reference
**Depends on**: Nothing (first phase)
**Requirements**: GAP-01, GAP-02, GAP-03, GAP-04, GAP-05
**Success Criteria** (what must be TRUE):
  1. The document shows before/after wire format examples (NIP-01 arrays vs JSON envelopes) for each message type
  2. The AUTH handshake elimination and resulting identity model change are fully described with impact assessment
  3. Every window.napplet interface is listed with its NUB domain assignment and optionality status
  4. All silent failure points where old runtime drops new-format messages are inventoried with reproduction steps
  5. Per-package boundary contracts (send/receive surface) are documented and can be referenced by Phases 2-5
**Plans:** 2/2 plans complete
Plans:
- [x] 01-01-PLAN.md -- Wire format, AUTH/identity, NUB domain mapping (sections 1-3)
- [x] 01-02-PLAN.md -- Silent failure inventory, boundary contracts (sections 4-5)

### Phase 2: ACL Migration Doc
**Goal**: A migration document for @kehto/acl exists that describes every breaking change in the ACL subsystem and how to migrate persisted ACL data to the new format
**Depends on**: Phase 1
**Requirements**: ACL-01, ACL-02, ACL-03
**Success Criteria** (what must be TRUE):
  1. The document shows the old and new identity key schemas side-by-side (pubkey:dTag:hash vs dTag:hash) with migration logic
  2. Every capability constant is mapped to its NUB domain (e.g., CAP_RELAY_READ → relay)
  3. A concrete persisted ACL data migration strategy is documented with steps and rollback considerations
**Plans:** 1/1 plans complete
Plans:
- [x] 02-01-PLAN.md -- Identity schema change, capability-to-NUB mapping, persisted data migration strategy

### Phase 3: Runtime Migration Doc
**Goal**: A migration document for @kehto/runtime exists that describes the NUB dispatch design, AUTH removal scope, handler rewrites, and session identity anchor decision
**Depends on**: Phase 1
**Requirements**: RT-01, RT-02, RT-03, RT-04
**Success Criteria** (what must be TRUE):
  1. The NUB dispatch design is documented with a before/after comparison against the NIP-01 verb switch it replaces
  2. The AUTH machinery removal scope is quantified (~40% of current code) with a list of affected files and functions
  3. The relay, signer, storage, and ifc handler rewrites required by envelope format are documented
  4. The SessionEntry identity anchor decision (post-AUTH) is documented with the chosen design and rationale
**Plans**: TBD

### Phase 4: Shell Migration Doc
**Goal**: A migration document for @kehto/shell exists that describes envelope guard updates, window.nostr injection, and capability advertisement design
**Depends on**: Phase 1, Phase 3
**Requirements**: SH-01, SH-02, SH-03
**Success Criteria** (what must be TRUE):
  1. The envelope guard update required in shell-bridge.ts is documented with the old check, new check, and migration steps
  2. The window.nostr injection mechanism for sandboxed iframes is fully described including security boundaries
  3. The shell.supports() capability advertisement design is documented with the API shape and behavior
**Plans**: TBD

### Phase 5: Services Migration Doc
**Goal**: A migration document for @kehto/services exists that describes the ServiceHandler interface change and all per-handler migration paths
**Depends on**: Phase 1, Phase 3
**Requirements**: SVC-01, SVC-02
**Success Criteria** (what must be TRUE):
  1. The ServiceHandler interface change (unknown[] → NappletMessage) is documented with the old and new signatures and migration impact
  2. The migration path for each built-in handler (signer, audio, notifications) is individually documented
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Gap Analysis | 2/2 | Complete   | 2026-04-07 |
| 2. ACL Migration Doc | 1/1 | Complete   | 2026-04-07 |
| 3. Runtime Migration Doc | 0/? | Not started | - |
| 4. Shell Migration Doc | 0/? | Not started | - |
| 5. Services Migration Doc | 0/? | Not started | - |
