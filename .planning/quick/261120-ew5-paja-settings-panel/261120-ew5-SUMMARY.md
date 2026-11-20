---
quick_id: 261120-ew5
slug: paja-settings-panel
status: complete
date: 2026-11-20
branch: feat/paja-settings-panel
base: staging/issue-sweep-2611
---

# Summary: Paja settings panel

## Outcome

- `packages/paja/src/settings-registry.ts` registers 114 settings (106 browser, 8 server) in 12 groups
  (key, label, shipped default, hard min/max, unit, browser|server scope).
- `settings.ts` validates (drop, never clamp), activates, and reads values at
  call time. Every call site that used a timeout, interval, cap, retry count or
  abuse bound now calls `getPajaSetting`.
- Browser: `browser-settings.ts` persists overrides only at
  `kehto:paja:settings.v1`; the top-bar **Settings** dialog is generated from the
  registry (per-field reset, reset all, save, save and reload, aria-invalid,
  role=status). Storage failure is session-only.
- Config file: `settings` block, validated strictly; server-scope keys activate
  in the CLI/server process, browser-scope keys seed the host page.
- Nostr kinds deduped into `nostr-kinds.ts` / `@kehto/nip/5d` constants.
- Fixed a latent vault bug: persistence now records the iterations the unlocked
  key was derived with, so changing the iterations setting cannot corrupt an
  existing vault.

## Audit result

443 literals scanned (`AUDIT-RAW.tsv`). Everything left in shipped source is
listed with its reason in `settings-guard.test.ts` (wire kinds, crypto/format,
RFC ranges, HTTP statuses, magic bytes, unit conversions, presentation,
`--port`/`--ready-timeout` which were already options). The guard fails on any
new bare number.

## NAP refs checked

NAP-WEBRTC `fb4dd6f` (napplet/naps#59), NAP-FS `bd1b9e9` (#88), NAP-RESOURCE
`ae5b9c6` (#80): all limits are shell policy; advertised values track settings.

## Verification

After rebasing onto staging `8023fbe6`: `pnpm build`, `pnpm type-check`,
`pnpm test:unit` (292 files, 3795 tests), `pnpm docs:check`, aislop changed
files 100/100 (one `installPajaLlmPanel` length warning that already exists on
the staging baseline), and a clean `pnpm test:e2e` run (144 passed, 1
pre-existing skip).
