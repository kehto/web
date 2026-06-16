---
"@kehto/nip": minor
---

feat(nip): add NIP-5A aggregate hash and NIP-5D napplet resolution

Two new subpaths for content-addressed napplet loading:

- **`@kehto/nip/5a`** — NIP-5A aggregate hash. `computeAggregateHash` (sorted
  `"<sha256> <abs-path>\n"` lines → sha256 hex), `pathEntriesFromTags`,
  `aggregateTagValue`, and `verifyAggregate` (recompute vs the
  `["x","<hex>","aggregate"]` tag).
- **`@kehto/nip/5d`** — NIP-5D napplet manifest resolution. Kind constants
  `35129` (named) / `15129` (root) / `5129` (snapshot), `parseNappletManifest`,
  `verifyManifestSignature`, `verifyBlobHash`, `fetchBlob` (Blossom-by-hash,
  servers untrusted), and `resolveNapplet` — the full verify-signature → verify
  aggregate → fetch+verify blobs → assemble `/index.html` pipeline. A napplet's
  identity `(dTag, aggregateHash)` is computed from the verified bytes; any
  failure throws a typed `NappletResolutionError`.
