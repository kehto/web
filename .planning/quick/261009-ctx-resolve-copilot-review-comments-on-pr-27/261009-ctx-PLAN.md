---
quick_id: 261009-ctx
status: complete
---
# Resolve Copilot inline review on PR #277

Continue the clean existing PR branch feat/nip5d-event-schema at 613e351; preserve the unrelated primary checkout package.json edit. Execute GSD quick inline.

## Authority checked 2026-10-09

- NIP-5D, nostr-protocol/nips#2303: dskvr/nips@020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7, 5D.md (unchanged draft head).
- NAP-INTENT and NAP-INC: napplet/naps@a040914b4bbd3a5cd8a14b0f316a723c968ebfb2, naps/NAP-INTENT.md and naps/NAP-INC.md (current master).
- R/O are declarations, never grants. Optional absence must permit loading. Intent availability means the host can satisfy the convention; these hosts deliver through inc.event.
- Root/snapshot events have no d tag. Keeping them out of the dTag-keyed intent catalog is bounded host policy, not a protocol prohibition on other future event-coordinate routing.
- CSP belongs before authored resources, after signed-byte verification and outside the hash input.

## Tasks

1. Correct host intent eligibility (comments 4231740389, 4231740495, 4231740551): use the host-resolved target environment for INC availability, retain required/optional declarations, exclude nameless artifacts from the named catalog while allowing frame loading. Add regressions for enabled/disabled optional INC, nameless catalog isolation, and named/current/legacy loading. Update host docs and existing changeset coverage.
2. Correct documentation (4231740447, 4231740603, 4231740650): show actual restrictive CSP injection, migrate active capability guides to R/O with legacy requires compatibility, and synchronize fixture plugin version/description.
3. Verify and ship: focused regressions, build, type-check, unit suite, Playwright, docs check, slop gate; commit atomic changes, push PR branch, reply with evidence/spec refs to each comment and resolve all six threads. Record summary and STATE.md completion.

## Acceptance

All six claims have a recorded assessment and verified correction. Optional INC never becomes a requirement or grant. Unnamed signed artifacts still load without becoming empty-dTag candidates. Existing PR updated, all six review threads resolved, working tree clean.
