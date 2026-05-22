---
phase: 48-demo-function-export-migration
verified_at: 2026-05-22
status: passed
score: 3/3
---

# Phase 48 — Demo Function-Export Migration — Verification

## Goal Restatement

Move remaining active demo/fixture SDK usage to direct helper functions across relay, identity, keys, notify, config, media, and resource surfaces while preserving existing DOM sentinels and E2E behavior.

## Per-Criterion Verdicts

### FUNC-03: Relay and identity migration

**Verdict:** PASS

**Evidence:** Chat, composer, feed, `nub-relay`, profile-viewer, theme-switcher, toaster, and `nub-identity` use direct relay/identity helpers from `@napplet/nub/<domain>/sdk`. Grep for active `@napplet/sdk` imports returns no matches.

### FUNC-04: Keys and notify migration

**Verdict:** PASS

**Evidence:** Hotkey-chord uses `keysRegisterAction` / `keysOnAction`; `nub-notify` uses `notifySend`; toaster uses `notifyDismiss` for dismiss. Toaster create/list remains raw with `NOTIFY-SDK-GAP` because the 0.3 helper surface does not expose `notify.create` / `notify.list`.

### FUNC-05: Config, media, and resource surfaces

**Verdict:** PASS

**Evidence:** Config-demo imports `get` / `subscribe` from `@napplet/nub/config/sdk` with local aliases. Media-controller already uses `@napplet/nub/media/sdk` and its comments now reflect that. Resource-demo remains raw with `RESOURCE-SDK-GAP` because Kehto's service contract uses `requestId` / `bodyBase64` while upstream `resourceBytes` expects `id` / `Blob`.

## Validation Commands

- `pnpm install` → exit 0.
- `rg "from '@napplet/sdk'|from \"@napplet/sdk\"" apps/playground/napplets tests/fixtures/napplets` → no matches.
- `rg "\b(relay|identity|keys|config|notify)\.(publish|publishEncrypted|subscribe|getPublicKey|getProfile|registerAction|onAction|send|get)\b" apps/playground/napplets tests/fixtures/napplets --glob 'src/**/*.ts'` → no matches.
- Phase 48 targeted build command → exit 0; 13/13 target builds passed.

## Final Verdict

**VERIFICATION PASSED** (3/3). Phase 48 is complete. Phase 49 is next.
