---
status: verifying
trigger: Fix NAP-MEDIA with a player, using Hyprgate for ideas
created: 2026-10-27
updated: 2026-10-27
---

## Symptoms

Expected: shell-owned playback with visible controls, authoritative state, and safe session lifecycle in Paja and playground.
Actual: reference service rejects every shell-owned session; only mirrors napplet playback to OS controls.
Errors: `unsupported owner mode` for shell-owned sources.
Reproduction: create a media session with owner shell and a source URL.

## Current Focus

hypothesis: Missing playback backend and host player wiring, with additional ownership and retirement gaps.
next_action: Finish the full Playwright suite, commit verification evidence, push and open the PR.

## Authority

NAP-MEDIA draft PR #10, napplet/naps commit 7806f438530251fce5129f8e6239d6b642278759, naps/NAP-MEDIA.md. Merged master 5aadf1bf5d048cb231d683587d8eeef54f961492 has no NAP-MEDIA document. Draft is working authority, not a blocker.

## Plan

1. Inspect Hyprgate player patterns, packaged types, runtime trust/ACL routing and both host media adapters.
2. Implement actual shell playback through host resource policy, state/capability delivery, canonical IDs, ownership checks, retirement and cleanup. Preserve napplet-owned playback.
3. Provide accessible session controls and video rendering in both hosts, inspired by Hyprgate's session snapshots and capability-driven controls.
4. Add protocol, backend and browser regressions; sync docs, compatibility inventory and changesets.
5. Run build, type-check, unit, e2e, docs and slop gates; commit and open a PR.

## Evidence

- Existing media-service.ts rejects owner shell even with a valid source; session mutations do not check window ownership and destroy sends no terminal notification.
- Primary checkout has unrelated package.json workspaces edit. Preserved; isolated worktree based on origin/main 9fdb521e.
- Hyprgate graph is stale (snippet line offsets differ from live files); inspect live source at discovered paths.

## Resolution

Implemented policy-mediated browser playback, shared audio/video player, protected canonical media API, owner checks, retirement, ACL revocation, and endpoint cleanup. Hyprgate inspired the session snapshot/control separation, stable media element ownership, and capability-driven UI; no framework or provider transport was copied.

Verification checkpoints:
- Build and type-check pass.
- Full unit suite: 2,298 passed; two additional lifecycle tests pass in the focused 9-test suite (full rerun pending).
- Docs gate passes, including strict TypeDoc and all nine package docs.
- Focused browser proof: both hosts play, seek, change volume, finish naturally and retire; Paja video playback/reload cleanup passes. Rendered player inspected at /tmp/kehto-media-player.png.
- Full Playwright suite running; Paja media test including positive wire commands and napplet-owned controls passed.
- AI-slop score 95/100, identical to primary checkout baseline. Five existing size/complexity findings remain in untouched files; no new diagnostics and pinned configuration unchanged.
- Spec draft head rechecked unchanged at 7806f438530251fce5129f8e6239d6b642278759.

Bounded policy: finite browser-codec audio/video sources via resource URL/Blossom resolution; reject unsupported references. No HLS/DASH transport, Nostr resolver, queue, persistent playback, remote artwork or automatic focus resumption. These are optional host capabilities, documented in docs/media.md; no unresolved protocol contradiction blocks this implementation.
