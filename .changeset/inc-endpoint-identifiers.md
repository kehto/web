---
"@kehto/runtime": minor
"@kehto/shell": patch
"@kehto/mocks": patch
---

**Breaking (runtime):** NAP-INC peers are now runtime-assigned endpoint identifiers instead of manifest `d` tags, following NAP-INC at `napplet/naps@377bf939c6c906817084b43dd21d424de646dbc2`.

- `inc.event.sender`, `inc.channel.event.sender`, and every channel `peer` are opaque identifiers: one per live registered endpoint, taken from the injected `crypto.randomUUID`, stable until that registration is replaced or unregistered, and never reused.
- `inc.channel.open` only accepts such an identifier as `target`. A `d` tag target fails as `target not found` and logs `KEHTO_INC_DTAG_TARGET_RETIRED` once per runtime instance; there is no fallback.
- Two live instances that share a `d` tag are distinct and addressable, and root or snapshot manifests without a `d` tag can emit, subscribe, and open or accept channels.
- Replacing or unregistering a session now retires its INC endpoint: its channels close as `peer destroyed` and its topic subscriptions are dropped.
- New host API `Runtime.getIncEndpointId(windowId)` for host peer selection.

Migration: keep the `sender` (or channel `peer`) you received and pass that to `channel.open`. Do not hardcode a peer name or compare `sender` with one.

`@kehto/shell` documents the injected `inc.channel.open(target)` argument as an endpoint identifier; `@kehto/mocks` records the checked NAP-INC ref.
