---
"@kehto/services": patch
"@kehto/runtime": patch
"@kehto/paja": patch
---

Stop reporting relay failures as denials. Relays fail from time to time on
Nostr, and NAP-OUTBOX has codes for that.

- `@kehto/services`: an approved `outbox.subscribe`, `outbox.query`, or
  `outbox.getEvent` whose relay planning fails now answers
  `relay list unavailable` (or the network reason the router names) instead of
  `policy denied`, and asks for no approval. A transport throw inside an approved
  operation is a network reason too. `policy denied` is kept for an approval that
  did not execute, a revoked approval, a relay-gate refusal, and a router that
  cannot plan. A failing NIP-65 loader now falls back to `fallbackRelays` in
  `planRead`/`resolveRelays`/`planPublish` instead of rejecting. Planned reads
  settle once every relay sends EOSE, skip a relay whose subscribe throws, and
  mark partial results `incomplete: true` (`relay timeout` when none answers).
  Planned subscriptions keep running on the relays that attached. A publish no
  relay accepts is `relay timeout` instead of `publish denied`; a declined
  signer stays `publish denied`; an empty publish plan is
  `relay list unavailable`. A subscription cancelled after it opened is now
  released.
- `@kehto/runtime`: a relay that throws while an approved `relay.*` operation
  runs reports `relay subscription failed` / `publish failed` /
  `relay query failed` instead of `relay authorization unavailable or denied`.
- `@kehto/paja`: `publishToRelays` rejects with `publish denied` when the user
  declines, so a declined OUTBOX publish is no longer indistinguishable from a
  relay failure.
