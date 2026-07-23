---
schema_version: 1
open_count: 16
waived_count: 0
fixed_count: 3
total_count: 19
last_updated: 2026-07-23T19:10:12.509Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 101 | unrun-verify | packages/shell/README.md |  | pnpm docs:check final audit blocked by unrelated docs/packages/paja.md version row | fixed | Exported the Phase 102 ACL observer types, corrected the Paja 0.8.1 version row, and reran pnpm docs:check successfully. | 2026-07-23T14:09:52.533Z | 2026-07-23T18:41:49.000Z |
| 2 | 101 | deviation | packages/paja/src/parity.test.ts |  | Rule 3 fixture correction removed stale ShellCapabilities fields to restore type-documentation generation | open |  | 2026-07-23T14:09:52.589Z |  |
| 3 | 101 | deviation | packages/paja/src/browser-adapter.ts |  | Paja identity fallback removed so ready resolves only from pre-srcdoc origin registration. | open |  | 2026-07-23T14:23:34.425Z |  |
| 4 | 101 | deviation | packages/paja/src/browser-runtime-tabs.ts |  | Runtime-pointer tabs use the same pre-srcdoc registration seam as single-frame Paja. | open |  | 2026-07-23T14:23:34.477Z |  |
| 5 | 102 | unrun-verify | .aislop/config.yml |  | AI-slop scan could not run because aislop@0.13.1 is absent from the installed workspace | open |  | 2026-07-23T17:41:27.883Z |  |
| 6 | 102 | deviation | packages/runtime/src/session-registry.ts |  | TDD RED checks passed but branch safety remediation required combined green commits | open |  | 2026-07-23T17:41:27.938Z |  |
| 7 | 102 | lint-warning | docs/packages/paja.md |  | docs:check fails because the Paja package page lacks the current 0.8.1 version row | fixed | Corrected the package page to 0.8.1; the complete docs gate now passes. | 2026-07-23T17:57:52.447Z | 2026-07-23T18:41:49.000Z |
| 8 | 102 | unrun-verify | .aislop/config.yml |  | AI-slop gate not run because the aislop executable is unavailable locally and on PATH | open |  | 2026-07-23T17:57:52.505Z |  |
| 9 | 102 | unrun-verify | .aislop/config.yml |  | AI-slop verification could not run because aislop is not installed locally; installation is prohibited for this phase. | open |  | 2026-07-23T18:05:35.468Z |  |
| 10 | 102 | deviation | packages/runtime/src/service-dispatch.ts |  | Exact inc.emit early return added to prevent a generic inc service from bypassing INC runtime ownership. | open |  | 2026-07-23T18:05:35.521Z |  |
| 11 | 102 | unrun-verify | .aislop/config.yml |  | AI-slop gate could not run because the aislop executable is unavailable in the workspace. | open |  | 2026-07-23T18:11:19.801Z |  |
| 12 | 102 | deviation | packages/runtime/src/session-registry.ts | 125 | Enumerate live window sessions so ACL revocation reaches empty-pubkey NIP-5D sessions. | open |  | 2026-07-23T18:20:37.107Z |  |
| 13 | 102 | unrun-verify | tests/e2e/demo-notification-service.spec.ts |  | Focused notification Playwright verification could not run because Chromium is unavailable at /usr/bin/chromium. | fixed | Portable Chrome resolution and an IPv6-isolated playground preview enabled the focused run; all 7 tests passed. | 2026-07-23T18:27:08.877Z | 2026-07-23T18:32:20.000Z |
| 14 | 102 | unrun-verify | .aislop/config.yml |  | AI-slop verification could not run because aislop is unavailable locally; no package was installed. | open |  | 2026-07-23T18:27:08.930Z |  |
| 15 | 102 | deviation | apps/playground/src/main-notifications.ts | 39 | Removed a remaining retired notification topic-form toast cue during the active-source conformance scan. | open |  | 2026-07-23T18:27:08.984Z |  |
| 16 | 102 | deviation | tests/e2e/paja-single-window.spec.ts |  | Imported the fixture shim-bundle loader after the initial focused browser run. | open |  | 2026-07-23T18:55:12.205Z |  |
| 17 | 102 | deviation | tests/e2e/paja-single-window.spec.ts |  | Used shell.onReady so the reload fixture cannot miss an early captured shell.init. | open |  | 2026-07-23T18:55:12.259Z |  |
| 18 | 102 | deviation | tests/e2e/nap-inc-playground.spec.ts |  | Opt-in IPv6 base URL override keeps focused browser proof isolated from an unrelated IPv4 listener on port 4174. | open |  | 2026-07-23T19:02:33.378Z |  |
| 19 | 102 | deviation | tests/unit/nip5d-conformance-guard.test.ts |  | Allowed Markdown line wrapping in the exact-identity static guard assertion. | open |  | 2026-07-23T19:10:12.509Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "101",
    "file": "packages/shell/README.md",
    "line": null,
    "description": "pnpm docs:check final audit blocked by unrelated docs/packages/paja.md version row",
    "status": "fixed",
    "reason": "Exported the Phase 102 ACL observer types, corrected the Paja 0.8.1 version row, and reran pnpm docs:check successfully.",
    "recorded_at": "2026-07-23T14:09:52.533Z",
    "resolved_at": "2026-07-23T18:41:49.000Z"
  },
  {
    "id": 2,
    "kind": "deviation",
    "phase": "101",
    "file": "packages/paja/src/parity.test.ts",
    "line": null,
    "description": "Rule 3 fixture correction removed stale ShellCapabilities fields to restore type-documentation generation",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-23T14:09:52.589Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "deviation",
    "phase": "101",
    "file": "packages/paja/src/browser-adapter.ts",
    "line": null,
    "description": "Paja identity fallback removed so ready resolves only from pre-srcdoc origin registration.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-23T14:23:34.425Z",
    "resolved_at": null
  },
  {
    "id": 4,
    "kind": "deviation",
    "phase": "101",
    "file": "packages/paja/src/browser-runtime-tabs.ts",
    "line": null,
    "description": "Runtime-pointer tabs use the same pre-srcdoc registration seam as single-frame Paja.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-23T14:23:34.477Z",
    "resolved_at": null
  },
  {
    "id": 5,
    "kind": "unrun-verify",
    "phase": "102",
    "file": ".aislop/config.yml",
    "line": null,
    "description": "AI-slop scan could not run because aislop@0.13.1 is absent from the installed workspace",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-23T17:41:27.883Z",
    "resolved_at": null
  },
  {
    "id": 6,
    "kind": "deviation",
    "phase": "102",
    "file": "packages/runtime/src/session-registry.ts",
    "line": null,
    "description": "TDD RED checks passed but branch safety remediation required combined green commits",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-23T17:41:27.938Z",
    "resolved_at": null
  },
  {
    "id": 7,
    "kind": "lint-warning",
    "phase": "102",
    "file": "docs/packages/paja.md",
    "line": null,
    "description": "docs:check fails because the Paja package page lacks the current 0.8.1 version row",
    "status": "fixed",
    "reason": "Corrected the package page to 0.8.1; the complete docs gate now passes.",
    "recorded_at": "2026-07-23T17:57:52.447Z",
    "resolved_at": "2026-07-23T18:41:49.000Z"
  },
  {
    "id": 8,
    "kind": "unrun-verify",
    "phase": "102",
    "file": ".aislop/config.yml",
    "line": null,
    "description": "AI-slop gate not run because the aislop executable is unavailable locally and on PATH",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-23T17:57:52.505Z",
    "resolved_at": null
  },
  {
    "id": 9,
    "kind": "unrun-verify",
    "phase": "102",
    "file": ".aislop/config.yml",
    "line": null,
    "description": "AI-slop verification could not run because aislop is not installed locally; installation is prohibited for this phase.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-23T18:05:35.468Z",
    "resolved_at": null
  },
  {
    "id": 10,
    "kind": "deviation",
    "phase": "102",
    "file": "packages/runtime/src/service-dispatch.ts",
    "line": null,
    "description": "Exact inc.emit early return added to prevent a generic inc service from bypassing INC runtime ownership.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-23T18:05:35.521Z",
    "resolved_at": null
  },
  {
    "id": 11,
    "kind": "unrun-verify",
    "phase": "102",
    "file": ".aislop/config.yml",
    "line": null,
    "description": "AI-slop gate could not run because the aislop executable is unavailable in the workspace.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-23T18:11:19.801Z",
    "resolved_at": null
  },
  {
    "id": 12,
    "kind": "deviation",
    "phase": "102",
    "file": "packages/runtime/src/session-registry.ts",
    "line": 125,
    "description": "Enumerate live window sessions so ACL revocation reaches empty-pubkey NIP-5D sessions.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-23T18:20:37.107Z",
    "resolved_at": null
  },
  {
    "id": 13,
    "kind": "unrun-verify",
    "phase": "102",
    "file": "tests/e2e/demo-notification-service.spec.ts",
    "line": null,
    "description": "Focused notification Playwright verification could not run because Chromium is unavailable at /usr/bin/chromium.",
    "status": "fixed",
    "reason": "Portable Chrome resolution and an IPv6-isolated playground preview enabled the focused run; all 7 tests passed.",
    "recorded_at": "2026-07-23T18:27:08.877Z",
    "resolved_at": "2026-07-23T18:32:20.000Z"
  },
  {
    "id": 14,
    "kind": "unrun-verify",
    "phase": "102",
    "file": ".aislop/config.yml",
    "line": null,
    "description": "AI-slop verification could not run because aislop is unavailable locally; no package was installed.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-23T18:27:08.930Z",
    "resolved_at": null
  },
  {
    "id": 15,
    "kind": "deviation",
    "phase": "102",
    "file": "apps/playground/src/main-notifications.ts",
    "line": 39,
    "description": "Removed a remaining retired notification topic-form toast cue during the active-source conformance scan.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-23T18:27:08.984Z",
    "resolved_at": null
  },
  {
    "id": 16,
    "kind": "deviation",
    "phase": "102",
    "file": "tests/e2e/paja-single-window.spec.ts",
    "line": null,
    "description": "Imported the fixture shim-bundle loader after the initial focused browser run.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-23T18:55:12.205Z",
    "resolved_at": null
  },
  {
    "id": 17,
    "kind": "deviation",
    "phase": "102",
    "file": "tests/e2e/paja-single-window.spec.ts",
    "line": null,
    "description": "Used shell.onReady so the reload fixture cannot miss an early captured shell.init.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-23T18:55:12.259Z",
    "resolved_at": null
  },
  {
    "id": 18,
    "kind": "deviation",
    "phase": "102",
    "file": "tests/e2e/nap-inc-playground.spec.ts",
    "line": null,
    "description": "Opt-in IPv6 base URL override keeps focused browser proof isolated from an unrelated IPv4 listener on port 4174.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-23T19:02:33.378Z",
    "resolved_at": null
  },
  {
    "id": 19,
    "kind": "deviation",
    "phase": "102",
    "file": "tests/unit/nip5d-conformance-guard.test.ts",
    "line": null,
    "description": "Allowed Markdown line wrapping in the exact-identity static guard assertion.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-23T19:10:12.509Z",
    "resolved_at": null
  }
]
````
