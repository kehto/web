---
status: complete
---
# /gsd:debug — Paja Events review fixes

Inline GSD debug workflow (no installed GSD command/tool available). Existing feature branch is the intended unfinished PR; preserve untracked PAJA-EVENTS-PANEL.md.

Authority rechecked: napplet/naps NAP-RELAY PR #2 head 9f30b3505335a52c574ff570576687d6467021ff and NAP-OUTBOX PR #32 head 8865f73d52a4864afee145f28d26520476273927. No wire changes; preserve deduplicated deliveries and existing hint-or-fallback policy.

1. Restore authorless hinted live routing and add regression coverage.
2. Observe verified, matching per-relay receipts before pool deduplication. Keep delivery/query deduplication; canonicalize source identities and avoid lifetime seenOn attribution. Exercise actual pool/relay receive behavior, silent sources, repeats and successive reads.
3. Synchronize published docs/changeset. Run build, types, units, docs, slop and relevant browser tests; record limits. Commit explicit paths, push existing PR branch, update PR description.
