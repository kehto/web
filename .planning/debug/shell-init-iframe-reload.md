---
status: fixed
trigger: "Evaluate and resolve kehto/web#99: shell.init is not resent when an iframe reloads with the same windowId"
created: "2026-06-26T09:13:24Z"
updated: "2026-06-26T09:25:00Z"
issue: "https://github.com/kehto/web/issues/99"
---

# Debug Session: shell.init iframe reload

## Symptoms

- expected_behavior: "When a host preserves a logical windowId across iframe reload/remount, a fresh iframe runtime that posts shell.ready receives a fresh shell.init."
- actual_behavior: "The second shell.ready is reportedly suppressed because initSent is tracked by windowId only, leaving the new @napplet/shim realm waiting indefinitely."
- error_messages: "No explicit thrown error reported; napplet.shell.ready() remains pending and shell.supports(...) stays false."
- timeline: "Reported in kehto/web#99 on 2026-06-25."
- reproduction: "Register iframe contentWindow under stable windowId; allow initial shell.ready/init; reload/remount iframe preserving windowId; register new contentWindow; new document posts shell.ready."

## Current Focus

- hypothesis: "`handleShellReady` must key shell.init idempotency to the originRegistry registration lifecycle, not only to windowId or Window."
- test: "Focused shell regressions plus Paja browser reload e2e."
- expecting: "Duplicate shell.ready in one registration is idempotent; re-registering an iframe/window lifecycle receives a fresh shell.init."
- next_action: "Resolved; commit and ship PR."
- reasoning_checkpoint: ""
- tdd_checkpoint: ""

## Evidence

- timestamp: "2026-06-26T09:13:24Z"
  source: "gh issue view 99 --repo kehto/web --json ..."
  finding: "Issue body states initSent.has(windowId) suppresses shell.init for a new iframe realm using the same logical windowId."
- timestamp: "2026-06-26T09:14:33Z"
  source: "pnpm exec vitest run packages/shell/src/shell-bridge.test.ts --testNamePattern \"resends shell.init\""
  finding: "Regression failed before the fix: second iframe received zero shell.init messages."
- timestamp: "2026-06-26T09:15:09Z"
  source: "pnpm exec vitest run packages/shell/src/shell-bridge.test.ts"
  finding: "The first fix passed synthetic tests but failed real Paja reload e2e because browser iframes expose a stable WindowProxy across navigations."
- timestamp: "2026-06-26T09:21:14Z"
  source: "pnpm exec vitest run packages/shell/src/shell-bridge.test.ts"
  finding: "Final regression suite passed after keying init delivery by originRegistry registration id per Window."
- timestamp: "2026-06-26T09:22:10Z"
  source: "pnpm test:unit"
  finding: "92 unit files and 1209 tests passed."
- timestamp: "2026-06-26T09:22:45Z"
  source: "pnpm docs:check"
  finding: "TypeDoc strict, VitePress build, and docs audit passed."
- timestamp: "2026-06-26T09:25:45Z"
  source: "pnpm test:e2e"
  finding: "Full Playwright suite passed: 69/69, including paja-single-window reload tests."
- timestamp: "2026-06-26T09:26:00Z"
  source: "pnpm dlx aislop@0.12.0 scan --changes --base HEAD; git diff --check"
  finding: "AI-slop scan passed 100/100 with no issues; whitespace check passed."

## Eliminated

## Resolution

- root_cause: "`shell.init` delivery was tracked by logical `windowId`, while iframe reloads create a new JS realm that needs its own init. In browsers the WindowProxy may remain stable across iframe navigation, so the guard needs the host registration lifecycle rather than `windowId` or Window alone. Re-registering the same `windowId` also left stale Window mappings in originRegistry."
- fix: "Assign a monotonically increasing originRegistry registration id on each register(), replace any prior mapping for the same Window or windowId, track init delivery by Window plus registration id, and post init to the source Window that sent `shell.ready`."
- verification: "Red/green focused regression; Paja reload e2e; pnpm type-check; pnpm test:unit; pnpm docs:check; pnpm test:e2e; AI-slop 100/100; git diff --check."
- files_changed: "packages/shell/src/shell-ready.ts; packages/shell/src/shell-bridge.ts; packages/shell/src/origin-registry.ts; packages/shell/src/shell-bridge.test.ts"
