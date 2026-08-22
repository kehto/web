# Runtime Resource Policy Boundary

Kehto does not define a universal resource-network policy. It is a toolkit and
protocol kernel: runtimes choose how URLs are resolved, which schemes they
support, and which origin, redirect, privacy, integrity, MIME, and size policies
fit their environment.

The protocol authority is draft
[NAP-RESOURCE](https://github.com/napplet/naps/blob/fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1/naps/NAP-RESOURCE.md)
at exact ref `fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1`. Merged
[NAP-IDENTITY](https://github.com/napplet/naps/blob/a040914b4bbd3a5cd8a14b0f316a723c968ebfb2/naps/NAP-IDENTITY.md)
at exact ref `a040914b4bbd3a5cd8a14b0f316a723c968ebfb2` delegates profile
picture and banner retrieval through NAP-RESOURCE. Those documents, together
with NIP-5D, take precedence over this non-normative implementer guide.

## Kehto's boundary

`createResourceService()` owns NAP request correlation, cancellation, bulk
limits, and result/error envelopes. The runtime supplies the resolver through
`fetch(url, init)`.

The default Kehto path is permissive delegation:

- every syntactically valid URL is passed to the injected resolver;
- `resource.info.schemes` is optional, advisory capability discovery and never
  an authorization gate;
- resolver-returned bytes and MIME are carried on the NAP wire;
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
- integrity verification and cache partitioning; and
- byte-based MIME classification or transformations.

These are options Kehto enables runtimes to implement, not requirements Kehto
imposes on every runtime.

## Browser behavior

An image element and `fetch()` do not have the same CORS visibility. A browser
may display a cross-origin image while preventing JavaScript from reading the
same redirect response. A browser-only resolver cannot recover bytes the browser
withholds. It should return bytes when its fetch can read them and report the
canonical `network-error` when the browser rejects the fetch. Kehto does not
invent a CORS-only NAP error or reinterpret that browser limitation as a ban on
HTTP(S) resources.

## Kehto reference surfaces

Paja is the reference developer runtime. It deliberately accepts arbitrary
`http:` and `https:` resource origins, uses credentialless/no-referrer browser
fetching, and lets browser CORS and mixed-content rules determine readability.
It always advertises `data`, `https`, and `http`. Its `blossom:` resolver
remains a separate content-addressed boundary and is advertised only when a
usable host-owned server is configured.

The playground is a visualization, not the reference runtime. It retains static
origin grants and iframe CSP fixtures so implementers can see and test the
optional grant-policy path. Those fixtures do not establish Kehto-wide policy.

## Implementation references

- `packages/services/src/resource-service.ts` — policy-neutral NAP lifecycle and
  optional origin-grant adapter.
- `packages/paja/src/browser-resource.ts` — Paja's concrete browser, data, and
  Blossom resolution choices.
- `apps/playground/src/demo-hooks.ts` — playground grant visualization.
- `tests/e2e/nap-resource.spec.ts` — browser evidence for image loading versus
  fetch-visible bytes and canonical failure.
- [NIP-5D conformance policy](./NIP-5D-CONFORMANCE.md) — envelope, provenance,
  and sandbox requirements shared by Kehto host implementations.
