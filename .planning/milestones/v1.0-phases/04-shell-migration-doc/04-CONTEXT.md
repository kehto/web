# Phase 4: Shell Migration Doc - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

A migration document for @kehto/shell exists that describes envelope guard updates, window.nostr injection, and capability advertisement design.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure/migration documentation phase. Use ROADMAP phase goal, success criteria, gap analysis boundary contracts (docs/GAP-ANALYSIS.md section 5.3), and codebase conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

### Key Source Files
- `packages/shell/src/shell-bridge.ts` — ShellBridge with Array.isArray guard
- `packages/shell/src/` — All shell source files
- `docs/GAP-ANALYSIS.md` — Section 5.3 (@kehto/shell boundary contract), Section 4 (silent failure at shell-bridge.ts:155)
- `docs/RUNTIME-MIGRATION.md` — Section 4 (SessionEntry identity changes affect shell)
- `.planning/research/ARCHITECTURE.md` — Shell integration flow, window.nostr injection

### Reference from Gap Analysis
- Envelope guard update: Array.isArray(msg) → envelope-first pattern
- window.nostr injection: new MUST requirement from NIP-5D
- shell.supports() capability advertisement: hardcoded false in shim

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
