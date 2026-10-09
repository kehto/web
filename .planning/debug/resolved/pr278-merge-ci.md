---
status: resolved
trigger: "CI is failing on https://github.com/kehto/web/pull/278 after merge conflict resolution"
created: 2026-10-09
updated: 2026-10-09
---

# PR #278 merge CI failure

## Symptoms

Expected: local HTML and verified pointer targets load under their respective admission policies; CI passes.
Actual: TypeScript rejects PajaRuntimeTarget.manifest and the local loader test throws reading requires.
Started: merge cd184763 (parents 9719a563 and 62f1c6d6).
Reproduction: CI run 37984468457; browser-local-loader.test.ts and Paja type-check.

## Current Focus

hypothesis: The merge applied verified-manifest admission to unsigned local targets, which have no manifest.
next_action: Push the verified fix and confirm the GitHub checks on its new head.

## Evidence

- CI reports TS2339 and TS7006 at browser-target-frame.ts:86 and a runtime TypeError at that same line.
- Merge diff adds an unconditional resolvedTarget.manifest.requires access to navigateFrame.
- PajaRuntimeTarget is a union of verified pointers and PajaLocalTarget; only pointers have manifests.
- Existing local-target policy excludes local files from signed-manifest resolution, verified catalogs and persisted tabs.

## Specification boundary

NIP-5D at dskvr/nips@020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7 requires checking the signed R set against exposed domains; declarations never grant capabilities. Local unsigned files remain an existing dev-host spec gap, not verified artifacts. Checked NAP-SHELL at napplet/naps@e5308ac92cfd49e4fb026812c60886571515e219: endpoint identity precedes service use; receiver precedes ready; init describes actual exposed domains. This fix preserves those boundaries, does not alter shell messages or chase broader NAP drift.

## Resolution

Root cause confirmed locally: the existing loader test reproduced the same undefined-manifest crash; verified pointer tests remained green.

Fix cfc71c43 narrows signed-manifest admission with isPajaLocalTarget before accessing manifest.requires. No optional-manifest fallback or invented manifest was added. Local publisher metadata cannot grant capabilities; registration still precedes execution. The regression now tests plain HTML and untrusted publisher metadata and asserts identity/environment inside the srcdoc setter. Existing current/legacy pointer rejection tests remain intact.

Verification: focused 19/19; build 32/32; type-check 17/17; unit 1957/1957 (159 files); full Playwright 99/99; strict TypeDoc/VitePress/docs gate for 9 packages; diff hygiene pass. Pinned aislop 0.12.0 passes at 99/100 with existing browser-host.ts and cvm-nostr-transport.ts file-size warnings, no rules disabled. Changeset retained and updated. Primary-checkout package.json WIP preserved.

Evidence logs: /private/tmp/pr278-{red,focused,build,type,unit,e2e,docs}.log and /private/tmp/pr278-slop.json. Original failed GitHub run: 37984468457 at cd184763.

