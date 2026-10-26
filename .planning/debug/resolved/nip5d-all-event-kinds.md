---
status: resolved
trigger: "Kehto must load NIP-5D root 15129, named 35129 and snapshot 5129 events; Paja rejects root naddr. Audit beyond Paja."
created: 2026-10-20
updated: 2026-10-20
---

# Current Focus

hypothesis: Paja's coordinate filter and matching require named manifests, despite shared resolution accepting all three kinds. Snapshot tab deduplication also omits signed event identity.
next_action: none; implementation and validation complete, ready for PR review.

# Symptoms

Expected: root 15129, named 35129 and snapshot 5129 events load through signature/hash verification into sandboxed srcdoc.
Actual: root naddr produces "naddr kind 15129 is not a named NIP-5D napplet manifest kind."
Reproduction: paste a root naddr into Paja and Load.

# Specification sources

- NIP-5D: nostr-protocol/nips#2303 head 5560820fa4f37f45b8ab742a11aeb3001b17dc67, dskvr/nips/5D.md. Identity and Manifest require all three kinds; roots/snapshots have no d tag. Snapshot lineage is non-authoritative.
- NIP-19: nostr-protocol/nips master 0b5532c0355ab27f447e071a93c09cf3a2b4aad5, 19.md and 01.md. Replaceable-event naddr uses an empty identifier. Snapshots are pinned by nevent event ID.
- NAP-INTENT: napplet/naps master 19de5ce1cea40cd4c76089cdd8126e9f87648049, naps/NAP-INTENT.md. Catalogs accept all three; distinct snapshots require distinct IDs. Recommendation hints explicitly accept named 35129 coordinates only, which is distinct from loading events.

# Evidence

- packages/paja/src/runtime-resolver.ts addressableFilter rejects every kind except 35129 and always queries #d. matchesPointer always requires a matching d tag, so just removing the rejection cannot load roots.
- packages/nip/src/5d recognizes 5129/15129/35129, verifies every manifest signature and artifact hash; current-manifest forbids d on roots/snapshots. Catalog identity uses snapshot event ID and root publisher/kind.
- Paja frame-admission tests already cover all three kinds, but pointer tests only cover root/snapshot nevent and encode named-only naddr behavior.
- Paja runtime tab deduplication uses kind/publisher/dTag/hash, merging same-author snapshots with identical bytes despite separate catalog IDs.
- Playground's demo resolver takes an explicit dTag and uses a development HTTP relay fixture adapter; investigate and test how callers can select all three kinds without confusing a snapshot with a replaceable coordinate.

# Diagnosis and fix

Root cause: Paja conflated named coordinate lookup with every NIP-5D pointer. Both addressableFilter and matchesPointer required named semantics. The tab duplicate key independently used publisher/dTag/hash for immutable snapshots, omitting signed event ID.

Fix: accept root naddr with an empty identifier, query without #d and match publisher/kind. Retain named d matching. Require event-ID nevent for snapshots, and retain exact-nevent support for all kinds. Apply NIP-01 newest timestamp / lowest-ID tie ordering. Include snapshot event IDs in tab keys; stored pointers need no migration.

Scope audit: shared current/legacy parsing, cryptographic artifact resolution, publisher/kind-safe catalog identity, Paja shell admission and playground adapter already accept all three kinds. Current and legacy playground regressions now explicitly cover empty-dTag roots/snapshots. Shared tests cover successful resolution and forged signature/bytes for every kind. Cache lookups in resolution read raw hash-keyed blobs and reverify them; coordinate metadata is not used as an event source by any loader. NAP-INTENT's 35129-only recommendation-hint rule is explicitly normative, separate from event loading, and remains unchanged.

Evidence: new root/coordinate regressions reproduced 14 failures before the fix (the suite runs current and legacy formats). Focused shared/Paja/playground tests passed after the fix. Six browser tests pass for every pointer form, srcdoc provenance, readiness, sharing, reloads and separate same-byte snapshot tabs. Build, types, 2,270 unit tests and docs pass; quality score is 95 with only five pre-existing complexity findings.

# Verification plan

Resolver tests must cover root naddr without #d, named naddr, nevent for every kind, wrong author/kind/identifier, signature/hash failure, and immutable snapshot identity. Browser tests must load current signed events of all three kinds and prove srcdoc provenance, session readiness, sharing/restoration and distinct empty-dTag identities. Run build, types, all unit/browser/docs gates and quality scan, add changesets for shipped output, commit and open a PR.

# Resolution and verification

Conformant with the exact NIP-5D, NIP-19, NIP-01 and NAP-INTENT sources above. No spec gap or deferred loading support remains for 15129, 35129 or 5129.

- pnpm build: passed (33 packages, 32 build tasks).
- pnpm type-check: 17 tasks passed.
- pnpm test:unit: 177 files, 2,270 tests passed.
- pnpm test:e2e --config .kinds-playwright.config.ts: all 142 Chromium tests passed, including all-kind loading and restoration. Final six-case all-kind rerun with copied-link/readiness assertions passed too.
- pnpm docs:check: passed after waiting for completed build artifacts.
- aislop@0.12.0: 95/100, five existing complexity warnings, no new diagnostics or config changes.
- git diff --check: passed.

Temporary browser config retained normal test/browser selection and disabled automatic server startup. Tests used separately started worktree IPv6 previews to avoid an unrelated process occupying IPv4 port 4173. The temporary config was removed after testing.

Commits: f30cfa80 (fix, coverage, docs and Paja patch changeset), 3b6691a9 (root tie regression). Shared nip and playground changes are tests/docs only and introduce no package-output change.
