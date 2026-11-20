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
| Kehto baseline | `kehto/web@ffa9726b` | `staging/issue-sweep-2611` (main `b29e2a70` + #449, #451–#454, #456, #448, #450) |
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

## Phase 1 status (2026-11-20)

Shipped as the first PR into `staging/issue-sweep-2611`. Design changes against
the original notes:

- `nip5d/port-binding` no longer compares Kehto's revocation reason label. NIP-5D
  (Identity) names the replacement evidence and the teardown, not a reason
  vocabulary, so revocation plus frame removal is the core condition and the
  label is diagnostics only.
- The wire tap gained a synchronous `shell.init` echo (`hold.echoInit`) so
  `shell/receiver-order` proves the receiver existed before `shell.ready`, a
  backlog so early inbound messages reach the probe, and the probe language
  gained an `assign` step for the read-only `services` check.
- `forge(message, 'sibling')` posts from the collector frame's realm so
  `shell/source-trust` covers a non-parent source as well as the parent.
- Package versions are injected at build time (tsup `define`); JSR source
  consumers see `dev`.

Findings (real Kehto failures, not relaxed; the one below was fixed on staging by #472):

- `nip5d/unknown-envelope`: `storage.<unknown>` is answered with
  `storage.<unknown>.result` + `error: "unknown storage action: …"`
  (`packages/runtime/src/state-handler.ts`). NIP-5D Wire Format: "Messages with an
  unrecognized `type` MUST be silently ignored." NAP-STORAGE@4f4cf0ca's "MUST return
  an `error` field … for invalid requests" covers its own result messages, not
  unrecognized types.

## Phase order change (2026-11-20)

The mutation self-tests for the phase-1 checks moved ahead of the per-domain
catalog (own PR, stacked on phase 1). Phase 1 showed only one check failing,
and only through a real finding, so every other green was unproven; proving
the base before stacking 25 domains on it is cheaper than debugging both at
once. Mutations are selected by name (`MUTATIONS`) so they cross
`page.evaluate`; each counts its applications so a silently dead mutation
fails. `shell/local-supports` gained a first-init probe because the retained
snapshot alone cannot show an init inventing availability.

## Phase 2 status (2026-11-20)

Per-domain coverage shipped as the third stacked PR. Fixtures and backends for
the 21 non-exemplar domains were written by three helpers in their own
worktrees (`feat/187-domains-{a,b,c}`) against `domain-brief.md` in the session
scratchpad, then merged here; storage, theme, identity and inc were the lead's
exemplars. Framework changes driven by their reports: `fill` from earlier
replies, request-caused pushes (no trigger), push match applied while waiting,
`since`-mark waits (a synchronous push could beat the quiet window), isolation
`setup`, binary payload revival, endpoint release between scenarios, and the
`broadcast` flag for NAP-mandated pushes.

Design decisions a maintainer may overrule:

- `catalog/acl-denial` judges only the message type: silence or the canonical
  result (with or without `error`) passes, `<type>.error` fails unless the NAP
  defines it (resource). The pinned NAPs leave the projection of a policy
  denial open, so a safe default without `error` is reported, not failed.
- `catalog/capability-truthfulness` fails an advertised domain when any request
  it is sent is not serviced canonically (NIP-5D: presence means available).
- `catalog/package-drift` is error severity: the issue requires missing
  specified package APIs to fail with drift diagnostics.
- `catalog/broadcast-to-loaded` replaces the earlier `nip5d/push-independent`
  idea: only pushes the owning NAP requires for every loaded napplet
  (theme.changed, identity.changed) are judged on listen-only endpoints.

Not covered yet: multi-endpoint NAP-INTENT delivery and privacy (the intent
backend exposes the controls), cross-endpoint LLM/WebRTC scoping, and the
success path of `relay.publishEncrypted` (the fixture signer has no nip44).
