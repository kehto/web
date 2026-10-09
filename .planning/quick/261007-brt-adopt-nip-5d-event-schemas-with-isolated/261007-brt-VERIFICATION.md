---
status: passed
---
# Completion audit

| Requirement | Current evidence |
|---|---|
| Follow current NIP-5D authority | Read/rechecked #2303 at 020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7; NAP-SHELL and NAP-INTENT at naps a040914b4bbd3a5cd8a14b0f316a723c968ebfb2. Parser supports current x/content/z/i/R/O/icon/lineage. |
| Removable legacy architecture | Explicit selection in 5d/index.ts; legacy tag parsing and aggregate checks exclusively in legacy-manifest.ts; shared signature/blob/cache pipeline. No validation-failure fallback. |
| Preserve legacy events and identities | Existing index/aggregate suite retained; paired resolver, cache, host and browser tests; original aggregate identity is unchanged. |
| Current events have equivalent host functionality | All three kinds resolve in both schemas; Paja frame identity/requirements/prelude tests, playground current/legacy srcdoc and missing-domain browser cases; catalog projection and optional INC regressions. Full browser suite covers current-build runtime traffic. |
| Current package adoption | Every active plugin consumer and lock entry uses published vite-plugin 0.15.0. Package lineage/alignment tests pass. Published core/nap 0.32.0, shim 0.30.0 and SDK 0.28.0 remain unchanged upstream. |
| HTML metadata does not override runtime authority | Byte verification precedes CSP/namespace injection; R from signed manifests supplies requirements. Paired tests include conflicting HTML metadata; writer preserves metadata and i parameters before signing final bytes. |
| Docs and package release metadata | Runtime spec, package/host/cache docs, migration guide, docs navigation, conformance policy, and changesets for nip/shell/paja/services. No bump for comment-only outputs elsewhere. |
| Build | pnpm build: 32 tasks passed; final pnpm type-check includes successful build. |
| Type validation | pnpm type-check: 17 tasks passed. |
| Unit tests | pnpm test:unit: 1,868 passed in 152 files. |
| Browser tests | Final pnpm test:e2e: 89 passed in 1.7 minutes. |
| Docs gate | pnpm docs:check: strict TypeDoc, VitePress and 9 package docs passed. |
| Distribution | audit:gateway-artifacts: 15 artifacts passed; static Pages packaging created all 15 relay/Blossom paths. |
| Slop gate | Pinned 0.12.0 scan passed, 99/100; only baseline cvm-nostr-transport.ts file-length warning. Compared unchanged source against origin/main. Configuration untouched. |
| Commits and open PR | 1567360 resolver checkpoint; b97b388 host/package/docs checkpoint; PR https://github.com/kehto/web/pull/277 opened against main. |
| Unrelated work preserved | Primary checkout package.json workspace-field edit untouched; all changes isolated under ~/.worktrees/kehto/nip5d-event-schema. |

Current-schema implementation is conformant with the checked draft. Retained legacy
support is an explicit compatibility policy; no upstream semantic blocker remains.
Icons use generic artwork and are never rendered from unverified URLs. Lineage is
metadata only. Existing upstream core/shim generic shell type omissions remain
covered by Kehto's mandatory host-owned implementation and package drift guards.

GitHub CI is initiated by the open PR; local gates above are complete. No merge or
publication is part of this task's stop condition.
