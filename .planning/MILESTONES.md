# Milestones: Kehto Runtime

## Completed

### v1.0: NIP-5D Migration & Gap Analysis
**Shipped:** 2026-04-07
**Phases:** 5 | **Plans:** 7 | **Requirements:** 17/17

**Key Accomplishments:**
1. Gap analysis with wire format before/after for 19 NUB message types and 6 silent failure points
2. ACL identity key schema migration design (pubkey:dTag:hash → dTag:hash) with localStorage migration utility
3. NUB domain-prefix dispatch design replacing NIP-01 verb switch, AUTH removal inventory (~24% of runtime.ts)
4. SessionEntry identity anchor: Option B (empty string + identitySource discriminant)
5. Shell migration: window.nostr injection via postMessage handshake, shell.supports() capability advertisement
6. All 6 service handler migrations from NIP-01 arrays to NappletMessage envelopes

**Deliverables:**
- `docs/GAP-ANALYSIS.md` (567 lines)
- `docs/ACL-MIGRATION.md` (346 lines)
- `docs/RUNTIME-MIGRATION.md` (897 lines)
- `docs/SHELL-MIGRATION.md` (663 lines)
- `docs/SERVICES-MIGRATION.md` (1023 lines)

**Archive:** [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) | [v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)
