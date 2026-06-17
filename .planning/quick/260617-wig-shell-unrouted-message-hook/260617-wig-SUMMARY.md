---
quick_id: 260617-wig
slug: shell-unrouted-message-hook
title: Add optional onUnroutedMessage observability hook to @kehto/shell
date: 2026-06-17
status: complete
commit: fba1b67
---

# Quick Task 260617-wig — SUMMARY

## What shipped

An optional, observe-only `ShellAdapter.onUnroutedMessage(info)` hook on `@kehto/shell`,
fired when `ShellBridge.handleMessage` drops an inbound postMessage it cannot route to a
registered napplet window. Surfaces the two previously-silent drop points:

- `no-source-window` — the `MessageEvent` had no `source` window.
- `unregistered-window` — the source `Window` is absent from `originRegistry` (iframe never
  registered, or a `srcdoc` reload swapped its `contentWindow` to a new object).

New exported type `UnroutedMessageInfo` (`{ type?: string; origin: string; reason }`).

## Why

FEED-02 (hyprgate/gui#21): a napplet's `outbox.subscribe` never reached the runtime, with
no observable signal — the bridge dropped it silently at `shell-bridge.ts:218-220`. This
hook makes that class of bug diagnosable without patching the bridge to add probes.

## Files

- `packages/shell/src/types.ts` — `UnroutedMessageInfo` interface + `onUnroutedMessage?` on `ShellAdapter` (both JSDoc'd).
- `packages/shell/src/shell-bridge.ts` — `reportUnrouted()` helper (defensive `type` extraction, swallows hook errors); fired before both early returns.
- `packages/shell/src/index.ts` — re-export `UnroutedMessageInfo`.
- `packages/shell/src/shell-bridge.test.ts` — 6 new tests.
- `packages/shell/README.md`, `docs/packages/shell.md` — documented under adapter hooks / scope boundaries.
- `.changeset/shell-unrouted-message-hook.md` — `@kehto/shell` minor.

## Design notes

- Observe-only: routing behavior unchanged (message still dropped).
- Opt-in: absent hook = zero behavior change.
- Pure callback, no console output of its own (host can `console.warn` inside its hook) —
  mirrors the existing `onAclCheck` / `onHashMismatch` pattern. Zero new deps.
- Hook errors are swallowed so a misbehaving host hook can never break message handling.

## Verification

- `npx vitest run packages/shell/src/shell-bridge.test.ts` → 22 passed (16 existing + 6 new)
- `pnpm test:unit` → 1064 passed (70 files)
- `pnpm type-check` → 13/13 green
- `pnpm build` → 24/24 green
- `pnpm docs:check` → OK (7 public package docs, TypeDoc targets)
- aislop `scan` (pinned 0.12.0) → 82/100, baseline unchanged; all 5 findings pre-existing in
  `apps/playground/*` (none in `packages/shell`); ≥ CI failBelow 50.

## Commit

- `fba1b67` feat(shell): add optional onUnroutedMessage observability hook

## Out of scope / follow-up

- Hyprgate-side fix for FEED-02 itself (register the intent feed `contentWindow` in
  `originRegistry`) — tracked in hyprgate/gui#21; this task only adds the kehto-side
  observability that makes it diagnosable.
