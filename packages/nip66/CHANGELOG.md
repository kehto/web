# @kehto/nip66

## 0.2.0

### Minor Changes

- c0f1a44: Add `Nip66Aggregator.stop()` — consumers can now dispose the pool subscription on teardown (e.g. `window.addEventListener('beforeunload', () => aggregator.stop())`). Idempotent; calling `stop()` without a prior `start()` is a no-op. `start()` after `stop()` re-subscribes. Preserves accumulated state; use `resync()` when you want state cleared + re-subscribed in one step. Closes the v1.6 NIP66 SimplePool leak risk (PITFALLS.md M-03).
- 3059719: Initial publish of `@kehto/nip66@0.1.0` — a framework-agnostic NIP-66 kind-30166 relay-discovery aggregator extracted from hyprgate's monitor module (upstream consumer: hyprgate v2.0).

  `createNip66Aggregator(options)` subscribes to kind-30166 events via an injected `Nip66RelayPool` adapter and exposes two live projections: a relay-URL set (from `d`-tags) and a relay → NIP-support map (from `N`-tags). Each factory call returns a fresh instance with closure-scoped state — multi-instance safe.

  **Peer dependencies:** `nostr-tools` only (`>=2.23.3 <3.0.0`, matches `@kehto/shell`). Zero protocol-package peer deps, no NUB coupling — this is a framework-agnostic utility, not a NUB domain. Consumers bring their own pool (nostr-tools `SimplePool`, `applesauce-relay`, `@snort/worker-relay`, or custom) by implementing the three-line `Nip66RelayPool` adapter.

  **Scope (v0.1.0):** streaming kind-30166 subscribe + `d`-tag URL extraction + `N`-tag NIP-support parsing + optional `#n` network filter + resync. **Out of scope (deferred to v1.7+):** NIP-77 negentropy delta sync, OPFS cache priming, bundled default bootstrap relay list, demo-shell wiring.

  Integration target: `ShellAdapter.relayConfig.getNip66Suggestions()` in `@kehto/shell`. See `packages/nip66/README.md` for the wiring example.

  Addresses kehto#2 (hyprgate v2.0 Kehto Migration gap analysis — "extract NIP-66 monitor as publishable package"). Closes NIP66-01..05 (new category in v1.6).

  Public API (first real version — minor bump from the private 0.0.0 scaffold):

  - `createNip66Aggregator(options): Nip66Aggregator`
  - `Nip66RelayPool`, `Nip66Filter`, `Nip66AggregatorOptions`, `Nip66Aggregator` interfaces

  REQ-IDs: NIP66-01, NIP66-02, NIP66-03, NIP66-04, NIP66-05.

### Patch Changes

- d885328: v1.16 structural cleanup and anti-slop pass.

  This release removes the remaining local `aislop` structural warnings through behavior-preserving refactors and comment/import cleanup. The affected public packages keep their existing runtime contracts; the bump is patch-level because the changes are internal decomposition, code-quality cleanup, and packaging hygiene rather than new public API.

  Highlights:

  - Runtime relay, identity, IFC, and fallback domain handling were split into focused helpers.
  - Shell and playground-facing helpers were decomposed without changing public package exports.
  - Service factories and adapter builders were split into smaller private helpers.
  - Public package source now passes the local `aislop` gate with the existing scanner thresholds.
