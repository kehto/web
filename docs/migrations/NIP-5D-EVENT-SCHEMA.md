# NIP-5D event schema migration

Kehto accepts current single-artifact events and legacy aggregate events. New
playground and fixture builds use published `@napplet/vite-plugin@0.15.0`.
Core/nap `0.32.0`, shim `0.30.0`, and SDK `0.28.0` remain the published runtime
contracts; their versions did not change for this writer release.

## Authority

Checked NIP-5D draft [PR #2303 at `020cb8b`](https://github.com/dskvr/nips/blob/020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7/5D.md),
[NAP-INTENT](https://github.com/napplet/naps/blob/a040914b4bbd3a5cd8a14b0f316a723c968ebfb2/naps/NAP-INTENT.md)
and [NAP-SHELL](https://github.com/napplet/naps/blob/a040914b4bbd3a5cd8a14b0f316a723c968ebfb2/naps/NAP-SHELL.md)
at `napplet/naps@a040914b4bbd3a5cd8a14b0f316a723c968ebfb2`.
The writer release source is `napplet/web@831d3dd5056b84bc03982966279ed8b9167152f8`.
The current path conforms to this draft; legacy support is an explicit temporary
compatibility policy, not the current protocol format.

## Normalization boundary

| Concern | Current event | Legacy event |
|---|---|---|
| Identity | SHA-256 of `/index.html` in one `x` tag | NIP-5A aggregate over `path` tags; `x` has `aggregate` marker |
| Description | Nonempty plain-text `content` | `description` tag |
| Required domains | Repeated `R` | Repeated `requires` |
| Optional integrations | Repeated `O`, never load requirements | No declaration |
| Routing | Independent `z` and queryless `i` sets | Explicit `archetype` role/convention pairs |
| Icon | Optional supported hash/MIME declaration | Generic artwork |

`parseNappletManifest` selects one parser from the signed event's `x` marker.
It never retries a malformed current manifest as legacy. The compatibility
module `packages/nip/src/5d/legacy-manifest.ts` owns legacy tag interpretation and
aggregate checks. Current manifests normalize to one `/index.html` path so the
shared byte-verification and cache pipeline needs no schema-specific fetch logic.

`ResolvedNapplet.artifactHash` exposes the verified identity. Existing
`aggregateHash` host, session, cache, and ACL fields retain their names and carry
the same value. Legacy identities stay unchanged. Republishing identical HTML
in the current format changes its identity from the aggregate to the artifact
hash; permissions and cached coordinate metadata must be re-established normally.
Do not copy legacy grants to the new identity automatically.

The parser preserves `archetypeSlugs` and `intents` with their parameter names.
For existing intent consumers, `archetypes` projects every advertised role onto
every accepted convention. NAP-INTENT keeps roles and conventions orthogonal;
it does not infer role equality from an intent URI. Legacy explicit pairs are
preserved exactly, without adding combinations. A current event without either
set remains loadable but has no convention-based handler eligibility.

Both hosts check required domains against their actual environment before
execution. `shell` is mandatory. Optional domains never block loading or expand
the injected namespace. Both host catalogs require the target's resolved
`intent` domain; canonical delivery does not require an INC declaration or binding.
Root/snapshot artifacts also
load normally, but remain outside the dTag-keyed intent catalogs: Kehto does not
yet route NAP-INTENT by event coordinate.

Icons are not needed to load an artifact. Kehto retains generic artwork; merely
parsing a supported icon declaration does not fetch or render it. Future display
code must verify the blob hash and decode the declared supported image format.
Snapshot `a`/`A` lineage is retained as metadata and never fetched on the
snapshot's behalf. HTML metadata is only publisher input, not runtime authority.

## Removing compatibility

Retire the explicit legacy selection branch and `legacy-manifest.ts`, then remove
legacy fixtures and paired-schema tests. Keep the shared verification, cache,
loaders, host injection, current schema tests, and NIP-5A utility package intact.
Renaming the public `aggregateHash` alias is a separate API migration; it is not
required to remove legacy event support.

While compatibility remains, tests cover both formats through signature/blob
failure, cache reuse and corruption recovery, all three manifest kinds, Paja and
playground resolution, host admission, and opaque `srcdoc` execution. Current
producer tests verify the final bytes against `x` after metadata and inlining.

Successful legacy resolution emits `KEHTO_COMPAT_LEGACY_MANIFEST` once per
resolver module lifetime. Migration and retirement criteria are tracked in
[the compatibility register](https://github.com/kehto/web/blob/main/docs/compatibility.md).

The delivery follow-up checks NAP-INTENT at
`25b29ee49e5bff8ebfe031f4b76dce98705c8b7e`: hosts now use `intent.deliver`
and buffered `intent.onDelivery`, with a warned local INC-listener adapter.
Broader invocation/result and catalog-identity changes are intentionally deferred;
this is delivery alignment, not full conformance to that newer spec.
