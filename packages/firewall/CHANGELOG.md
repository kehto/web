# @kehto/firewall

## 0.3.5

### Patch Changes

- 91a2c01: Accept `@napplet/core` and `@napplet/nap` 0.24.x peer dependencies across compatible Kehto packages.

## 0.3.4

### Patch Changes

- a07f3cd: Add a NIP-5D injected-domain namespace prelude helper for srcdoc hosts and
  align napplet package peer ranges with the inject-compatible release line.

## 0.3.3

### Patch Changes

- 2dfdebb: Align Napplet dependency ranges with the `resource.bytesMany` package release.

## 0.3.2

### Patch Changes

- 4e0f4b9: Add NAP-LINK runtime parity for the current `@napplet/nap` contract.

  The runtime now dispatches the `link` domain, `@kehto/services` exports a reference `link.open` service, shell capabilities can advertise NAP-LINK, and Paja/playground hosts register link support. Package peer ranges now track the current `@napplet` 0.20 line.

## 0.3.1

### Patch Changes

- fix(deps): widen @napplet peer range to admit 0.13 (kehto/web#48)

  On a `0.x` line a caret pins the minor, so `@napplet/{core,nap}` peers of `^0.12.0`
  resolved to `>=0.12.0 <0.13.0` and excluded the current `@napplet` 0.13 line —
  consumers installing `@napplet 0.13` (e.g. hyprgate's shell) hit a peer mismatch.

  The `@napplet/core` and `@napplet/nap` peer ranges on `@kehto/{acl,runtime,shell,services}`
  (and `@napplet/core` on `@kehto/firewall`) are widened to `>=0.12.0 <0.14.0`, which keeps
  0.12 working while admitting 0.13. kehto's dev deps are bumped to the 0.13 line so its own
  build, type-check, and full unit suite validate against it (all green). No source change —
  kehto consumes `@napplet` for protocol types + the wire format, which is stable across
  0.12 → 0.13.

## 0.3.0

### Minor Changes

- d37ef25: chore: modernize to @napplet 0.12/0.13 (peer dep + core API rename)

  All runtime packages move off the legacy `@napplet/nap` toolchain onto the
  current `@napplet` line:

  - **Peer dependency** `@napplet/core ^0.5` → `^0.12`, and `@napplet/nap ^0.5`
    → `@napplet/nap ^0.12` (the package was renamed upstream; `@napplet/firewall`
    consumers only need `@napplet/core ^0.12`).
  - **Core dispatch API** `registerNap` → `registerNap` and the `NapHandler` type
    → `NapHandler`. The runtime's domain dispatcher now calls `registerNap(...)`
    for every domain.

  **Migration for consumers:** install `@napplet/core@^0.12` and `@napplet/nap`
  (replacing `@napplet/nap`). The kehto wire protocol is unchanged — the legacy
  `inc`/`naps` envelopes are still dual-emitted for the installed 0.5.0 shim
  (removal is tracked as CLEANUP-01) — so no napplet-side code change is required;
  this is a host-side dependency and core-API modernization only.

  Internal kehto identifiers that still carry "nap"/"inc" vocabulary
  (`createNapEnvelopeDispatcher`, `IncDomain`, `inc-handler.ts`, …) are unchanged:
  they are private and the runtime dual-routes `inc`+`inc`.

## 0.2.0

### Minor Changes

- f5148a3: Add `@kehto/firewall` — a behavioral anti-abuse gate, and integrate it into `@kehto/runtime`.

  **New package `@kehto/firewall`** (pure, zero-dependency, WASM-ready, mirrors `@kehto/acl`): a normalized `Observation` plus a pure `evaluate(config, state, observation)` decision engine implementing per-`(napplet, opClass)` token-bucket rate limiting, an init-burst guard, declarative content matchers (event kind / payload size / focus conditions), a soft `unfocusedMultiplier`, and first-match-wins rule precedence (per-napplet policy → init-burst → content matchers → op-class rate → global rate → defaults). Includes pure config mutations with serialize/deserialize (defensive, falls back to defaults on malformed input) and conservative built-in defaults (exceed-action `flag`, init-burst `block`, `0.25×` unfocused).

  **`@kehto/runtime` integration:** every napplet message that passes the ACL check is now evaluated by the firewall before dispatch. Adds a `firewall-state` container, three new **optional** `RuntimeAdapter` hooks (`firewallPersistence`, `onFirewallEvent`, `getFocusContext`), and an allow/deny/ask per-napplet policy that reuses the consent handler ("reject now, prompt async, remember choice"). Config persists; counters are ephemeral. Focus is sourced shell-side (forge-proof), never self-reported by napplets.

  **Note (`@kehto/runtime` public API):** the `ConsentRequest` type gains a `'firewall-policy'` variant and its `event` field is now optional (a firewall consent prompt carries no Nostr event). Existing consent handlers continue to work; handlers that exhaustively switch on `ConsentRequest.type` should add the new variant.
