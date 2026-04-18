---
phase: 17-demo-app-rewire
plan: "06"
subsystem: e2e-specs
tags: [playwright, e2e, demo, specs, anti-term, E2E-06]
dependency_graph:
  requires: [17-01, 17-02, 17-03, 17-04, 17-05]
  provides: [E2E-06-specs]
  affects: [17-07]
tech_stack:
  added: []
  patterns: [demoBeforeEach, ANTI_TERM_RE console scan, shadow-DOM textContent assertion, data-service-name/stub selectors]
key_files:
  created:
    - tests/e2e/helpers/demo-before-each.ts
    - tests/e2e/demo-boot.spec.ts
    - tests/e2e/demo-debugger.spec.ts
    - tests/e2e/demo-service-toggle.spec.ts
  modified:
    - tests/e2e/helpers/index.ts
    - tests/e2e/demo-notification-service.spec.ts
    - tests/e2e/demo-node-inspector.spec.ts
decisions:
  - demoBeforeEach waits for #topology-root (dynamically rendered by renderDemoTopology) not the static #topology-pane
  - ANTI_TERM_RE pattern matches window.nostr, signer-service, BusKind, AUTH_KIND, kind === 29001/29002
  - demo-node-inspector spec rewrites legacy file that spawned its own dev server on :4175 — now uses playwright.config.ts webServer
  - inspector pane anti-term assertion uses regex union to tolerate no-auth case (shows 'no authenticated napplets')
  - debugger assertions use textContent() on napplet-debugger host element — Chromium includes shadow DOM content in textContent
metrics:
  duration: "~3 min"
  completed: "2026-04-18T00:13:14Z"
  tasks: 2
  files: 6
---

# Phase 17 Plan 06: Layer-B Demo E2E Specs Summary

One-liner: 5 Playwright specs and a demoBeforeEach helper covering boot, inspector, debugger, service-toggle, and notification-service for the demo surface at :4174.

## What Was Built

### New Helper: `tests/e2e/helpers/demo-before-each.ts`

Canonical per-test setup for demo-targeted specs (`demoBeforeEach`). Parallel to `aclBeforeEach` (harness-only) but without `__SHELL_READY__` / `__aclClear__` globals:

```
goto('/') → waitForLoadState('domcontentloaded') → localStorage.clear() → goto('/') → waitForSelector('#topology-root') → waitForFunction([data-service-name] >= 1)
```

**Why not `aclBeforeEach`:** The demo at `:4174` does not expose `window.__SHELL_READY__` (harness-only global). `aclBeforeEach` would time out immediately against the demo surface.

### Spec Files

| File | Purpose | Key Assertions |
|------|---------|----------------|
| `demo-boot.spec.ts` | Boot verification | 8 `[data-service-name]` nodes, 2 stub-badges (keys/media), `#shell-pubkey` present, anti-term scan |
| `demo-node-inspector.spec.ts` | Inspector per-role dispatch | ACL table/no-auth msg, "Registered NUBs" + 8 NUB names, capability state + "Recent envelopes", service-role content, close button |
| `demo-debugger.spec.ts` | Debugger envelope type display | `notify.create` in shadow DOM after trigger, `ENVELOPE_TYPE_RE` match, no ANTI_TERM_RE in debugger text |
| `demo-service-toggle.spec.ts` | Service toggle class flip | `.service-disabled` added/removed on click, no anti-term page errors |
| `demo-notification-service.spec.ts` | Notification service rewrite | Uses `demoBeforeEach`, asserts `notify.create` in debugger (not `notifications:create`), 5 canonical tests |

### ANTI_TERM_RE Pattern

```typescript
const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;
```

Applied in: console message scan, page error scan, debugger textContent check.

### demoBeforeEach vs aclBeforeEach

| Dimension | `demoBeforeEach` | `aclBeforeEach` |
|-----------|-----------------|-----------------|
| Target surface | Demo `:4174` | Harness `:4173` |
| Ready signal | `#topology-root` visible + `[data-service-name] >= 1` | `window.__SHELL_READY__ === true` |
| ACL clearing | `localStorage.clear()` only | `__aclClear__()` + `__clearLocalStorage__()` |
| Helper location | `tests/e2e/helpers/demo-before-each.ts` | `tests/e2e/helpers/acl-beforeEach.ts` |

## Deviations from Plan

### Auto-fixed: demo-before-each.ts uses #topology-root (not #topology-pane)

- **Found during:** Task 1 — reading index.html vs topology.ts
- **Issue:** `index.html` has a static `#topology-pane` div but no `#topology-root`. `#topology-root` is rendered dynamically by `renderDemoTopology()` into `#topology-pane`.
- **Fix:** Helper waits for `#topology-root` (dynamically inserted) not `#topology-pane` (static container) — `#topology-root` being present confirms topology JS executed successfully.
- **Files modified:** `tests/e2e/helpers/demo-before-each.ts`
- **Commit:** 7aeb693

### Auto-fixed: demo-node-inspector.spec.ts replaces legacy file (not new file)

- **Found during:** Task 2 — legacy file already existed targeting :4175 with its own dev server spawn
- **Fix:** Rewrote in place (same as demo-notification-service pattern) — removed legacy beforeAll server spawn, replaced with `demoBeforeEach` + `test.use({ baseURL: 'http://localhost:4174' })`.
- **Files modified:** `tests/e2e/demo-node-inspector.spec.ts`
- **Commit:** 17d9636

### ACL inspector regex relaxed to tolerate unauthenticated state

- **Found during:** Task 2 spec review
- **Issue:** Plan specified `relay:|state:|sign:` but ACL role content can show "no authenticated napplets" if napplets haven't authed when inspector opens, and the actual rendered capability names are `relay:read`, `identity:read`, etc. — not `sign:`.
- **Fix:** Regex broadened to `/relay:|identity:|state:|no authenticated napplets/` — matches both authenticated (cap labels) and unauthenticated (empty-state message) cases.
- **Commit:** 17d9636

## Known Gaps (for 17-07 Iteration Loop)

These gaps are expected and known — 17-07 will surface them when running specs against the live demo:

1. **`#chat-status` / `#bot-status` element existence** — demo-notification-service.spec.ts and demo-node-inspector.spec.ts wait for `authenticated`. If the demo's legacy napplets are removed or renamed in Phase 18, these waits will fail.

2. **Debugger shadow DOM textContent** — `page.locator('napplet-debugger').textContent()` includes shadow DOM in Chromium but not Firefox/WebKit. Tests run Chromium only per playwright.config.ts.

3. **`notify.create` in debugger** — depends on `notification-demo.ts` dispatching via the tap in `shell-host.ts`. If the tap or notify envelope path is broken, `demo-debugger.spec.ts` will fail pointing to 17-04/17-05 work.

4. **8-service-node count** — `demo-boot.spec.ts` asserts exactly 8. If `DEMO_SERVICE_NAMES` in `shell-host.ts` drifts from 8, this will fail with a count mismatch.

5. **`.service-toggle-icon` selector** — `demo-service-toggle.spec.ts` uses `.service-toggle-icon` class. If `topology.ts` renames this class, the test fails. The locator matches the `<button class="service-toggle-icon">` in `renderDemoTopology`.

## Self-Check: PASSED

All files created/modified verified on disk. Both task commits (7aeb693, 17d9636) verified in git log.
