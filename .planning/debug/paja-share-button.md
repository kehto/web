---
status: verifying
trigger: "share button in kehto is no longer working. Paja tab Share: click it, and nothing happens; used to work"
created: 2026-10-20
updated: 2026-10-20
---

## Symptoms

Expected: Clicking a verified Paja tab's Share button presents a usable sharing action.
Actual: User reports clicking does nothing. Requested the affected pointer while independently testing both manifest branches.

## Current Focus

hypothesis: Confirmed non-advertised manifests bypassed visible sharing UI; copy failures depended on a browser prompt rather than an inspectable link.
next_action: Complete Firefox and full browser/doc/quality gates before shipping.

## Evidence

- Source renderShareButton calls openShareDialog only when canCreatePajaIntentLink is true. Otherwise shareRuntimeTab writes directly to clipboard; success only changes button.title for 1200ms. Failures use window.prompt.
- Existing .planning/debug/paja-share-dialog-click.md describes a separate intermittent Share-to-builder click failure; retain that evidence without assuming it explains the initial Share button report.
- Protocol authority checked before edits: NAP-INTENT PR106 fc121fc264615482143eda86125863d2e1f741a2 and NIP-5D PR2303 5560820fa4f37f45b8ab742a11aeb3001b17dc67. Builder must use verified advertised conventions and cannot infer one for an unadvertised app. Host share-dialog UX is outside the wire contract.
- Clean concern branch cut from current origin/main ff35f6da in the shared worktree root. Primary package.json rebrand WIP remains untouched. GSD debug runs inline.
- Six browser cases failed before the fix: no Share dialog for unadvertised apps, and no selectable app link in advertised-app dialogs. All six now pass with available, denied and missing clipboard APIs; mouse, Enter and Space activation; exact pointer URLs; copy feedback/manual selection; Escape/focus restoration; and retained live frames.
- Two existing builder/dispatch regressions pass alongside those six. Unit suite 177 files / 2,270 tests and build/type checks pass.
- Share now consistently opens its dialog. Intent creation retains the same verified-manifest guard; no inferred convention, native local-file sharing, dispatch or source-trust changes.

## Resolution

Pending.
