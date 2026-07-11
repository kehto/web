---
'@kehto/services': patch
---

Start outbox reads before asynchronous NIP-65 discovery, add discovered relays to the same deduplicating collector, bound planning and collection with one deadline, and expose incremental query results through `queryStream()` while preserving `query()` aggregation.
