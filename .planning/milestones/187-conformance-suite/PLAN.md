# Milestone: runtime conformance suite (kehto/web#187)

Branch `feat/187-conformance-suite`. The issue body (rewritten 2026-10-15) is the
acceptance contract. This file is the written plan kept in place of the
`/gsd:new-milestone` flow, which needs agents this context cannot spawn.

## Authority resolved on 2026-11-20

| Source | Ref | Status |
| --- | --- | --- |
| NIP-5D, nostr-protocol/nips#2303 | `dskvr/nips@f60550c3409d6d81a875088ec83e660571e10504` `5D.md` | open PR |
| napplet/naps master | `377bf939c6c906817084b43dd21d424de646dbc2` (SHELL, IDENTITY, INC, INTENT, THEME, `projections/web.md`) | merged |
| Open NAP drafts | per-domain PR heads recorded in `packages/conformance/src/authority.ts` | draft |
| Packaged contract | `@napplet/nap@0.41.0`, `@napplet/core@0.42.0` (lockfile, via #451) | installed |
| Kehto baseline | `kehto/web@8b72f3ba` | `staging/issue-sweep-2611` (main `b29e2a70` + #451, #452, #453, #454, #449) |
| Reference product shape | `napplet/web@71d1bbac` `packages/conformance`, `packages/conformance-cli`, `apps/conformance` | architecture only |

Differences from the issue's pinned refs: NIP-5D now carries every NAP message
over a `MessagePort` handed over in one window-level `napplet.hello`, so
`nip5d/source-binding` is a port-binding check; NAP-GAMEPAD is back in an open
PR (#130) rather than on master; the advertised catalog gained `llm`.

Rechecked 2026-11-20 after rebasing onto staging: naps master and the NIP-5D PR head
are unchanged. The research notes under the session scratchpad read the operation
inventory from `@napplet/nap@0.40.0`; #451 changed the CVM registry types, so phase 2
re-diffs the 0.40 and 0.41 `types.d.ts` before building the inventory.

## Phases

1. **Engine + first-party target + NIP-5D core + NAP-SHELL + headless CLI.**
   `packages/conformance` (model, probe artifact, driver contract, Kehto target,
   scenarios, pure checks, reporters), a Node runner at `@kehto/conformance/cli`
   (static server + Chromium via the optional `@playwright/test` peer), and
   `kehto conformance` in `packages/cli` delegating to it the way `kehto paja`
   delegates to `@kehto/paja/cli`. Minimal package docs, `jsr.json`, typedoc
   entry and changeset ship in this PR so it is green on its own.
2. **Per-domain catalog, drift guard, mutation tests.** Operation inventory for
   every advertised domain, runnable wire cases, NAP semantic cases, lifecycle
   and denial cases, `catalog/advertised-domain-covered`, mutation wrappers.
3. **UI + Pages + docs + release wiring.** `apps/conformance`, `--ui`/`--exec`,
   Pages artifact, docs, changesets, typedoc, docs audit, CI scope.

## Design decisions

- The probe is a self-contained HTML artifact whose bytes embed its plan. The
  target verifies a signed manifest and the artifact hash, then admits it through
  `admitBrowserDocument`, so identity, CSP and the namespace prelude come from
  the real shell path.
- The probe reports through an out-of-band collector frame, never the shell
  window, so reporting cannot revoke the binding or ride a domain under test.
- Raw wire access for unknown-envelope and malformed-wire cases is a
  `MessageChannel` tap installed ahead of the real prelude; uninstrumented loads
  cover the NIP-5D reachability and provenance checks.
- Collection is asynchronous; checks are pure functions over captured facts.

## Sibling PRs to account for (noted 2026-11-20)

- #454 `fix/331-inc-endpoint-ids`: adds `Runtime.getIncEndpointId(windowId)` and retires
  d-tag targets. The INC endpoint-identity checks are written against NAP-INC and are
  expected to fail on main until this lands; stack on it for the full-profile exit 0.
- #452 `fix/428-late-service-registry`: adds `Runtime.hasService`; the shell advertises
  only routed services. Affects the capability-truthfulness checks.
- #451 `chore/441-upstream-cvm-registry-types`: `@napplet/core` 0.42 / `@napplet/nap` 0.41
  and the lockfile. The drift guard pins the installed version, so rebase the inventory.
- #449 exports `randomUUID` from `@kehto/shell`; #450, #448, #453 do not touch this work.
