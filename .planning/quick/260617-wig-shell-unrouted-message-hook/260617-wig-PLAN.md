---
quick_id: 260617-wig
slug: shell-unrouted-message-hook
title: Add optional onUnroutedMessage observability hook to @kehto/shell
date: 2026-06-17
status: in-progress
---

# Quick Task 260617-wig: `onUnroutedMessage` hook for @kehto/shell

## Why

`ShellBridge.handleMessage` (`packages/shell/src/shell-bridge.ts`) silently `return`s
when an incoming postMessage can't be routed to a registered napplet window:

- line 218 — `if (!sourceWindow) return;` (the `MessageEvent` has no `source`)
- line 220 — `if (!windowId) return;` (the source `Window` isn't in `originRegistry`)

These silent drops are the reason FEED-02 (hyprgate/gui#21) was hard to diagnose: an
intent-created srcdoc window whose `contentWindow` was never registered had every
message (including `outbox.subscribe`) dropped here with no signal — no ACL check, no
log, nothing observable. This adds an opt-in observability hook so hosts can see drops.

## Scope

Add an optional, host-controlled callback `onUnroutedMessage?` to `ShellAdapter`,
fired at each of the two unrouted drop points with a structured payload. No new deps,
no console noise (mirrors the existing pure-callback `onAclCheck` / `onHashMismatch`
pattern — the host can `console.warn` inside its own hook).

## Tasks

### Task 1 — type + wiring + tests + docs (single atomic commit)

**Files:**
- `packages/shell/src/types.ts` — add `UnroutedMessageInfo` interface + `onUnroutedMessage?(info): void` on `ShellAdapter`, both JSDoc'd.
- `packages/shell/src/index.ts` — export `UnroutedMessageInfo` (typedoc treatWarningsAsErrors needs referenced types re-exported).
- `packages/shell/src/shell-bridge.ts` — fire `hooks.onUnroutedMessage?.(...)` before the two `return`s (218 `no-source-window`, 220 `unregistered-window`), extracting `type` defensively from `event.data`.
- `packages/shell/src/shell-bridge.test.ts` — assert the hook fires with the right payload for (a) no source window, (b) unregistered source; and does NOT fire for a registered window; plus malformed-but-routable data still surfaces `reason:'unregistered-window'` with `type:undefined`.
- `packages/shell/README.md` + `docs/packages/shell.md` — document the hook under adapter hooks.
- `.changeset/*.md` — minor bump for `@kehto/shell` (new public API surface).

**Action:** Add `UnroutedMessageInfo { type?: string; origin: string; reason: 'no-source-window' | 'unregistered-window' }`. In the bridge, compute a defensive `type` (`event.data?.type` when object-with-string-type) and call the hook with `{ type, origin: event.origin, reason }` immediately before each return.

**Verify:** `pnpm --filter @kehto/shell test`, `pnpm type-check`, `pnpm build`, `pnpm docs:check`, aislop gate.

**Done:** Hook fires on both drop points with correct payloads; registered windows unaffected; gates green; changeset present.

## must_haves

- truths:
  - The hook is optional and absent-by-default (no behavior change for hosts that don't set it).
  - Dropped-message routing behavior is unchanged — the bridge still returns; the hook is observe-only.
- artifacts:
  - `UnroutedMessageInfo` exported from `@kehto/shell`.
  - `onUnroutedMessage?` on `ShellAdapter`.
- key_links:
  - `packages/shell/src/shell-bridge.ts` (fire points)
  - `packages/shell/src/types.ts` (type + adapter field)
