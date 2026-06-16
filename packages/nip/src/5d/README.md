# `@kehto/nip/5d` — NIP-5D napplet manifest resolution

Resolve content-addressed [NIP-5D](https://github.com/dskvr/nips/blob/nip/5d/5D.md)
napplets: parse the manifest event, verify its signature, verify the
[NIP-5A](../5a/README.md) aggregate, fetch and verify each blob from Blossom, and
assemble the verified `/index.html`.

The napplet's identity is the `(dTag, aggregateHash)` tuple **computed from the
verified bytes** — never accepted from a host or gateway. Any failure throws a
`NappletResolutionError`; the caller must fail closed and never render unverified
bytes.

## Kinds

| Constant | Kind | Type |
|----------|------|------|
| `NAPPLET_KIND_SNAPSHOT` | `5129` | snapshot (regular) |
| `NAPPLET_KIND_ROOT` | `15129` | root (replaceable) |
| `NAPPLET_KIND_NAMED` | `35129` | named (addressable, has `d`) |

Distinct kinds keep napplets out of nsite gateway resolution.

## API

| Export | Description |
|--------|-------------|
| `NAPPLET_KINDS`, `isNappletManifestKind(kind)` | the three kinds + a guard |
| `parseNappletManifest(event)` | event → `{ dTag, paths, aggregateHash, servers, requires, title?, description? }` |
| `verifyManifestSignature(event)` | verify the manifest's Nostr signature |
| `verifyBlobHash(bytes, sha256)` | `true` iff bytes hash to `sha256` |
| `fetchBlob(servers, sha256, fetchBytes)` | fetch a blob from Blossom by hash, re-verifying it (servers untrusted) |
| `resolveNapplet({ event, fetchBlob })` | full pipeline → `ResolvedNapplet` (computed identity + verified `indexHtml`) |
| `NappletResolutionError` | typed failure (`code`: `invalid-signature` \| `invalid-manifest` \| `aggregate-mismatch` \| `blob-hash-mismatch` \| `blob-unavailable` \| `missing-index`) |

```ts
import { resolveNapplet } from '@kehto/nip/5d';

const napplet = await resolveNapplet({ event, fetchBlob });
// napplet.dTag, napplet.aggregateHash are computed from verified bytes
iframe.sandbox.add('allow-scripts');        // never allow-same-origin
iframe.srcdoc = napplet.indexHtml;          // opaque origin preserved
```

The gateway, if used, is only an accelerator: `resolveNapplet` re-verifies every
blob hash and the aggregate, so a lying server or gateway is rejected.
