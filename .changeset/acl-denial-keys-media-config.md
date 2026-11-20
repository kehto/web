---
"@kehto/runtime": minor
---

Answer ACL and legacy Firewall denials of the remaining NAP requests on their
own failure wires instead of an invented `<type>.error` (kehto/web#481).

- `keys.registerAction` → `keys.registerAction.result` with the request's
  `actionId` and `error`; `keys.forward`/`keys.unregisterAction` stay silent
  (NAP-KEYS napplet/naps#9 at `8869a4cf`).
- `media.session.create` → `.result` with `error`; the fire-and-forget media
  requests stay silent (NAP-MEDIA #10 at `7806f438`).
- `config.registerSchema` → `.result` with `ok: false` and `error`;
  `config.get`, `subscribe`, `unsubscribe` and `openSettings` stay silent, so a
  denied `config.get()` now times out instead of rejecting at once (NAP-CONFIG
  #14 at `bed9cb5b`).
- `outbox.resolveRelays` → `.result` with `plan: { relays: [], source:
  "policy" }` and `error` (NAP-OUTBOX #32 at `8865f73d`).
- `upload.info`/`upload.status` → `.result` with `error` only (NAP-UPLOAD #33
  at `f5cc981e`).
