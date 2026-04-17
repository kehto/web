# Phase 10: Spec Conformance Audit - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase produces two durable artifacts that feed the rest of milestone v1.2:

1. An authoritative NIP-5D spec reference inside this repo.
2. A cross-package audit document that inventories every way @kehto/acl, @kehto/runtime, @kehto/shell, and @kehto/services drift from that spec, plus from the message surface exposed by the eight `@napplet/nub-*` packages (identity, ifc, keys, media, notify, relay, storage, theme).

No runtime code changes in this phase — drift fixes are deferred to Phase 12 (and theme work to Phase 13). This is a documentation/analysis phase whose output drives downstream phase plans.

</domain>

<decisions>
## Implementation Decisions

### Spec Reference Strategy
- The NIP-5D spec is copied into `specs/NIP-5D.md` at the repo root, mirroring the napplet repo layout.
- The copy is synced from `napplet/specs/NIP-5D.md` (the authoritative upstream) at milestone boundaries.
- A short pointer line in `README.md` documents the sync source so future drift can be detected.

### Audit Document Layout
- Single document at `docs/v1.2-NIP-5D-AUDIT.md`, matching the existing `docs/GAP-ANALYSIS.md` and `docs/*-MIGRATION.md` convention from v1.0/v1.1.
- Organized by package: one section per `@kehto/*` package, plus a cross-cutting "Dispatch / Core API" section.
- Each section uses a markdown table with columns: `ID | Drift Item | Current State | Spec/Package Requirement | Target Phase | Remediation Note`.

### Drift Scope
- NIP-5D spec-level drift (what the protocol mandates vs. what kehto does today).
- `@napplet/nub-*` package surface gaps (every exported message type that kehto does not currently dispatch or handle).
- Both are included in the same audit document — downstream phases don't need to cross-reference two files.

### Remediation Granularity
- Every drift item identifies `packages/<pkg>/src/<file>.ts` (and function name when applicable).
- Every item has a one-line fix approach.
- Every item carries a `Target Phase` column pointing to the phase that will fix it (most will be Phase 12; theme-specific drift goes to Phase 13; dispatch-API drift goes to Phase 14).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docs/GAP-ANALYSIS.md` (v1.0, 567 lines) — precedent for cross-package, spec-vs-code style audits.
- `docs/{ACL,RUNTIME,SHELL,SERVICES}-MIGRATION.md` — precedent for per-package analysis with fix-level granularity.
- `napplet/specs/NIP-5D.md` — authoritative spec (upstream).
- `/home/sandwich/Develop/napplet/packages/nubs/{identity,ifc,keys,media,notify,relay,storage,theme}/src/types.ts` — source of truth for every NUB message surface (8 domains; pnpm workspace target for `@napplet/nub-*` peer deps).
- `specs/NIP-5D.md` (synced from `https://github.com/dskvr/nips/tree/nip/5d`, the canonical source) — authoritative spec text. Major changes vs. the prior snapshot: `window.nostr` MUST NOT be provided by the shell; `shell.supports()` uses the `perm:<permission>` namespace for sandbox permissions; signing and encryption are fully mediated by the shell (no napplet-side `signer.*` messages — signing is implicit in `relay.publish` / `relay.publishEncrypted`).

### Established Patterns
- Kehto docs live under `docs/` and use markdown tables for structured findings.
- Migration docs already established a two-column "current behavior vs spec behavior" pattern.
- Package code lives at `packages/<name>/src/`; runtime dispatch is currently in `packages/runtime/src/runtime.ts` (switch/case) and `service-dispatch.ts`.

### Integration Points
- The audit output is consumed by Phase 12 plans (four-nub drift fixes) and Phase 13 plans (theme implementation).
- The NIP-5D spec copy becomes referenceable by future plans as `specs/NIP-5D.md`.

</code_context>

<specifics>
## Specific Ideas

- Use the same heading depth and table shape as `docs/GAP-ANALYSIS.md` so contributors can skim either document the same way.
- Stable IDs per drift item (e.g., `DRIFT-RT-01`, `DRIFT-SVC-05`) so Phase 12 plans can cite them directly.

</specifics>

<deferred>
## Deferred Ideas

- Automated CI check that diffs `specs/NIP-5D.md` vs upstream on each napplet version bump — deferred to a future CI/CD milestone.
- Generating a machine-readable manifest of drift items (JSON) — deferred unless Phase 12 plans request it.

</deferred>
