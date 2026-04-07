# Roadmap: Kehto Runtime

## Milestones

- ✅ **v1.0 NIP-5D Migration & Gap Analysis** - Phases 1-5 (shipped 2026-04-07)
- 🚧 **v1.1 NIP-5D Migration Implementation** - Phases 6-9 (in progress)

## Phases

<details>
<summary>✅ v1.0 NIP-5D Migration & Gap Analysis (Phases 1-5) - SHIPPED 2026-04-07</summary>

### Phase 1: Gap Analysis
**Goal**: Document spec delta between previous protocol and NIP-5D v0.1.0, establishing boundary contracts for all packages
**Depends on**: Nothing (first phase)
**Requirements**: GAP-01, GAP-02, GAP-03, GAP-04, GAP-05
**Plans**: 2 plans

Plans:
- [x] 01-01: Wire format, AUTH/identity, NUB domain mapping (sections 1-3)
- [x] 01-02: Silent failure inventory, boundary contracts (sections 4-5)

### Phase 2: ACL Migration Doc
**Goal**: Document every breaking change in the ACL subsystem and persisted data migration
**Depends on**: Phase 1
**Requirements**: ACL-01, ACL-02, ACL-03
**Plans**: 1 plan

Plans:
- [x] 02-01: Identity schema change, capability-to-NUB mapping, persisted data migration

### Phase 3: Runtime Migration Doc
**Goal**: Document NUB dispatch design, AUTH removal scope, handler rewrites, and session identity
**Depends on**: Phase 1
**Requirements**: RT-01, RT-02, RT-03, RT-04
**Plans**: 2 plans

Plans:
- [x] 03-01: NUB dispatch design, AUTH removal scope (sections 1-2)
- [x] 03-02: Handler rewrites, SessionEntry identity anchor (sections 3-4)

### Phase 4: Shell Migration Doc
**Goal**: Document envelope guard updates, window.nostr injection, and capability advertisement
**Depends on**: Phase 1, Phase 3
**Requirements**: SH-01, SH-02, SH-03
**Plans**: 1 plan

Plans:
- [x] 04-01: Envelope guard, window.nostr injection, capability advertisement (sections 1-3)

### Phase 5: Services Migration Doc
**Goal**: Document ServiceHandler interface change and per-handler migration paths
**Depends on**: Phase 1, Phase 3
**Requirements**: SVC-01, SVC-02
**Plans**: 1 plan

Plans:
- [x] 05-01: ServiceHandler interface change, 6 handler migrations

</details>

### 🚧 v1.1 NIP-5D Migration Implementation (In Progress)

**Milestone Goal:** Implement the code changes described in the v1.0 migration documents — update all 4 kehto packages to support NIP-5D v0.1.0 envelope format. Clean break, no backward compat.

**Spec reference:** Each phase corresponds to one migration doc in `/docs/`.

- [x] **Phase 6: @kehto/acl Implementation** - Implement Identity key schema change, NUB capability resolution, and ACL state migration utility (completed 2026-04-07)
- [ ] **Phase 7: @kehto/runtime Implementation** - Replace NIP-01 verb dispatch with NUB domain-prefix dispatch, remove AUTH, rewrite handlers, anchor session identity
- [ ] **Phase 8: @kehto/shell Implementation** - Enforce envelope-only guard, inject window.nostr, advertise capabilities, trigger ACL migration
- [ ] **Phase 9: @kehto/services Implementation** - Migrate ServiceHandler interface and all service handlers to NappletMessage envelope format

## Phase Details

### Phase 6: @kehto/acl Implementation
**Goal**: @kehto/acl fully operates on NIP-5D identity keys and NUB-domain capability resolution
**Depends on**: Nothing (foundation — no inter-package deps within this phase)
**Spec**: `docs/ACL-MIGRATION.md`
**Requirements**: ACL-I01, ACL-I02, ACL-I03
**Success Criteria** (what must be TRUE):
  1. `toKey()` produces `dTag:hash` format keys — the `pubkey:` prefix is absent from all stored ACL entries
  2. `resolveCapabilitiesNub()` resolves capability grants using NUB domain strings, not legacy capability names
  3. `migrateAclState()` reads old-format `pubkey:dTag:hash` keys from storage and rewrites them as `dTag:hash` without data loss
  4. ACL tests pass with the new key format and no test references the old three-part key schema
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md — Identity key schema change (toKey dTag:hash) + migrateAclState() utility + tests
- [x] 06-02-PLAN.md — resolveCapabilitiesNub() NUB domain resolution + tests

### Phase 7: @kehto/runtime Implementation
**Goal**: @kehto/runtime dispatches exclusively via NUB domain-prefix, with no AUTH machinery and envelope-only message handling
**Depends on**: Phase 6 (imports updated Identity type from @kehto/acl)
**Spec**: `docs/RUNTIME-MIGRATION.md`
**Requirements**: RT-I01, RT-I02, RT-I03, RT-I04
**Success Criteria** (what must be TRUE):
  1. Sending a NIP-01-style array message to the runtime produces no response — only NappletMessage envelopes are dispatched
  2. All AUTH-related code paths are removed; the runtime compiles without them
  3. relay, signer, storage, and ifc handlers accept and return NappletMessage envelopes in all code paths
  4. `SessionEntry` carries an `identitySource` discriminant and an empty-string sentinel for pre-identity sessions
**Plans**: 3 plans

Plans:
- [x] 07-01-PLAN.md — Type contracts, SessionEntry identity anchor, enforce gate for NUB dispatch
- [x] 07-02-PLAN.md — handleMessage rewrite (envelope-only), AUTH removal (~269 lines)
- [ ] 07-03-PLAN.md — Relay/signer/storage/IFC handler implementations + dispatch tests

### Phase 8: @kehto/shell Implementation
**Goal**: @kehto/shell accepts only NappletMessage envelopes, injects window.nostr into sandboxed iframes, and advertises supported capabilities
**Depends on**: Phase 6 (ACL migration trigger), Phase 7 (envelope types)
**Spec**: `docs/SHELL-MIGRATION.md`
**Requirements**: SH-I01, SH-I02, SH-I03, SH-I04
**Success Criteria** (what must be TRUE):
  1. ShellBridge rejects any incoming message that is not a NappletMessage envelope — no legacy-array message reaches a handler
  2. A sandboxed iframe hosted by ShellBridge receives a functional `window.nostr` object injected via postMessage handshake
  3. Calling `shell.supports(capability)` returns a boolean reflecting the shell's declared capability set
  4. On first load with a legacy ACL store, `acl-store.ts` calls `migrateAclState()` before any capability check runs
**Plans**: TBD

### Phase 9: @kehto/services Implementation
**Goal**: All @kehto/services handlers receive and return NappletMessage envelopes, and the signer handler gates getPubkey() on identitySource
**Depends on**: Phase 7 (NappletMessage type, SessionEntry identity anchor)
**Spec**: `docs/SERVICES-MIGRATION.md`
**Requirements**: SVC-I01, SVC-I02, SVC-I03, SVC-I04, SVC-I05
**Success Criteria** (what must be TRUE):
  1. `ServiceHandler` is typed to accept `NappletMessage` — handlers referencing `unknown[]` no longer compile
  2. The signer handler processes `signer.*` NappletMessage envelopes and returns typed `.result` / `.error` responses
  3. audio and notifications handlers process IFC-envelope messages and produce valid NappletMessage responses
  4. relay-pool, cache, and coordinated-relay handlers are rewritten to envelope format and pass their handler tests
  5. `signer.getPublicKey` returns an error response when `session.identitySource` is unset; it does not silently return undefined
**Plans**: TBD

## Progress

**Execution Order:**
v1.0 phases are complete. v1.1 executes: 6 → 7 → 8 → 9 (phases 8 and 9 may proceed in parallel after phase 7 completes).

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Gap Analysis | v1.0 | 2/2 | Complete | 2026-04-07 |
| 2. ACL Migration Doc | v1.0 | 1/1 | Complete | 2026-04-07 |
| 3. Runtime Migration Doc | v1.0 | 2/2 | Complete | 2026-04-07 |
| 4. Shell Migration Doc | v1.0 | 1/1 | Complete | 2026-04-07 |
| 5. Services Migration Doc | v1.0 | 1/1 | Complete | 2026-04-07 |
| 6. @kehto/acl Implementation | v1.1 | 2/2 | Complete   | 2026-04-07 |
| 7. @kehto/runtime Implementation | v1.1 | 0/? | Not started | - |
| 8. @kehto/shell Implementation | v1.1 | 0/? | Not started | - |
| 9. @kehto/services Implementation | v1.1 | 0/? | Not started | - |
