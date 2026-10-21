---
status: resolved
trigger: "share button in kehto is no longer working. Paja tab Share: click it, and nothing happens; used to work"
created: 2026-10-20
updated: 2026-10-20
---

## Symptoms

Expected: Clicking a verified Paja tab's Share button presents a usable sharing action.
Actual: User reports clicking does nothing for every napplet tried.

## Current Focus

hypothesis: Two confirmed failures: non-advertised manifests bypassed visible sharing UI, and native Share dialogs could send trusted pointer events into an opaque iframe underneath them.
next_action: Review the shipped fix/paja-share-button PR; no user action is needed for verification.

## Evidence

- Source renderShareButton calls openShareDialog only when canCreatePajaIntentLink is true. Otherwise shareRuntimeTab writes directly to clipboard; success only changes button.title for 1200ms. Failures use window.prompt.
- Existing .planning/debug/paja-share-dialog-click.md describes a separate intermittent Share-to-builder click failure; retain that evidence without assuming it explains the initial Share button report.
- Protocol authority checked before edits: NAP-INTENT PR106 fc121fc264615482143eda86125863d2e1f741a2 and NIP-5D PR2303 5560820fa4f37f45b8ab742a11aeb3001b17dc67. Builder must use verified advertised conventions and cannot infer one for an unadvertised app. Host share-dialog UX is outside the wire contract.
- Clean concern branch cut from current origin/main ff35f6da in the shared worktree root. Primary package.json rebrand WIP remains untouched. GSD debug runs inline.
- Six browser cases failed before the fix: no Share dialog for unadvertised apps, and no selectable app link in advertised-app dialogs. All six now pass with available, denied and missing clipboard APIs; mouse, Enter and Space activation; exact pointer URLs; copy feedback/manual selection; Escape/focus restoration; and retained live frames.
- Two existing builder/dispatch regressions pass alongside those six. Unit suite 177 files / 2,270 tests and build/type checks pass.
- Share now consistently opens its dialog. Intent creation retains the same verified-manifest guard; no inferred convention, native local-file sharing, dispatch or source-trust changes.
- Full local Chrome 155 run exposed five existing root/named/snapshot tests that depended on immediate clipboard copying. Updated them to use the explicit Copy app link action and assert its feedback before checking exact pointer identity.
- Traced native-dialog click-through with parent/iframe pointer listeners. Chromium 147 initially passed 20 repeated copies, but its full suite still missed two root/snapshot Copy clicks. Local Chrome 155 also failed under native autofocus, inert frames, compositor promotion, visibility/display suppression and first-paint gating. Those workarounds were removed.
- Share now uses Paja's existing host overlay layer with aria-modal, explicit background inertness, bounded Tab/Shift+Tab focus, Escape/Cancel cleanup and restoration of prior inert state. No frame hiding, unload, timeout, click retry or forced test activation remains.
- Final overlay passed 55/55 repeated Share and all-kind pointer cases in Chrome 155 without retries. Fixture click counters prove host clicks do not reach the napplet, and post-close app actions prove the same frame stays live and interactive.

## Resolution

Resolved in fix/paja-share-button. Share consistently presents the selectable app
link, visible copy status and manual fallback. Its host overlay receives pointer
input and retains keyboard focus without unloading or hiding napplets.

Final gates: build and 17 type-check tasks; 177 unit files / 2,270 tests; all 148
Chromium E2E tests in local Chrome 155 with zero retries; 55 repeated Share/all-kind
cases; 11 Firefox cases; docs, changeset status and diff checks. Changed-source
quality is 100/100. Full quality remains the existing 95/100 with five unchanged
warnings. Protocol refs above were rechecked unchanged; the result is conformant.
