---
status: complete
---
# NIP-5D event schema adoption

Shipped for review: https://github.com/kehto/web/pull/277

- 1567360: current single-artifact parser, isolated legacy compatibility, shared verification/cache, paired tests and migration documentation.
- b97b388: published plugin 0.15.0 adoption, current final-byte manifest writer, host requirement/optional-domain handling, root/snapshot identity, catalog parity, docs and package changesets.
- Final validation: build/type-check/docs green; 1,868 unit tests; 89 browser tests; 15 artifact and Pages routes verified; pinned slop scan passing at 99/100 with one unchanged baseline warning.

Authority: NIP-5D #2303 at 020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7 and
NAP-INTENT/NAP-SHELL at napplet/naps a040914b4bbd3a5cd8a14b0f316a723c968ebfb2.
Current-schema path conforms; old events remain an explicit removable compatibility
extension. No permissions migrate automatically between aggregate and artifact
identities. Icons retain generic artwork. Runtime metadata comes from verified
signed events, never HTML metadata or gateway claims.

Primary checkout's unrelated package.json edit remains untouched. Worktree:
~/.worktrees/kehto/nip5d-event-schema, branch feat/nip5d-event-schema.
