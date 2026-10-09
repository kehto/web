---
status: complete
---
# Adopt current NIP-5D events with removable legacy compatibility

Authority checked before implementation: nostr-protocol/nips#2303, dskvr/nips@020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7/5D.md; napplet/naps@a040914b4bbd3a5cd8a14b0f316a723c968ebfb2/naps/NAP-SHELL.md and NAP-INTENT.md. Upstream package source: napplet/web@831d3dd5056b84bc03982966279ed8b9167152f8. Current writer cutoff: @napplet/vite-plugin 0.15.0; core/nap 0.32.0, shim 0.30.0, SDK 0.28.0 unchanged.

1. Normalize current single-artifact and legacy aggregate manifests at @kehto/nip/5d. Isolate legacy parsing/aggregate checks in one compatibility module. Preserve legacy public identity names as aliases; verify signatures and bytes for both. Validate cardinality, content, declarations, lineage; invalid icons remain nonfatal and are not rendered remotely.
2. Update playground build/distribution and Paja/playground catalogs and loaders for both schemas. Preserve exact legacy archetype/convention pairs; current independent z/i declarations project to N:M catalog support. R checks remain load requirements; O never blocks load or grants authority. HTML metadata remains outside runtime authority.
3. Adopt published plugin 0.15.0, update all affected docs and package changesets. Add paired schema tests for parsing, verification/cache, capabilities, intent routing, host loading and provenance. Keep legacy tests.
4. Run build, type-check, unit, docs, relevant/full Playwright and pinned slop gate; commit by checkpoint, push, open PR. Record verification and completion in GSD state.

Plan review: No schema retry on validation failure. Only explicit aggregate x plus path markers select legacy compatibility. Both paths share byte verification/cache and host injection. New-format producers use current events; legacy coverage uses explicit fixtures. Existing unrelated primary-worktree package.json edit stays untouched.
