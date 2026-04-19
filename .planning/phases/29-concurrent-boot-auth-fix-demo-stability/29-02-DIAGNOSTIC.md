---
phase: 29-concurrent-boot-auth-fix-demo-stability
task: 29-02-task-1 (checkpoint:human-verify)
diagnosed_at: 2026-04-19T23:00:00Z
method: automated via Playwright MCP (instead of manual UAT)
bucket: cascade-fixed
fix_required: none
---

# Plan 29-02 Task 1 — Diagnostic Report

**Verdict:** DEMO-02 is **cascade-fixed by Plan 29-01**. No Task 2 fix needed.

## Evidence

Manual UAT was automated via Playwright MCP against the built `:4174` demo post-29-01. Observations:

### DEMO-01 visual gate

All 10 topology cards show `authenticated` (green `rgb(57, 255, 20)`):

| Napplet | Status sentinel | Color |
|---|---|---|
| chat | authenticated | #39ff14 |
| bot | authenticated | #39ff14 |
| composer | authenticated | #39ff14 |
| preferences | authenticated | #39ff14 |
| toaster | authenticated | #39ff14 |
| feed | authenticated | #39ff14 |
| profile-viewer | authenticated | #39ff14 |
| theme-switcher | authenticated | #39ff14 |
| hotkey-chord | authenticated | #39ff14 |
| media-controller | authenticated | #39ff14 |

DEMO-01 PASSES.

### DEMO-02 — media-controller Play/Pause

**Pre-click baseline** (after 12s boot wait):
- `navigator.mediaSession.playbackState` = `'none'`
- `navigator.mediaSession.metadata.title` = `'Kehto Demo Track'`
- `navigator.mediaSession.metadata.artist` = `'v1.4 Media'`
- iframe `#media-controller-status` = `session-ready`

**Play click:**
- iframe `#media-controller-status` → `playing`
- `navigator.mediaSession.playbackState` → `'playing'`
- No ACL denials in console (only unrelated 404s on leader-line.min.js + favicon.ico)

**Pause click:**
- iframe `#media-controller-status` → `paused`
- `navigator.mediaSession.playbackState` → `'paused'`
- No ACL denials

### Why the original UAT report misled

The user's original post-v1.4 UAT reported "pressed play a bunch of times, nothing happens" — that symptom was a consequence of DEMO-01 (status text on the outer topology card was stuck on `loading…`), which made the napplet appear unauthenticated. The user concluded the Play button wasn't wired. In reality, the napplet's internal state and `navigator.mediaSession` integration were working correctly all along — the topology card's label was simply not being updated by the `main.ts:refreshAclPanelsIfNeeded()` function.

Plan 29-01's data-driven rewrite of that function updates the status label for all 10 napplets. With the label showing `authenticated` in green, the user can now see that clicking Play does in fact transition state — both in the iframe's own DOM sentinel and in the shell's `navigator.mediaSession`.

## Decision Matrix (from 29-02-PLAN)

- Bucket (i) ACL pre-grant: NOT APPLICABLE — no denial logged
- Bucket (ii) napplet-internal: NOT APPLICABLE — status transitions correctly
- Bucket (iii) shell-mediasession bridge: NOT APPLICABLE — `navigator.mediaSession.playbackState` reflects state correctly
- Bucket (iv) escalate: NOT APPLICABLE — observations are conclusive, not ambiguous

**Bucket selected:** `cascade-fixed` — a 5th bucket not in the original matrix. DEMO-02 did not need a separate fix; Plan 29-01 resolved it as a side effect.

## Observations

`commandCount` and `lastCommand` sentinels in the napplet stayed at `0` / `—` throughout. This is expected: those sentinels track SHELL→NAPPLET `media.command` pushes (triggered by OS media-key events via `navigator.mediaSession.setActionHandler`), which the Playwright-driven clicks don't simulate. The napplet→shell `media.state` path (which the buttons exercise) does not increment these sentinels by design.

## Next

Task 2 of Plan 29-02 reduces to a no-code-change confirmation plan:
1. Record this diagnostic in 29-02-SUMMARY.md with `fix_required: none`
2. Run `pnpm test:e2e` once more to confirm 49/0/0 baseline (unchanged from 29-01)
3. Commit the diagnostic + summary files
4. Update STATE.md and ROADMAP.md
