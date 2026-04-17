---
"@kehto/acl": minor
---

ACL full 8-domain coverage. `resolveCapabilitiesNub` now maps capabilities for identity, ifc, keys, media, notify, relay, storage, theme. Signer domain removed (getPublicKey/getRelays moved to identity; signEvent/nip04/nip44 are shell-mediated via relay.publish/publishEncrypted). New capability constants: identity:read, keys:bind, keys:forward, media:control, notify:send, notify:channel, theme:read.

**Breaking changes:**
- Removed capability constants: sign:event, sign:nip04, sign:nip44
- Removed `resolveCapabilitiesNub` case 'signer'

**Peer deps:**
- @napplet/core bumped from >=0.1.0 to ^0.2.0
- Added @napplet/nub-identity, @napplet/nub-ifc, @napplet/nub-keys, @napplet/nub-media, @napplet/nub-notify, @napplet/nub-relay, @napplet/nub-storage, @napplet/nub-theme (all ^0.2.0)
