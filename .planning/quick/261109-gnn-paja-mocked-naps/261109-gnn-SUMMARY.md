---
quick_id: 261109-gnn
status: complete
date: 2026-11-09
branch: feat/paja-mocked-naps
---

# Summary: Paja mocked interfaces

- **mocks** (`fe3b363f`): `MOCK_NAPPLET_BINDINGS` is generated from each extension
  NAP's API Surface and Wire Protocol tables at the mock's pinned ref
  (`bindings:generate` / `bindings:check`). Drift tests pin it to the mock routes,
  push capabilities, and spec shas.
- **shell** (`c3b9252c`): `NappletNamespacePreludeOptions.bindings` adds
  table-driven `window.napplet.<domain>` methods, `on(event)`, and named handlers
  over the private port. Validation happens host-side, and built-in domains are
  never replaced.
- **paja** (`b3c477f0`): Paja registers 18 mocks, appends enabled ones to the
  frame environment through the disable and grant policy, passes the bindings to
  the prelude, and assigns the mocked NAP-CLASS on `shell.ready`. The Interfaces
  panel shows a `◌` mark, `data-mocked`, and a legend.
- **docs/tests** (`28acf037`): READMEs, package pages, the how-to, skills,
  changesets, and the `tests/e2e/paja-mocked-naps.spec.ts` screenshots.

Verification: build, type-check, unit (234 files / 2887 tests), and docs:check
are green. aislop scores 93 on both branch and main, with the same 7 pre-existing
warnings. `bindings:check` is current against upstream.
