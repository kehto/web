---
status: resolved
trigger: "NAP-FS picker results say unsupported while FS is enabled in Paja"
created: 2026-10-17
---

# Symptoms

- Expected: enabled FS supports host-mediated file selection and save selection.
- Actual: fs.pickFile.result and fs.pickSaveFile.result return unsupported.
- UI evidence: fs:read and fs:write ACL pills are green.
- Browser: Firefox (confirmed by user).

# Current Focus

- Root cause: OPFS succeeds but Firefox lacks the browser-native picker APIs.
- Resolution: workspace and native picker availability are reported separately
  from ACL grants. Missing native APIs are explained in host logs. Canonical
  unsupported replies and working workspace operations are preserved.

# Evidence

- Main baseline 0958a8b1. Primary checkout has unrelated package.json WIP;
  isolated branch fix/paja-fs-pickers preserves it.
- browser-adapter.ts registers FS after the OPFS getDirectory probe only.
- browser-fs.ts returns unsupported before activation if a picker API is absent.
- Production browser-host.ts passes the activation broker to createPajaAdapter.
- Existing unit tests cover workspace advertisement and an injected native picker,
  but not a real browser without native pickers.
- NAP-FS PR #88 at bd1b9e912f05203bf38f7a1b04f920744fe6d625 checked:
  picker UI/backing store is host-owned; runtime mediates choice, returns only
  virtual paths and correlated results; unsupported is allowed per behavior.
- Mozilla browser compatibility data reports Firefox version_added=false for
  showOpenFilePicker, showSaveFilePicker, and showDirectoryPicker.
- Regression was red against the original built Paja host (missing support UI).
- Real Firefox passes workspace read/write without native pickers, unavailable
  OPFS, and host-click picker activation/cancellation checks. Chromium passes
  the same scenarios, with native APIs removed for the unsupported case.
- Visually checked the new status in a real Firefox screenshot.

# Verification

- pnpm build and pnpm type-check: passed.
- pnpm test:unit: 176 files, 2,232 tests passed.
- Full Chromium suite: 128 passed. An uncommitted temporary config disabled
  webServer startup only; the normal preview servers were started separately
  because of an unrelated listener on the default harness port.
- Focused real Firefox suite: 3 passed.
- pnpm docs:check, pnpm changeset status, git diff --check: passed.
- AI-slop: changed sources 100/100; full scan passes at 95/100 with five
  existing findings in untouched browser-host, intent-builder, intent-uri,
  and CVM transport files. No rules or configuration were changed.
- NAP-FS PR #88 at bd1b9e912f05203bf38f7a1b04f920744fe6d625:
  conformant; no new wire fields, result errors, or filesystem authority.
