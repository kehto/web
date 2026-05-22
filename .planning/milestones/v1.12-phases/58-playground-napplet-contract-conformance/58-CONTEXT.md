# Phase 58: Playground Napplet Contract Conformance - Context

**Gathered:** 2026-05-22
**Status:** Ready for execution
**Mode:** Autonomous execution

<domain>
## Phase Boundary

Bring all 13 playground napplets into the Phase 56/57 contract by adding
manifest `requires` declarations, source-level capability checks, explicit
raw-envelope classifications, and non-AUTH readiness wording.

</domain>

<decisions>
## Implementation Decisions

- Treat all NUBs actively used by each napplet as required manifest
  capabilities instead of optional showcases for v1.12.
- Keep bot/chat notification-like IFC events under the `ifc` contract; they do
  not use the notify NUB helper or notify wire domain directly.
- Remove identity readiness probes from napplets that do not need identity data.
- Rename NIP-5D protocol registration state from "authenticated" to
  "identity-bound" in shell state/UI and to "ready" in napplet UI sentinels.
- Keep raw demo envelopes only where Phase 56 policy allows explicit
  classification, then guard them in Phase 59.

</decisions>

<code_context>
## Existing Code Insights

- `definePlaygroundNappletConfig()` already accepts validated short `requires`
  names from Phase 57.
- Gateway metadata and `loadNapplet()` already reject unsupported required
  NUBs before iframe navigation.
- Every playground napplet imports `@napplet/shim`; none currently calls
  `window.napplet.shell.supports()`.
- Raw envelope uses are concentrated in `decrypt-demo`, `preferences`,
  `resource-demo`, `theme-switcher`, and `toaster`.

</code_context>

<specifics>
## Required Capability Matrix

| Napplet | Requires |
|---------|----------|
| `bot` | `ifc`, `storage` |
| `chat` | `ifc`, `storage`, `relay` |
| `composer` | `relay` |
| `config-demo` | `config` |
| `decrypt-demo` | `identity` |
| `feed` | `relay` |
| `hotkey-chord` | `keys` |
| `media-controller` | `media` |
| `preferences` | `storage`, `theme` |
| `profile-viewer` | `identity` |
| `resource-demo` | `resource`, `connect` |
| `theme-switcher` | `theme` |
| `toaster` | `notify` |

</specifics>
