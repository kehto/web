---
phase: 19-core-domain-napplets
plan: "02"
subsystem: demo-napplets
tags: [napplet, storage, sdk, preferences, NAP-04]
dependency_graph:
  requires: []
  provides: [preferences-napplet, storage-nub-exerciser]
  affects: [19-04-demo-registration, 19-05-storage-persist-spec, 19-06-acl-revoke-storage-write-spec]
tech_stack:
  added: ["@kehto/demo-preferences workspace package"]
  patterns: [D-04-init-pattern, storage-getItem-setItem, shim-auth-implicit]
key_files:
  created:
    - apps/demo/napplets/preferences/package.json
    - apps/demo/napplets/preferences/tsconfig.json
    - apps/demo/napplets/preferences/vite.config.ts
    - apps/demo/napplets/preferences/index.html
    - apps/demo/napplets/preferences/src/main.ts
  modified: []
decisions:
  - "Sequential storage.getItem calls (not Promise.all) for denial localization — matches bot/src/main.ts pattern"
  - "null sentinel from storage.getItem treated as 'use placeholder value' — never writes 'null' literal to input"
  - "Status sentinel 'connecting...' in HTML, transitions to 'loaded' (green) / 'saved' (green) / 'denied: <reason>' (red) from main.ts"
metrics:
  duration: "2min"
  completed_date: "2026-04-18"
  tasks_completed: 2
  files_created: 5
  files_modified: 0
---

# Phase 19 Plan 02: Preferences Napplet Summary

**One-liner:** Preferences napplet (`@kehto/demo-preferences`) exercising storage NUB end-to-end via `storage.setItem` + `storage.getItem` with D-04 init pattern and deterministic DOM contract for Plan 19-05/06 specs.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Scaffold @kehto/demo-preferences workspace skeleton | `3a06ab5` | package.json, tsconfig.json, vite.config.ts, index.html |
| 2 | Implement preferences src/main.ts using @napplet/sdk storage | `00f7fc9` | src/main.ts |

## What Was Built

**5 files** under `apps/demo/napplets/preferences/` constituting a buildable workspace package `@kehto/demo-preferences`:

- `package.json` — `@kehto/demo-preferences` with `@napplet/shim` + `@napplet/sdk` link deps, `@napplet/vite-plugin` devDep, identical script shape to bot/chat
- `tsconfig.json` — verbatim copy of bot's (ES2022/ESNext/bundler, strict true)
- `vite.config.ts` — `nip5aManifest({ nappletType: 'demo-preferences' })`, `build.outDir: 'dist'`
- `index.html` — monospace dark theme, 5 DOM contract IDs, `<meta name="napplet-napp-type" content="demo-preferences" />`
- `src/main.ts` — 103 lines, D-04 init pattern, storage.getItem/setItem, status sentinel transitions

## DOM Contract (CONTEXT D-03)

| ID | Element | Role |
|----|---------|------|
| `#preferences-status` | `<span>` | Status sentinel — `'connecting...'` → `'loaded'` → `'saved'` / `'denied: <reason>'` |
| `#pref-display-name` | `<input type="text">` | Display name field — populated from storage on mount |
| `#pref-theme-preference` | `<input type="text">` | Theme field — populated from storage on mount |
| `#preferences-save-btn` | `<button>` | Save trigger — fires storage.setItem × 2 on click |
| `#preferences-log` | `<div>` | Diagnostic log — timestamped entries for load/save events |

## Storage Keys

| Key | Usage |
|-----|-------|
| `'display-name'` | storage.getItem on mount, storage.setItem on save |
| `'theme-preference'` | storage.getItem on mount, storage.setItem on save |

Both keys will be asserted to survive page.reload() in Plan 19-05 (storage-persist spec).

## Build Outcome

- `pnpm --filter @kehto/demo-preferences build` exits 0 in 121ms
- `dist/index.html` contains `napplet-aggregate-hash` meta tag (as injected by @napplet/vite-plugin)
- `VITE_DEV_PRIVKEY_HEX` not set → aggregate-hash is empty string (consistent with Phase 18-04 decision — ACL keys on dTag:'' consistently)

## Anti-Term Grep Result

```
grep -rE "addEventListener\(['\"]message|new BusKind|window\.nostr" apps/demo/napplets/preferences/src/
(no output — zero matches)
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all storage calls are wired to real @napplet/sdk storage namespace. No hardcoded values flow to UI rendering.

## What This Enables

- **Plan 19-04** — Can register `@kehto/demo-preferences` in `DEMO_NAPPLETS[]` without further changes to the napplet package
- **Plan 19-05** — `storage-persist.spec.ts` can assert `page.reload()` round-trip using `#pref-display-name` + `#pref-theme-preference` values and `'display-name'` / `'theme-preference'` storage keys
- **Plan 19-06** — `acl-revoke-storage-write.spec.ts` can revoke `state:write`, click save, and assert `#preferences-status` contains `'denied:'`

## Self-Check: PASSED

All files verified to exist:
- `apps/demo/napplets/preferences/package.json` — FOUND
- `apps/demo/napplets/preferences/tsconfig.json` — FOUND
- `apps/demo/napplets/preferences/vite.config.ts` — FOUND
- `apps/demo/napplets/preferences/index.html` — FOUND
- `apps/demo/napplets/preferences/src/main.ts` — FOUND

Commits verified:
- `3a06ab5` — FOUND
- `00f7fc9` — FOUND
