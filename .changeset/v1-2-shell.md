---
"@kehto/shell": minor
---

Canonical NIP-5D shell posture. `window.nostr` injection is removed — napplet iframes no longer see a host-provided `window.nostr` at any lifecycle point. `shell.supports()` now uses the `perm:<permission>` namespace for sandbox permissions (e.g., `shell.supports('perm:popups')`); bare names continue to resolve NUB capabilities. Signing and NIP-44 encryption are shell-mediated exclusively via `relay.publish` / `relay.publishEncrypted` — napplets never receive raw signing keys or plaintext of encrypted payloads. New per-domain proxies (identity, keys, media, notify, storage) are available as optional composition seams for host-app interception. `keys-forwarder` module published for host-app DOM-event bridging. `ShellBridge.publishTheme()` added as a first-class broadcast API so host apps can push theme changes to every registered napplet.

**Breaking changes:**
- `window.nostr` injection REMOVED (reverses v1.1 SH-I02). Napplets relying on `window.nostr` must migrate to `nostr.publish(...)` / `nostr.publishEncrypted(...)` via the shell bridge.
- `shell.supports('<permission>')` renamed to `shell.supports('perm:<permission>')` for sandbox-permission checks.
- Signer-side shell exports removed (no `signEvent` / `nip04` / `nip44` surface).

**Peer deps:**
- @napplet/core bumped from >=0.1.0 to ^0.2.0
- Added @napplet/nub-identity, @napplet/nub-ifc, @napplet/nub-keys, @napplet/nub-media, @napplet/nub-notify, @napplet/nub-relay, @napplet/nub-storage, @napplet/nub-theme (all ^0.2.0)
