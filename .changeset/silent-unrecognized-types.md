---
"@kehto/runtime": minor
"@kehto/services": minor
"@kehto/paja": patch
---

Stop answering message types the owning NAP does not define. NIP-5D
(nostr-protocol/nips#2303) says they "MUST be silently ignored", which also
prevents capability probing.

- `@kehto/services`: `notify`, `keys`, `serial`, `ble`, `common`, `lists` and
  `webrtc` no longer reply `<type>.error` / `Unknown <domain> method`. `notify`
  no longer sends `notify.controls` for an unknown type. A `webrtc.stats`
  request gets no reply, because NAP-WEBRTC defines `stats` only as a pushed
  event. `webrtc.sendBytes` still returns `unsupported`.
- `@kehto/runtime`: `storage.clear` and other unknown `storage.*` types no
  longer get an error result, and an ACL or firewall denial of an unknown type
  sends nothing in any domain (only `cvm.*` was silent before). New
  `createUnrecognizedTypeDiagnostic()` warns the host once per domain/type as
  `[KEHTO_UNRECOGNIZED_MESSAGE_TYPE]`, at most 16 types per instance, without
  payloads.
- `@kehto/paja`: the multiplayer `cvm` stub no longer answers unknown types
  with `unsupported`.

Known types with malformed payloads keep their NAP's failure results.
