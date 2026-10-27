---
status: investigating
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
next_action: Implement a policy-mediated browser playback backend and reusable player surface; wire both hosts and verify protocol lifecycle.

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

Pending implementation and verification.
