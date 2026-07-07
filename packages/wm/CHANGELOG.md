# @kehto/wm

## 0.0.2

### Patch Changes

- 3d14dd7: Improve JSR package scoring metadata by adding entrypoint module docs, public API docs, and explicit public export types without changing runtime behavior.

## 0.0.1

### Patch Changes

- b8475f7: Replace the Phase 35 throwing-stub `createWmService` with a working no-op default and ship the structural-primitive public surface consumers implement against:

  - Add `LayoutStrategy`, `WindowState`, `WindowPlacement` interfaces (D1–D3).
  - `createWmService({ hooks, strategy? })` — `strategy` defaults to a no-op identity (returns windows unchanged) so consumers can ship a working shell before implementing concrete layouts (D4).
  - Remove the algorithm-prescriptive `Layout = 'dwindle' | 'master-stack' | 'floating' | (string & {})` alias — consumers pick their own algorithm names (H-04 prevention).
  - No concrete layout algorithms ship in this package. See README for a consumer-integration example.

- d885328: v1.16 structural cleanup and anti-slop pass.

  This release removes the remaining local `aislop` structural warnings through behavior-preserving refactors and comment/import cleanup. The affected public packages keep their existing runtime contracts; the bump is patch-level because the changes are internal decomposition, code-quality cleanup, and packaging hygiene rather than new public API.

  Highlights:

  - Runtime relay, identity, INC, and fallback domain handling were split into focused helpers.
  - Shell and playground-facing helpers were decomposed without changing public package exports.
  - Service factories and adapter builders were split into smaller private helpers.
  - Public package source now passes the local `aislop` gate with the existing scanner thresholds.
