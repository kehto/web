# Runtime Resource Policy Boundary

Kehto does not define a universal resource-network policy. It is a toolkit and
protocol kernel: runtimes choose how URLs are resolved, which schemes they
support, and which origin, redirect, privacy, integrity, MIME, and size policies
fit their environment.

The protocol authority is
[NAP-RESOURCE PR #80](https://github.com/napplet/naps/blob/ae5b9c64ab8a4d8909f288829a01e99d6bd713bc/naps/NAP-RESOURCE.md)
at exact ref `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc`. Its `url`/ordered-`urls`
wire and canonical padded-base64 result contract take precedence over the stale
published `@napplet/nap` 0.32.0 and `@napplet/shim` 0.30.0 resource helpers.
Merged
[NAP-IDENTITY](https://github.com/napplet/naps/blob/a040914b4bbd3a5cd8a14b0f316a723c968ebfb2/naps/NAP-IDENTITY.md)
at exact ref `a040914b4bbd3a5cd8a14b0f316a723c968ebfb2` delegates profile
picture and banner retrieval through NAP-RESOURCE. Those documents, together
with NIP-5D, take precedence over this non-normative implementer guide.

Paja's implementation preserves byte sniffing, hash verification, complete
decoded `Blob` delivery, ordered independent bulk results and no raw SVG
delivery. Its DNS-safe proxy and redirect reauthorization are documented in
[the resource proxy policy](./RESOURCE-PROXY.md). This is a bounded conformance
result: host iframe isolation remains a separate prerequisite.

## Kehto's boundary

`createResourceService()` owns NAP request correlation, cancellation, bulk
limits, canonical base64 result projection, and result/error envelopes. The
runtime supplies the resolver through `fetch(url, init)`. `init.windowId` is
authenticated runtime context, not napplet payload, and the runtime's
`authorizeNetwork(destination, execute)` callback approves every actual HTTP(S)
destination without extending the NAP wire.

The default Kehto path is permissive delegation:

- every syntactically valid URL is passed to the injected resolver after exact
  resource authorization when the runtime supplies it;
- `resource.bytesMany` accepts canonical ordered `urls` input and preserves
  order and result length;
- `resource.info.schemes` is optional, advisory capability discovery and never
  an authorization gate;
- resolver-returned bytes and MIME are carried on the NAP wire;
- napplet-side `resource.bytes` and `resource.bytesMany` correlation remains
  open until the runtime sends a terminal result or error; runtimes own fetch
  deadlines and callers own explicit `AbortSignal` cancellation, which emits
  `resource.cancel` and drops late terminal envelopes;
- explicit `ResourceServiceError` codes are preserved; and
- an unexpected resolver failure becomes the canonical `network-error`.

Kehto also retains optional origin-grant tooling. A runtime that wants that
policy supplies `isOriginGranted`, `getConnectGrants`, and `resolveIdentity`
together. The service then checks the authenticated `(dTag, aggregateHash)`
grant before invoking the resolver. A runtime that does not want origin grants
omits all three hooks. Neither choice changes NAP-RESOURCE wire semantics.

## Runtime-owned choices

The resolver is the policy boundary. Depending on its deployment, a runtime may
choose browser `fetch`, a native HTTP stack, a backend proxy, content-addressed
storage, or another scheme-specific implementation. The runtime decides, within
the NAP contract:

- supported schemes and how unknown schemes fail;
- whether HTTP(S) origins require grants;
- credential and referrer handling;
- redirect and address rules;
- timeouts, response limits, and concurrency;
- Blossom URI/discovery validation, deduplication, caps, fallback order, and
  per-attempt network policy;
- integrity verification and cache partitioning; and
- byte-based MIME classification or transformations.

These are options Kehto enables runtimes to implement, not requirements Kehto
imposes on every runtime.

## Browser behavior

The browser resolver never fetches an arbitrary remote resource from the
napplet frame. Paja posts one approved hop to its same-origin resource proxy,
which validates the caller before DNS, pins a permitted public address, and
returns a readable redirect envelope for fresh authorization. The proxy does
not replace resource/runtime approval or the separate iframe-isolation work.

## Kehto reference surfaces

Paja is the reference developer runtime. It advertises `data`, `https`, and
`blossom`; trusted URI and host discovery select Blossom candidates. HTTP(S)
and Blossom reads use the same proxy with public-address DNS pinning, bounded
bodies and deadlines, no upstream credentials/referrer, and one-hop readable
redirects. The browser resolver authorizes every redirect before the proxy
contacts it and verifies Blossom SHA-256 after capped reads.

All Paja resource reads are capped at 10 MiB and classified from bytes, never
upstream `Content-Type`. Recognized image/audio/video/font/text/JSON and
checksum-valid Game Boy ROM formats retain their sniffed MIME. Only canonical
Blossom bytes that pass capped reads and matching SHA-256 may use
`application/octet-stream` for unknown opaque invalid-UTF-8 or NUL-bearing
binary. HTTP(S) and locally decoded `data:` retain recognized-type-only policy.
SVG, HTML, XML and script prefixes remain rejected, including documents with
NUL or invalid-UTF-8 suffixes; integrity verification does not make active
markup safe.
The encoding guard inspects UTF-16LE/BE when a BOM or initial alternating `<`
bytes identify it, decoding the complete capped buffer and applying the same
blocked-prefix policy without an arbitrary inspection cutoff. Identifiable
UTF-32 BOM or initial `<` document signatures are conservatively rejected.
UTF-16 nonmarkup remains eligible for opaque Blossom delivery; this is not a general XML parser
or a universal markup-security guarantee.

Paja also retains bounded per-window context for canonical Blossom references
returned by `outbox.getEvent`, `outbox.query`, or `outbox.subscribe`. On a later
byte request it orders event-local server hints before hinted authors' and the
verified event publisher's newest BUD-03 kind-10063 lists, then the active shell
user's BUD-03 list, followed by configured runtime fallbacks. Author, publisher,
and user lists are read lazily through host-configured NIP-65 bootstrap and
author-selected relays. Each exact `ws:`/`wss:` socket destination is approved
before it opens. The host refreshes signer-derived bootstrap URLs during signer
initialization and signer lifecycle changes; resource discovery only reads that
host cache and never invokes an external signer `getRelays()` hook because it can
perform opaque work before a destination exists to authorize. A failed refresh
falls back to configured host bootstrap relays. This remains independent of
upload mode, so reading events never prefetches their blobs.
This is a runtime-default policy within NAP-RESOURCE's second tier, not a new
wire field or an upload-mode dependency. It follows Blossom BUD-03 at exact ref
[`b5bd2801d1763aa635fc8fea7a76597e0eb18990`](https://github.com/hzrd149/blossom/blob/b5bd2801d1763aa635fc8fea7a76597e0eb18990/buds/03.md).

The playground is a visualization, not the reference runtime. It retains static
origin grants and iframe CSP fixtures so implementers can see and test the
optional grant-policy path. Those fixtures do not establish Kehto-wide policy.

## Implementation references

- `packages/services/src/resource-service.ts` — policy-neutral NAP lifecycle and
  optional origin-grant adapter.
- `packages/paja/src/browser-resource.ts` — Paja's concrete browser, data, and
  Blossom resolution choices.
- `packages/paja/src/browser-blossom-events.ts` — per-window OUTBOX resource
  context and author/publisher/user BUD-03 discovery.
- `apps/playground/src/demo-hooks.ts` — playground grant visualization.
- `tests/e2e/nap-resource.spec.ts` — browser evidence for image loading versus
  fetch-visible bytes and canonical failure.
- [NIP-5D conformance policy](./NIP-5D-CONFORMANCE.md) — envelope, provenance,
  and sandbox requirements shared by Kehto host implementations.
