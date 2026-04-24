---
phase: 39-nub-connect-nub-config
plan: "04"
subsystem: demo, shell, services
tags: [consent-modal, connect-store, nub-config, config-demo, iframe-revocation, test-hooks]
dependency_graph:
  requires:
    - 39-01 (connectStore.grant/revoke/getOrigins, ShellBridge.connectStore, audit:csp script)
    - 39-02 (createConfigService factory, ConfigService type, publishValues)
    - 39-03 (POST /__connect-grants Vite endpoint, serveNappletCsp CSP header middleware)
  provides:
    - apps/demo/src/consent-modal.ts (createConsentModal factory, DOM modal, 60s timer, D5-D8)
    - apps/demo/napplets/config-demo/ (11th napplet, full NUB-CONFIG round-trip)
    - apps/demo/src/shell-host.ts (11th DEMO_NAPPLETS entry, createConfigService wiring, setDemoConfigValue)
    - apps/demo/src/main.ts (__grantConnectOrigin__, __revokeConnect__, __publishConfigValues__, iframe destroy+recreate)
  affects:
    - 39-05 (E2E specs exercise all hooks and sentinels provided here)
tech_stack:
  added: []
  patterns:
    - consent modal as plain DOM (no framework) registered via bridge.registerConsentHandler
    - DEMO_NAPPLETS 10->11 with matching CLASS_BY_DTAG entry (module-load assertion)
    - setDemoConfigValue mutates demoConfigFixtures + calls publishValues for fan-out (D11)
    - iframe destroy+recreate via shell:connect-revoked CustomEvent (C-04 / CONNECT-04)
    - test hooks mirror __grantKeysForward__ / __grantMediaControl__ v1.4 pattern
key_files:
  created:
    - apps/demo/napplets/config-demo/package.json
    - apps/demo/napplets/config-demo/tsconfig.json
    - apps/demo/napplets/config-demo/vite.config.ts
    - apps/demo/napplets/config-demo/index.html
    - apps/demo/napplets/config-demo/config-schema.json
    - apps/demo/napplets/config-demo/src/main.ts
    - apps/demo/src/consent-modal.ts
  modified:
    - apps/demo/src/shell-host.ts
    - apps/demo/src/main.ts
    - apps/demo/index.html
decisions:
  - "Option A for consent handler: removed shell-host.ts registerConsentHandler setTimeout(500) auto-approve; moved to main.ts as fallthrough parameter to createConsentModal().registerWith()"
  - "config-demo uses config.subscribe (live push) + config.get (one-shot) via import { config } from '@napplet/sdk' -- confirmed export exists at sdk 0.2.1"
  - "#config-demo-update-btn added as hidden element (display:none) in index.html; topology renders iframe container dynamically from DEMO_NAPPLETS (no explicit card needed)"
metrics:
  duration_seconds: 450
  completed_date: "2026-04-24"
  tasks_completed: 3
  tasks_total: 3
  files_created: 8
  files_modified: 3
---

# Phase 39 Plan 04: Demo Wiring — Consent Modal + config-demo Napplet + Test Hooks Summary

**One-liner:** Custom DOM consent modal (60s timeout, dismiss=deny, cleartext warning), 11th config-demo napplet exercising NUB-CONFIG round-trip via @napplet/sdk, test hooks for E2E connect grant/revoke and config publish, and iframe destroy+recreate on revocation.

## Tasks Executed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Scaffold config-demo napplet (11th napplet) with full @napplet/sdk config round-trip | `eb3c520` | 6 files created under apps/demo/napplets/config-demo/ |
| 2 | Wire DEMO_NAPPLETS 10->11 + createConfigService + demoConfigFixtures + setDemoConfigValue | `de3475f` | apps/demo/src/shell-host.ts, apps/demo/index.html |
| 3 | Create consent modal + wire test hooks + iframe destroy+recreate in main.ts | `93fa0f4` | apps/demo/src/consent-modal.ts (created), apps/demo/src/main.ts, apps/demo/src/shell-host.ts |

## Files Created/Modified

### Created
- `apps/demo/napplets/config-demo/package.json` — private @kehto/demo-config-demo build target; @napplet/shim + @napplet/sdk deps
- `apps/demo/napplets/config-demo/tsconfig.json` — TypeScript config (mirrors feed napplet)
- `apps/demo/napplets/config-demo/vite.config.ts` — vite config with nip5aManifest({ nappletType: 'demo-config' })
- `apps/demo/napplets/config-demo/index.html` — HTML with #config-demo-values sentinel, #config-demo-status, NO meta-CSP
- `apps/demo/napplets/config-demo/config-schema.json` — 4 properties: theme (string), density (string), notifications-enabled (boolean), recentSearches (array)
- `apps/demo/napplets/config-demo/src/main.ts` — config.subscribe (live push) + config.get (one-shot); updates #config-demo-values on every push
- `apps/demo/src/consent-modal.ts` — createConsentModal() factory: DOM overlay z-index 10000, 60s timer->deny, verbatim origin list, cleartext warning, Allow/Deny/dismiss=deny

### Modified
- `apps/demo/src/shell-host.ts` — 11th DEMO_NAPPLETS entry, CLASS_BY_DTAG config-demo null, import createConfigService+ConfigService, demoConfigFixtures object, _configServiceBundle state, getConfigServiceBundle() + setDemoConfigValue() exports, config service registration in createDemoHooks(); removed old registerConsentHandler setTimeout(500) auto-approve
- `apps/demo/src/main.ts` — import setDemoConfigValue, connectStore, createConsentModal; wire createConsentModal().registerWith(relay, fallthrough); __grantConnectOrigin__ test hook; __revokeConnect__ test hook; shell:connect-revoked listener (iframe destroy+recreate); __publishConfigValues__ test hook; #config-demo-update-btn click handler
- `apps/demo/index.html` — added #config-demo-update-btn button (hidden, wired in main.ts)

## Napplet Count: 10 -> 11 (config-demo)

DEMO_NAPPLETS now has 11 entries. CLASS_BY_DTAG has 11 matching entries. Module-load assertion (D4/H-05) at shell-host.ts lines ~264-278 verifies all 11 are covered.

## Grep Self-Checks

```
grep -c "'config-demo'" apps/demo/src/shell-host.ts -> 3 (DEMO_NAPPLETS entry + CLASS_BY_DTAG + createConfigService comment)
grep -c "setDemoConfigValue" apps/demo/src/shell-host.ts -> 3 (decl + export + call)
grep -c "createConfigService" apps/demo/src/shell-host.ts -> 3 (import + comment + call)
grep -c "config-demo-update-btn" apps/demo/index.html -> 1
grep -q "__grantConnectOrigin__" apps/demo/src/main.ts -> FOUND
grep -q "__revokeConnect__" apps/demo/src/main.ts -> FOUND
grep -q "__publishConfigValues__" apps/demo/src/main.ts -> FOUND
grep -c "shell:connect-revoked" apps/demo/src/main.ts -> 4 (dispatch in __revokeConnect__ + listener)
grep -q "connect-consent-modal" apps/demo/src/consent-modal.ts -> FOUND (setAttribute)
grep -q "connect-consent-allow" apps/demo/src/consent-modal.ts -> FOUND (setAttribute)
grep -q "connect-consent-deny" apps/demo/src/consent-modal.ts -> FOUND (setAttribute)
grep -c "http-equiv" apps/demo/napplets/config-demo/index.html -> 0 (no meta-CSP in source)
grep -qi "http-equiv" apps/demo/napplets/config-demo/dist/index.html -> NO CSP in dist
```

## Build Output

```
pnpm build -> Tasks: 25 successful, 25 total (all 11 napplets built)
  @kehto/demo-config-demo: dist/index.html 1.59 kB; dist/assets/index-CelXhM7Q.js 20.12 kB
  @kehto/demo: dist/assets/main-xyF9J_0C.js 289.16 kB (includes consent-modal + test hooks)
```

## pnpm audit:csp Output

```
[audit:csp] OK -- scanned 11 napplet dist/index.html file(s), no meta-CSP found
```

## pnpm type-check Output

```
Tasks: 10 successful, 10 total (FULL TURBO)
```

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Decisions Made During Execution

**1. [Rule 2 - Critical scope clarification] consent-modal.ts uses setAttribute for data-testid**
- The plan's self-check grep used `data-testid="connect-consent-"` (inline HTML attribute syntax). The code correctly uses `el.setAttribute('data-testid', 'connect-consent-modal')` (proper DOM API). The attributes are present; the grep pattern in the plan was illustrative, not a test-file expectation. All 5 testid attributes confirmed via grep -n.

**2. [Scope] #config-demo-update-btn rendered as hidden element in index.html**
- topology.ts dynamically renders the iframe frame container from DEMO_NAPPLETS, so no explicit napplet card is needed in index.html. The update button is added as a hidden `display:none` wrapper (accessible to E2E via `#config-demo-update-btn`); it is wired and functional in main.ts.

## Anti-Features Enforced

- NO `config.set` anywhere in config-demo source (CONFIG-04 scope boundary)
- NO `<meta http-equiv="Content-Security-Policy">` in config-demo HTML (C-03)
- Consent dismiss/outside-click/timeout -> deny (resolve false), NEVER allow (M-04)
- No `window.nostr` usage in config-demo (NIP-5D discipline)

## Next-Plan Pointer

**Plan 39-05** writes the 4 E2E specs that exercise all of this end-to-end:
- `connect-consent.spec.ts` — exercises consent modal UI (modal renders, Allow/Deny flow, 60s timer)
- `connect-revocation.spec.ts` — exercises `__revokeConnect__` + iframe destroy+recreate + CSP update
- `nub-config.spec.ts` — exercises `__publishConfigValues__` -> config.subscribe push -> #config-demo-values sentinel
- `connect-csp-audit.spec.ts` (or similar) — exercises `__grantConnectOrigin__` + CSP header verification

Plan 39-05 also records the canonical iteration loop (67/0/0 target) and wires SHELL-CONNECT-POLICY.md.

## Self-Check: PASSED

- FOUND: `apps/demo/napplets/config-demo/package.json`
- FOUND: `apps/demo/napplets/config-demo/config-schema.json`
- FOUND: `apps/demo/src/consent-modal.ts`
- FOUND: commit `eb3c520` (Task 1)
- FOUND: commit `de3475f` (Task 2)
- FOUND: commit `93fa0f4` (Task 3)
