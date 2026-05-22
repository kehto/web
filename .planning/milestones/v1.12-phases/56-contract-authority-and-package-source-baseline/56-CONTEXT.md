# Phase 56: Contract Authority and Package Source Baseline - Context

**Gathered:** 2026-05-22
**Status:** Ready for execution
**Mode:** Smart discuss skipped; authority and packaging baseline has explicit roadmap boundary

<domain>
## Phase Boundary

Establish one repo-local NIP-5D contract derived from the pinned raw NIP source,
remove stale authority drift from active docs, classify the extension surfaces
needed by later phases, and make the playground package graph consume the local
`@napplet/*` sources being changed during this milestone.

</domain>

<decisions>
## Implementation Decisions

- Treat the pinned raw GitHub URL and commit as the only upstream authority.
- Keep `specs/NIP-5D.md` as the root repo-local implementation contract.
- Replace `RUNTIME-SPEC.md` with current NIP-5D runtime guidance instead of
  preserving old AUTH/REGISTER/NIP-01 protocol prose.
- Mark `napplet/specs/NIP-5D.md` non-authoritative because the nested submodule
  file had residual extension content beyond the pinned spec.
- Classify `connect`, `class`, `identity.decrypt`, and
  `relay.publishEncrypted` as Kehto NUB extensions; keep `nostrdb` out of the
  active playground conformance path until it has a NUB contract.
- Use root pnpm overrides to force local protocol package sources for the
  playground and add a unit guard so lockfile drift is visible.

</decisions>

<code_context>
## Existing Code Insights

- `RUNTIME-SPEC.md` described an old array-verb protocol with `REGISTER`,
  `IDENTITY`, and `AUTH`; this conflicts with pinned NIP-5D identity at iframe
  creation.
- `napplet/specs/NIP-5D.md` contained the pinned body plus additional residual
  extension material, making it unsafe as a spec authority.
- Root `package.json` only linked `@napplet/vite-plugin`; shim/core/nub/sdk
  changes would not affect playground napplet builds without expanded
  overrides.
- `tests/unit/sdk-migration-guard.test.ts` already owns package graph drift
  checks and is the right place for the local-source guard.

</code_context>

<specifics>
## Specific Ideas

- Keep this phase focused on contract/source authority, not behavior changes.
- Defer actual `supports()` plumbing, `requires` load checks, and per-napplet
  manifest declarations to phases 57 and 58.

</specifics>

<deferred>
## Deferred Ideas

- Raw demo-envelope allowlist implementation belongs to phase 58/59.
- Full static guard coverage and E2E proof belong to phase 59.

</deferred>
