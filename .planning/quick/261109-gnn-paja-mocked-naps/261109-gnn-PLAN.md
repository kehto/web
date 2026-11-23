---
quick_id: 261109-gnn
slug: paja-mocked-naps
date: 2026-11-09
branch: feat/paja-mocked-naps
---

# Paja: mocked interfaces for every NAP Paja does not implement

Goal: Paja hosts `@kehto/mocks` for each NAP domain without a real Paja backend
(blossom, capture, catalog, class, display, git, hashtree, location, mesh, motion,
navigation, nzb, pow, soulseek, system, torrent, value, worker). Mark them as mocked
in the Interfaces panel with one compact symbol and a legend. Done = an open PR with
visual proof.

## Constraints found

- `@kehto/shell` `buildShellCapabilities` only advertises a fixed native/service list,
  but Paja owns its frame environment snapshot (`resolvePajaFrameEnvironment`), so it
  can add mocked extension domains itself.
- The runtime routes extension domains only for handlers with `messageCapabilities`
  and an `isDomainAllowed` grant, and the environment snapshot provides that grant.
- The NIP-5D prelude owns the only napplet port. Unknown domains get `{}`, so
  advertising a mocked domain would be hollow without a napplet-side binding.

## Tasks

1. **mocks**: generate `MOCK_NAPPLET_BINDINGS` from each extension NAP's API Surface
   and Wire Protocol tables at the mock's pinned ref (script plus a generated TS
   module). Methods take the wire request fields positionally, with result-less ops
   flagged. Push types and named `onX` handlers come from the tables. Add a drift
   test against mock routes, push capabilities, and spec refs.
2. **shell**: `NappletNamespaceOptions.bindings`, a table-driven binding for domains
   without a built-in binding: methods → request/result over the private port,
   `on(event, handler)`, and named handlers. Validate descriptors. Add unit tests
   and docs.
3. **paja**: `PAJA_MOCKED_DOMAINS`, simulation domain union, mock registration in the
   adapter, environment plus bindings to the prelude, and domain state. Interfaces
   panel gets a `◌` prefix, `data-mocked`, and a legend. Add tests, README/docs, and
   changesets.
4. **e2e**: a Paja spec proves a napplet calls a mocked domain and gets mock data,
   plus a marker/legend assertion and screenshots.
5. Run the gates (build, type-check, unit, docs:check, aislop, e2e spec), commit,
   push, and open a PR with screenshots.
