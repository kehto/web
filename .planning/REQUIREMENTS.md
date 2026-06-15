# Requirements: Kehto Runtime — v1.19 NAP Ontology Alignment

**Defined:** 2026-06-15
**Core Value:** Modular, framework-agnostic runtime for hosting napplet applications — any Nostr client can embed sandboxed mini-apps by integrating @kehto/shell.
**Resolves:** kehto/web#24

## v1 Requirements

Requirements for this milestone. Each maps to a roadmap phase.

### Capability Handshake

- [ ] **ALIGN-01**: A napplet built against `@napplet/* >=0.9.0` gets `true` from `window.napplet.shell.supports('inc')` (bare-domain query) when hosted in a kehto shell.
- [ ] **ALIGN-02**: That napplet gets `true` from `supports('inc', 'NAP-01')` (protocol query) and from the other advertised `inc:NAP-0N` protocol queries.
- [ ] **ALIGN-03**: The `shell.init` handshake emits the renamed `naps` capability array (consumed by the 0.9.0 shim's `createShellSupports`), and dual-emits the legacy `nubs` array for one back-compat release so napplets on either side of the rename keep negotiating.
- [ ] **ALIGN-04**: The emitted handshake advertises domain `inc` (not `ifc`) and protocol IDs in `inc:NAP-0N` form (legacy `ifc:NUB-0N` aliased to `inc:NAP-0N`); the emitted `naps` set contains no unaliased `ifc`/`NUB-NN` identifiers except the deliberate `nubs` dual-emit.

### INC Dispatch Rail

- [x] **ALIGN-05**: The runtime routes `inc.emit` / `inc.subscribe` / `inc.unsubscribe` wire messages (sent by `>=0.9.0` napplets) through the existing IFC handler so the INC peer-bus rail functions, while legacy `ifc.*` messages continue to be handled during the transition window.
- [x] **ALIGN-06**: The ACL resolver authorizes `inc.*` actions identically to the corresponding `ifc.*` actions (same capability mapping), so the new dispatch key passes the same ACL gate.

### Verification & Release

- [ ] **ALIGN-07**: An automated conformance test feeds kehto-emitted `shell.init` capabilities into the real `@napplet/shim@0.9.0` `createShellSupports` (dev-only dependency) and asserts the resulting `supports(...)` outcomes — not just string-level assertions.
- [ ] **ALIGN-08**: A changeset records the public `@kehto/shell` `ShellCapabilities` change (plus `@kehto/acl` / `@kehto/runtime` where mirrored) and notes downstream consumer impact (hyprgate).

## v2 Requirements

Deferred to a future milestone.

### Compatibility Window Cleanup

- **CLEANUP-01**: Drop the legacy `nubs` dual-emit and the `ifc`/`NUB-0N` aliases once all downstream consumers are on `>=0.9.0` (one release after this milestone).
- **CLEANUP-02**: Retire the internal `ifc.*` dispatch key and rename internal `ifc` handlers / `nub-*` test fixtures to the NAP vocabulary.

## Out of Scope

Explicitly excluded to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Upgrading `@napplet/core` / `@napplet/nub` from 0.5.0 | Not required — core 0.5.0 `createDispatch` routes any string domain key and the handshake is string-level; upgrading would force a wide, unrelated type migration. |
| Mass-renaming internal `ifc.*` message handlers, `nub-*` E2E fixtures, and docs | Out of scope for the handshake fix; would churn 840 unit + 86 E2E tests for no DONE-WHEN benefit. Deferred to CLEANUP-02. |
| Removing the legacy `nubs` dual-emit this milestone | Back-compat window is intentional (issue #24). Deferred to CLEANUP-01. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ALIGN-01 | Phase 83 | Pending |
| ALIGN-02 | Phase 83 | Pending |
| ALIGN-03 | Phase 83 | Pending |
| ALIGN-04 | Phase 83 | Pending |
| ALIGN-05 | Phase 83 | Complete |
| ALIGN-06 | Phase 83 | Complete |
| ALIGN-07 | Phase 83 | Pending |
| ALIGN-08 | Phase 83 | Pending |

**Coverage:**
- v1 requirements: 8 total
- Mapped to phases: 8
- Unmapped: 0

---
*Requirements defined: 2026-06-15*
*Last updated: 2026-06-15 — v1.19 milestone roadmap created; all 8 requirements mapped to Phase 83*
