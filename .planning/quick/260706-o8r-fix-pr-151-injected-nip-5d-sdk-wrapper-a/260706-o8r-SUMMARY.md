---
status: complete
completed: 2026-07-06
---

# Fix injected NIP-5D SDK wrapper argument forwarding

## Outcome

Completed and shipped. Commit `2177ddb` aligned injected wrapper forwarding, added
broad public-SDK argument regressions, and preserved manifest scoping. The work
merged through `e9469b4` (PR #151), including tests, docs, and release metadata.

## Verification

Current namespace tests retain public wrapper argument forwarding coverage. Phase
103 subsequently hardened the surface without invalidating this completion.

