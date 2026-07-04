# Quick Task 260704-jrn: Remove stale NIP-5D optional sandbox permission language

**Date:** 2026-07-04
**Status:** In progress

## Goal

Align kehto with the updated NIP-5D sandbox baseline after dskvr/nips#5 removed
the optional `allow-forms`, `allow-modals`, `allow-downloads`, and
`allow-popups` sentence.

## Cleanup Plan

1. Lock current behavior with focused tests around shell capabilities, Paja iframe
   sandboxing, and gateway sandbox guards.
2. Remove public and compatibility language that presents `perm:*` sandbox
   permissions as a supported NIP-5D capability surface.
3. Update historical docs and generated API docs so they no longer teach optional
   sandbox token relaxation.
4. Verify with focused tests, static searches for removed permission vocabulary,
   docs generation where generated docs change, and `git diff --check`.

## Scope

- Shell capability docs/tests for sandbox permission compatibility.
- Paja/playground sandbox assertions and generated docs that mention sandbox
  permission examples.
- Historical migration docs where they are still published under `docs/`.

## Out of Scope

- Runtime iframe behavior changes. Kehto already renders `allow-scripts` only
  and forbids `allow-same-origin`.
- New NIP-5D feature work unrelated to sandbox policy.
