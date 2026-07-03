---
status: complete
quick_id: 260703-ghc
created: 2026-07-03
completed: 2026-07-03
---

# Quick Task 260703-ghc: Align Kehto raw read-style NAP event surfaces

## Goal

Make Kehto match the current NAP direction for raw Nostr events returned by read-style surfaces:

- Raw read-style event results use `RelayEventResult`: the raw event plus optional sidecar.
- `sidecar.resources` carries pre-resolved `ResourceSidecarEntry[]` under NAP-RESOURCE policy.
- `sidecar.relayHints` carries advisory relay URLs where the runtime observed the event or expects follow-up reads to work.
- Relay-local lifecycle stays in NAP-RELAY.
- NAP-OUTBOX streams until `outbox.close` or `outbox.closed`; it no longer exposes `outbox.eose`.

## Tasks

1. Map the live NAP/package contract and Kehto surfaces.
   - Files: `package.json`, lockfile, runtime/services/playground relay and outbox code, tests and docs that mention raw event results or `outbox.eose`.
   - Verify: current specs/packages prove the expected field names and removed lifecycle surface.

2. Patch affected Kehto code and tests.
   - Files: only the smallest runtime, services, playground, docs, and test surfaces that actually encode the old contract.
   - Verify: focused tests cover sidecar resources, relay hints, and absence of `outbox.eose`.

3. Run gates and ship.
   - Verify: focused unit/static tests first, then repo gates as far as practical (`pnpm build`, `pnpm type-check`, `pnpm test:unit`, docs/slop if changed).
   - Done: commits are atomic, quick-task summary/STATE are updated, branch is pushed, and a PR is opened if verification passes.

## Outcome

Complete in implementation commit `8aa2123`.
