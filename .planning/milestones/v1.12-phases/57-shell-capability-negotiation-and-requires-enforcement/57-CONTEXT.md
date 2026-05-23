# Phase 57: Shell Capability Negotiation and Requires Enforcement - Context

**Gathered:** 2026-05-22
**Status:** Ready for execution
**Mode:** Smart discuss skipped; implementation boundary follows Phase 56 contract decisions

<domain>
## Phase Boundary

Make shell capabilities authoritative for hosted napplets and expose manifest
`requires` through the gateway load path. This phase owns capability inventory,
`shell.ready`/`shell.init` consumption by the shim, gateway metadata shape, and
pre-navigation missing-capability checks.

</domain>

<decisions>
## Implementation Decisions

- Use `buildShellCapabilities()` as the single shell inventory for load-time
  checks and hosted `supports()` answers.
- Advertise `connect` and `class` because Phase 56 classified them as active
  Kehto NUB extensions backed by shell policy.
- Keep `nostrdb` out of shell capabilities.
- Parse `requires` from NIP-5A manifest tags and carry them in gateway metadata.
- Reject before iframe navigation when a manifest requires a NUB the shell does
  not advertise.
- Keep the shim's static `supports()` fallback for shell-less preview, but have
  hosted napplets replace it after `shell.init`.

</decisions>

<code_context>
## Existing Code Insights

- `packages/shell/src/shell-bridge.ts` already handles `shell.ready` and sends
  `shell.init` with `capabilities`, `services`, and `class`.
- `napplet/packages/shim/src/index.ts` had a static fallback but did not send
  `shell.ready` or consume `shell.init`.
- `apps/playground/vite.config.ts` already reads `.nip5a-manifest.json` for
  gateway metadata but returned only `dTag`, `aggregateHash`, and `htmlUrl`.
- `apps/playground/src/shell-host.ts` already supports a `beforeNavigate` hook,
  so the missing-capability check can run before `iframe.src` without changing
  the surrounding boot flow.

</code_context>

<specifics>
## Specific Ideas

- `supports('relay')` and `supports('nub:relay')` should both check
  `capabilities.nubs`.
- `supports('perm:popups')` should check `capabilities.sandbox`.
- Manifest `requires` values remain short NUB names. Spec identifier rejection
  and all-napplet declaration coverage are phase 58/59 guard work.

</specifics>

<deferred>
## Deferred Ideas

- Adding explicit `requires` declarations to all 13 napplets belongs to Phase 58.
- E2E proof for missing-capability warnings/rejection belongs to Phase 59.

</deferred>
