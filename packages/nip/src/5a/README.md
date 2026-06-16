# `@kehto/nip/5a` — NIP-5A aggregate hash

Compute and verify the [NIP-5A](https://github.com/nostr-protocol/nips/pull/2287)
**aggregate hash** — a single content address over a set of published files.

A file set is declared by `path` tags (`["path","<abs-path>","<sha256>"]`) and
summarized by one aggregate `x` tag (`["x","<hex>","aggregate"]`). The aggregate
lets a consumer verify the whole set with a single hash.

## Algorithm

1. For each `path` entry, form the line `"<sha256> <abs-path>\n"`.
2. Sort the lines in ascending lexicographic order.
3. Concatenate them as UTF-8 bytes.
4. SHA-256 the bytes; encode as lowercase hex.

The result is independent of input order.

## API

| Export | Description |
|--------|-------------|
| `computeAggregateHash(entries)` | aggregate hash (lowercase hex) over `PathEntry[]` |
| `pathEntriesFromTags(tags)` | extract `{ path, sha256 }` from `path` tags |
| `aggregateTagValue(tags)` | read the `["x","<hex>","aggregate"]` tag value |
| `verifyAggregate(tags)` | `true` iff the `x` aggregate tag matches the recomputed value |

```ts
import { computeAggregateHash, verifyAggregate } from '@kehto/nip/5a';

const hex = computeAggregateHash([{ path: '/index.html', sha256: '186ea5…1c99' }]);
if (!verifyAggregate(manifestEvent.tags)) throw new Error('aggregate mismatch');
```

Used by [`@kehto/nip/5d`](../5d/README.md) to verify a napplet manifest's content
address before loading.
