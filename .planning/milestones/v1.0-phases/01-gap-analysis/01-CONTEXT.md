# Phase 1: Gap Analysis - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Produce a gap analysis document that maps all specification changes between the previous napplet protocol (RUNTIME-SPEC.md, protocol v2.0.0) and NIP-5D v0.1.0. The document establishes per-package boundary contracts that downstream migration docs (Phases 2-5) reference as their source of truth.

</domain>

<decisions>
## Implementation Decisions

### Document Structure
- Single markdown file (GAP-ANALYSIS.md) with sections organized by change type
- Sections: wire format, identity model, interfaces/NUB domains, silent failures, per-package boundary contracts
- Lives in project root `/docs/` directory — visible to contributors
- Includes migration priority rankings per gap, with suggested migration order

### Depth & Granularity
- Wire format: before/after examples for every message type (relay.subscribe, signer.signEvent, storage.get, ifc.emit, etc.)
- Silent failure inventory: code-level — specific file, function, and line where each failure occurs in kehto
- NUB types kehto doesn't use yet (theme): listed but flagged as deferred/out-of-scope
- AUTH removal: enumerate every affected file and function, quantify the ~40% removal scope

### Boundary Contract Format
- Contracts presented as TypeScript interface snippets showing old vs new message types at each package boundary
- Prescriptive: contracts state what each package MUST accept/emit after migration
- Each contract includes verification criteria ("migration is correct when X")

### Claude's Discretion
- Internal document sectioning and heading hierarchy
- Level of cross-referencing between sections
- Whether to include a changelog-style summary at the top

</decisions>

<code_context>
## Existing Code Insights

### Key Source Files
- `packages/runtime/src/runtime.ts` — NIP-01 verb switch dispatch (msg[0] routing)
- `packages/runtime/src/types.ts` — Current message types (NIP-01 array format)
- `packages/shell/src/shell-bridge.ts` — Array.isArray(msg) guard
- `packages/acl/src/` — Identity type with pubkey:dTag:hash composite key
- `packages/services/src/` — ServiceHandler interface using unknown[]

### Reference Specifications
- `RUNTIME-SPEC.md` — Previous protocol spec (kehto root)
- `napplet/SPEC.md` — Current NIP-5D v0.1.0 spec
- `napplet/packages/core/src/` — Updated @napplet/core types (envelope.ts, legacy.ts, constants.ts)
- `napplet/packages/nubs/` — NUB type definitions (nub-relay, nub-signer, nub-storage, nub-ifc, nub-theme)

### Research Artifacts
- `.planning/research/STACK.md` — Wire format comparison, dependency changes
- `.planning/research/FEATURES.md` — NUB domain mapping, interface changes
- `.planning/research/ARCHITECTURE.md` — Integration flow, migration order
- `.planning/research/PITFALLS.md` — Silent failures, AUTH removal risks

</code_context>

<specifics>
## Specific Ideas

- Research identified wire format as "the entire story" — document should lead with this
- AUTH handshake removal is second-largest change (~40% of runtime code)
- The 5 NUB domains (relay, signer, storage, ifc, theme) map to existing kehto handlers except theme
- Silent message dropping is the critical risk — no errors thrown, just undefined msg[0]

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
