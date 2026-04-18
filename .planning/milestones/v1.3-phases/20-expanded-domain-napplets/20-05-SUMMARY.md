---
phase: 20-expanded-domain-napplets
plan: "05"
subsystem: demo-napplets
tags: [theme-observer, preferences, napplet, sdk-gap, postMessage, D-USER-02]
dependency_graph:
  requires: [19-05]
  provides: [preferences-theme-applied-dom-contract, theme-observer-precedent-for-20-07]
  affects: [20-07-theme-broadcast-spec]
tech_stack:
  added: []
  patterns: [sdk-gap-exemption-narrowly-scoped-postMessage-listener]
key_files:
  modified:
    - apps/demo/napplets/preferences/index.html
    - apps/demo/napplets/preferences/src/main.ts
decisions:
  - "Preferences napplet now has exactly 1 window.addEventListener occurrence (D-USER-02 exemption, paralleling toaster Plan 19-03)"
  - "JSDoc anti-term comments in napplet src must use neutral phrasing to avoid false-positive grep matches — 'window.addEventListener' must not appear in JSDoc to preserve grep -c == 1 invariant"
  - "Plan 20-07 anti-term grep must exempt preferences (allow exactly 1 window.addEventListener in src/main.ts) just as it exempts toaster"
metrics:
  duration: "114s"
  completed: "2026-04-18T09:17:41Z"
  tasks_completed: 2
  files_modified: 2
requirements: [NAP-08]
---

# Phase 20 Plan 05: Preferences Napplet Theme Observer Extension Summary

Preferences napplet extended with a narrowly-scoped `window.addEventListener('message')` handler for `theme.changed` envelopes (D-USER-02) and a new `#preferences-theme-applied` DOM element — enabling Plan 20-07's theme-broadcast spec to assert the color reflected in the napplet.

## What Was Built

**File 1: `apps/demo/napplets/preferences/index.html`**

- Added CSS rules `#preferences-theme-applied` (color, font-size, padding, background, border-radius) and `.theme-applied-row` (flex layout) after `.preferences-log-entry` rule.
- Added a `<div class="theme-applied-row">` containing `<span id="preferences-theme-applied"></span>` between the Save button row and `<div id="preferences-log">`.
- Default textContent is empty — the listener populates it on the first `theme.changed` envelope.
- All Phase 19 DOM IDs unchanged: `#preferences-status`, `#pref-display-name`, `#pref-theme-preference`, `#preferences-save-btn`, `#preferences-log`.

**File 2: `apps/demo/napplets/preferences/src/main.ts`**

Updated file-header JSDoc to document D-USER-02 responsibility. Added SDK gap notice (parallel to Plan 19-03's toaster precedent). Added at the bottom of the file (after `init().catch`):

```typescript
const themeAppliedEl = document.getElementById('preferences-theme-applied');
window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window.parent) return;
  const data = event.data as Record<string, unknown> | null;
  if (!data || typeof data !== 'object') return;
  if (data.type !== 'theme.changed') return;
  const theme = (data as { theme?: { colors?: { background?: unknown } } }).theme;
  const bg = theme?.colors?.background;
  if (typeof bg !== 'string' || bg.length === 0) return;
  document.body.style.backgroundColor = bg;
  if (themeAppliedEl) themeAppliedEl.textContent = bg;
  log(`theme.changed received — bg: ${bg}`);
});
```

## Theme.changed Listener Guard Chain

The listener applies guards in order:

1. `event.source !== window.parent` — drops messages not originating from the parent frame
2. `!data || typeof data !== 'object'` — drops non-object payloads (null, string, etc.)
3. `data.type !== 'theme.changed'` — drops all other envelope types (storage.*, ifc.*, etc.)
4. `typeof bg !== 'string' || bg.length === 0` — tolerates malformed theme payloads (missing `theme`, missing `colors`, missing `background`, or empty string)

Only if all guards pass does the handler mutate the DOM.

## #preferences-theme-applied DOM Contract (for Plan 20-07)

| Element | ID | Updated by | Value format |
|---------|-----|------------|-------------|
| `<span>` | `#preferences-theme-applied` | theme.changed listener | hex string, e.g. `'#1a1a2e'` |

Plan 20-07's `theme-broadcast.spec.ts` should assert:
- `frame.locator('#preferences-theme-applied').textContent()` equals the color hex that the theme-switcher button dispatched.
- `document.body.style.backgroundColor` becomes the CSS computed form of that hex.

## Anti-Term Grep Evidence

```
$ grep -c 'window.addEventListener' apps/demo/napplets/preferences/src/main.ts
1
```

Exactly 1 occurrence — the functional `window.addEventListener('message', ...)` at line 132. The JSDoc file-header intentionally uses neutral phrasing ("The single message listener registered below") to avoid a false-positive grep hit.

Plan 20-07 anti-term grep rule update required:
- **Toaster**: allow exactly 1 `window.addEventListener` in `apps/demo/napplets/toaster/src/main.ts`
- **Preferences**: allow exactly 1 `window.addEventListener` in `apps/demo/napplets/preferences/src/main.ts`
- **All other napplet src files**: must have 0 occurrences

## Phase 19 Storage Persist Regression Check

The new listener is purely additive — it does not modify `loadPreferences()`, `savePreferences()`, `init()`, `saveBtn.addEventListener`, or any DOM ref from Phase 19. The Phase 19 storage-persist.spec.ts tests:
- `storage.getItem` / `storage.setItem` flow via `@napplet/sdk`
- `#preferences-status` transitions (`connecting...` → `loaded` → `saved`)
- Persistence across `page.reload()`

None of these are affected by the new listener. Plan 20-08 will re-run `storage-persist.spec.ts` to formally confirm no regression.

## Deviations from Plan

None — plan executed exactly as written. JSDoc neutral-phrasing adjustment (swapping `window.addEventListener('message')` text in JSDoc to "The single message listener registered below") is a Rule 2 micro-adjustment applying the established Phase 18/19 pattern for anti-term grep correctness, not a plan deviation.

## Self-Check: PASSED

- FOUND: apps/demo/napplets/preferences/index.html
- FOUND: apps/demo/napplets/preferences/src/main.ts
- FOUND: .planning/phases/20-expanded-domain-napplets/20-05-SUMMARY.md
- FOUND commit: 82a2d37 (Task 1 — index.html)
- FOUND commit: 2f270b3 (Task 2 — main.ts)
