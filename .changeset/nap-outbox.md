---
"@kehto/acl": minor
"@kehto/runtime": minor
"@kehto/services": minor
"@kehto/shell": minor
---

feat: implement NAP-OUTBOX outbox-aware relay routing

Adds shell-side support for NAP-OUTBOX, which centralizes the outbox-model relay
logic (NIP-65 discovery, write/read relay selection, fallback, deduplication,
signature validation, and publish fanout) in the runtime so napplets no longer
reimplement it. This complements — and does not deprecate — NAP-RELAY.

- `@kehto/acl`: new `outbox:read` / `outbox:write` capabilities and `outbox.*`
  capability resolution; `class-2` excludes `outbox:write` (mirrors `relay:write`).
- `@kehto/runtime`: routes the `outbox` domain to a registered `outbox` service
  with ACL enforcement (`outbox.query/subscribe/close/resolveRelays` → read,
  `outbox.publish` → write).
- `@kehto/services`: `createOutboxService` (pure `outbox.*` envelope router) and
  `createRelayPoolOutboxRouter` (concrete outbox-model router: per-relay fanout,
  dedup with relay attribution, signature validation, and signed publish fanout
  to author write relays plus recipient inbox relays).
- `@kehto/shell`: advertises `outbox` via `shell.supports("outbox")` when a relay
  pool is wired.
