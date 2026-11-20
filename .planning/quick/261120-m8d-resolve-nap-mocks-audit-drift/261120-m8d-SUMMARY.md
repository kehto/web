---
quick_id: 261120-m8d
status: complete
---

# Resolve the standing `audit:naps --strict` drift in @kehto/mocks

## Result

`pnpm --filter @kehto/mocks audit:naps --strict` exits 0: current 47, stale 0, retired 0, missing 0, deferred 3.

## Per entry

| Entry | Refs checked | Verdict |
|-------|--------------|---------|
| NAP-IDENTITY / SHELL / THEME | master 43cb3a4e8555 -> 377bf939c6c9 | Blobs identical (e897ba0e, 3734b027, 4f510ec2). Pure bump. |
| NAP-INTENT | master 377bf939; PR #106 head fc121fc2 | Blob 4f636dbe equals the #106 head that shell, services, Paja and the mock already target. Bump plus two regressions (fragment in wire convention, hint coordinate as handler). |
| NAP-LINK | PR #53 50a2cd45 -> 100e5c93 | API-only: `open()` result carries optional `error`. Mock already conformant; shell binding forwards it (new namespace test). |
| NAP-LLM | PR #134 3e10939c -> 5e93bdfc (PR #138 8f741326 merged into the branch) | Mock drifted on the wire (no toolChoiceModes, lowercase `toolcall`, no block lifecycle, samplingParams, `text` mirror). Rewritten; services already at 5e93bdfc (#401/#414/#448/#453). |
| NAP-WEBRTC | PR #59 69523e8c -> fb4dd6f0 | Mock lacked sendBytes, delivery semantics, byte limits. Added. Services/Paja already at fb4dd6f0 (#442/#452). |
| NAP-MESH | PR #122 closed 2026-11-12 | Retracted, superseded by NAP-NEIGHBOR #146 (different contract). Mock removed. |
| NAP-WEBMCP #150 93cab21beea9, NAP-NEIGHBOR #146 7b81774ae8d0, NAP-EMAIL #139 a63c592c78eb | live heads | No Kehto support; deferred via the new `scripts/deferred-naps.json`. |

## Findings outside this change

- `packages/services/src/webrtc-service.ts` answers a `webrtc.stats` request with `unsupported`. fb4dd6f0 has no such request (`stats` is a pushed event), and like every other services domain it answers unknown `<domain>.*` types with `.error`, while NIP-5D says unrecognized types are silently ignored.
- The injected `link.open()` binding resolves with the whole result envelope (`type`, `id`, `status`, `error?`), a superset of `LinkOpenResult`. Same pattern as `count.query`.
- Master staleness is commit-granular, so any master commit flags every master mock. Documented in the skill.
