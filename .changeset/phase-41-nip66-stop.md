---
'@kehto/nip66': minor
---

Add `Nip66Aggregator.stop()` — consumers can now dispose the pool subscription on teardown (e.g. `window.addEventListener('beforeunload', () => aggregator.stop())`). Idempotent; calling `stop()` without a prior `start()` is a no-op. `start()` after `stop()` re-subscribes. Preserves accumulated state; use `resync()` when you want state cleared + re-subscribed in one step. Closes the v1.6 NIP66 SimplePool leak risk (PITFALLS.md M-03).
