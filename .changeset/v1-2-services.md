---
"@kehto/services": minor
---

Reference services realigned to the 8-nub protocol. `signer-service` is deleted; its responsibilities are split into a new `identity-service` (read-only `getPublicKey` / `getRelays` / `getProfile` / `getFollows` / `getList` / `getZaps` / `getMutes` / `getBlocked` / `getBadges`) and shell-mediated signing/encryption inside `relay.publish` / `relay.publishEncrypted`. New reference handlers added for the other four new nub domains: `keys-service` (keyboard actions — bindings/register/forward), `media-service` (MediaSession create/update/destroy + controls), `notify-service` (send/permission/channel register/dismiss/badge), and `theme-service` (get/changed broadcast with `publishTheme`/`getCurrentTheme` host-facing bundle). Legacy `audio-service` and `notification-service` remain for ifc-emit topics and coexist with the new NIP-5D envelope handlers.

**Breaking changes:**
- `signer-service` REMOVED. Napplets and hosts depending on `registerService('signer', ...)` must either register an `identity` service or remove the call; signing/encryption happens inside the shell via relay publishes.

**Migration note:**
- `tests/unit/shell-runtime-integration.test.ts` was removed in v1.2 — its v1.1 BusKind / signer.* assertions no longer apply to the 8-nub protocol model. Equivalent coverage is provided by the per-package integration tests added in v1.2 Phases 12-03 (identity), 12-04 (ifc), 12-08 (relay publishEncrypted), and 12-09 (storage).

**Peer deps:**
- @napplet/core bumped from >=0.1.0 to ^0.2.0
- Added @napplet/nub-identity, @napplet/nub-ifc, @napplet/nub-keys, @napplet/nub-media, @napplet/nub-notify, @napplet/nub-relay, @napplet/nub-storage, @napplet/nub-theme (all ^0.2.0)
