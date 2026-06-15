---
"@kehto/acl": minor
"@kehto/runtime": minor
"@kehto/shell": minor
---

feat: NAP ontology alignment — inc domain, inc:NAP-0N protocol IDs, dual-emit back-compat window

Aligns `@kehto/*` with the `@napplet/*` 0.9.0 rename from the `ifc`/`NUB-NN`
vocabulary to the canonical NAP vocabulary (`inc`/`NAP-NN`). Resolves kehto/web#24.

### @kehto/shell — `ShellCapabilities` public interface change

`buildShellCapabilities` now dual-emits two arrays in the `shell.init` payload:

- **`naps`** (new, primary): NAP-vocabulary capability set consumed by
  `@napplet/shim >=0.9.0`. Advertises bare domain `inc` (the NAP rename of
  `ifc`) and protocol IDs `inc:NAP-01..inc:NAP-06` (the `ifc:NUB-01..06` aliases
  renamed, plus `ifc:NAP-01` replaced). Contains NO `ifc` or `NUB-NN` identifiers.
  Conditional entries: `relay`+`outbox` when a relay pool is wired; `upload` when
  an upload backend is wired; `intent` when an intent dispatcher is available.

- **`nubs`** (retained, legacy): legacy `ifc`/`ifc:NUB-01..06`/`ifc:NAP-01`
  vocabulary retained unchanged for one back-compat release, consumed by
  `@napplet/nub` and `@napplet/shim <=0.8.x`. No content change from prior
  releases.

The dual-emit is intentional and slated for removal in a future cleanup milestone
(CLEANUP-01) once all downstreams have migrated to `@napplet/shim >=0.9.0`.

**Downstream consumer impact — hyprgate MUST consume `naps`:**
The `@napplet/shim >=0.9.0` `createShellSupports` function reads ONLY
`capabilities.naps`; it ignores `capabilities.nubs`. Any consumer (hyprgate or
custom shell host) that builds `supports()` from `shell.init.capabilities` must
switch from reading `nubs` to reading `naps` to work correctly with napplets
built against `@napplet/* >=0.9.0`. Legacy napplets (using `@napplet/nub` /
`@napplet/shim <=0.8.x`) continue to read `nubs` and are unaffected.

### @kehto/runtime — `inc.*` dispatch acceptance

The nub envelope dispatcher now registers the IFC handler under **both** the
`ifc` and `inc` dispatch keys. A napplet that sends `inc.subscribe`,
`inc.emit`, or `inc.channel.*` messages reaches the same handler as one that
sends the legacy `ifc.*` messages. The IFC handler is domain-aware: responses
to a requester echo the requester's own domain prefix (`inc.subscribe` →
`inc.subscribe.result`); push events to other napplets use the recipient's
tracked domain prefix, so each napplet receives its own vocabulary.

Legacy `ifc.*` routing is byte-for-byte unchanged — no regression for napplets
on `@napplet/nub` or `@napplet/shim <=0.8.x`.

### @kehto/acl — `inc.*` ACL gating

`resolveCapabilitiesNub` now maps the `inc` domain identically to `ifc` via a
fall-through `case 'inc':` in the domain switch. `inc.emit` and
`inc.channel.emit/broadcast` require `relay:write`; `inc.subscribe`,
`inc.unsubscribe`, `inc.channel.open/list/close` require `relay:read`. This
closes the ACL bypass that would have allowed `inc.emit` to fall through to the
`unknown → null/null` branch, bypassing the relay:write gate that `ifc.emit`
enforces.
