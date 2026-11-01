---
"@kehto/shell": minor
"@kehto/paja": minor
---

Follow NIP-5D port-bound identity
([nostr-protocol/nips#2303](https://github.com/nostr-protocol/nips/pull/2303) at
`51ef0cd`, packaged by napplet/web#302). This is a security fix: a `Window`
survives same-frame navigation, so a napplet could previously replace itself
with unverified content that kept its identity and grants.

- `@kehto/shell`: the injected prelude opens a `MessageChannel` before napplet
  scripts run and hands one port to the shell in a single window-level
  `napplet.hello`. All NAP traffic then uses that port. `ShellBridge` binds the
  registered identity to the port, answers only over it, and revokes the
  binding, sessions and grants on a second hello, any other window-level
  message, an invalid hello, a second load (`observeFrame`) or the port closing.
  New APIs: `NAPPLET_HELLO`, `ShellBridge.observeFrame`, `ShellBridge.revokeNapplet`,
  `ShellAdapter.onNappletRevoked`, `ShellAdapter.onNappletMessage`,
  `originRegistry.bindPort` / `getPort` / `postToNapplet` / `getNappletTarget` /
  `isSpent`, and the `NappletRevocation`, `NappletRevocationReason` and
  `NappletMessageTarget` types.
  **Breaking:** window-level NAP envelopes are no longer processed and revoke
  the frame. `originRegistry.register` throws for a `Window` that already handed
  over its port, so create a fresh iframe for every navigation.
  `ProxyOriginRegistry` now requires `postToNapplet` instead of `getIframeWindow`,
  and `RelayPoolHooks.openScopedRelay` receives a `NappletMessageTarget` instead
  of a `Window`. Napplets on a Kehto host must not import `@napplet/shim`
  alongside the injected namespace, because it sends a second hello.
- `@kehto/paja`: creates a fresh iframe for every navigation, watches for second
  loads, and removes or replaces revoked frames (logged as
  `paja.napplet.revoked`). It logs port traffic in both directions and tracks
  readiness from the port. Intent delivery and scoped relay traffic use the bound
  port. The signed intent launcher's two host messages are handled outside the
  bridge, and only while its port is bound.
