---
"@kehto/services": minor
"@kehto/acl": patch
---

Align NAP-OUTBOX with the current draft by removing caller-visible routing controls.

`createOutboxService` and `createRelayPoolOutboxRouter` no longer expose or consume `OutboxStrategy`, `options.strategy`, or `options.live`. The service strips stale option fields at the envelope boundary, while the relay-pool router keeps outbox routing runtime-owned: reads use author write relays, directed publish fanout includes recipient read relays, and subscriptions remain open until `outbox.close` or `outbox.closed`.

`resolveCapabilitiesNap` no longer treats `outbox.eose` as a valid shell-originated outbox push; relay EOSE stays internal to relay routing.
