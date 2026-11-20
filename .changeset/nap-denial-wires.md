---
"@kehto/runtime": minor
"@kehto/services": patch
---

Answer ACL and legacy Firewall denials on each NAP's own failure wire instead
of an invented `<type>.error`.

- `cvm.discover`, `cvm.request`, `cvm.close` and each `cvm.registry.*` get the
  matching `.result` with `error: "policy denied"` and no success fields;
  denied unknown `cvm.*` types stay silent (NAP-CVM napplet/naps#31 at
  `28cf1bdb`).
- `relay.publish`/`publishEncrypted` → `.result` with `ok: false`;
  `relay.query` → `.result` with `error`; `relay.subscribe` → `relay.closed`.
- `outbox.getEvent`/`publish` → `.result`; `outbox.subscribe` →
  `outbox.closed`.
- `upload.upload`, `notify.send`, every `dm.*` and `fs.*` request → `.result`
  with `error`; `count.query` → `ok: false, error: "policy-denied"`; a denied
  `notify.permission.request` → `granted: false`.
- Requests whose NAP defines no reply (`relay.close`, `outbox.close`,
  `notify.dismiss`/`badge`/`channel.register`) are denied silently.

Breaking for napplets or hosts that matched on these `.error` types.
`@kehto/shell`'s injected client already accepts the `.result` form.

`@kehto/services`: a failed `cvm.discover.result` no longer carries
`servers: []` next to `error`, and `CvmDiscoverResultMessage.servers` is now
optional.
