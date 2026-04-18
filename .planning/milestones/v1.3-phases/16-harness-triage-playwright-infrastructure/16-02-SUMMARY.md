---
phase: 16-harness-triage-playwright-infrastructure
plan: "02"
subsystem: testing
tags: [playwright, turbo, e2e, infrastructure, pnpm]

requires:
  - phase: 16-01
    provides: harness app and test fixtures in place for E2E

provides:
  - "@playwright/test ^1.54.0 (resolves to 1.59.1) enabling page.consoleMessages() / pageErrors()"
  - "Array-form webServer in playwright.config.ts — harness :4173 + demo :4174 in single pnpm test:e2e"
  - "build:napplets turbo pipeline task with @kehto/demo#build override"
  - "test:serve:demo npm script"

affects:
  - phase-17-demo-app-rewire
  - phase-21-fixture-napplets

tech-stack:
  added:
    - "@playwright/test ^1.54.0 (was ^1.52.0, resolved to 1.59.1)"
  patterns:
    - "Array-form webServer for multi-server Playwright setups"
    - "preview over dev for E2E servers (avoids aggregateHash='' pitfall)"
    - "Workspace-scoped turbo task override (@kehto/demo#build) for targeted dependency chains"

key-files:
  created: []
  modified:
    - package.json
    - playwright.config.ts
    - turbo.json
    - pnpm-lock.yaml

key-decisions:
  - "Use preview (not dev) for both webServer commands — dev mode emits aggregateHash='' via @napplet/vite-plugin which poisons ACL state"
  - "test:serve remains pointing at @test/harness dev for backward compat with manual harness-development workflow"
  - "build:napplets defined as a root turbo task (not workspace-scoped); individual napplet packages inherit via existing build task"

patterns-established:
  - "Array webServer pattern: each preview server in its own entry with explicit port and reuseExistingServer"
  - "Workspace-scoped turbo task override: use @scope/name#task notation for package-specific dependency chains"

requirements-completed:
  - E2E-02
  - E2E-03

duration: 2min
completed: "2026-04-17"
---

# Phase 16 Plan 02: Playwright Infrastructure & Build Pipeline Summary

**@playwright/test bumped to ^1.54.0 (resolved 1.59.1), playwright.config.ts migrated to array-form webServer with harness :4173 + demo :4174, and turbo build:napplets pipeline task wired into @kehto/demo#build**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-17T23:08:42Z
- **Completed:** 2026-04-17T23:10:18Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Bumped `@playwright/test` from `^1.52.0` to `^1.54.0` (resolves to 1.59.1 — unlocks `page.consoleMessages()` / `pageErrors()` APIs for Phase 17+)
- Migrated `playwright.config.ts` from single-object `webServer` to two-entry array, switching both servers from `dev` to `preview` to prevent `aggregateHash=""` ACL poisoning
- Added `build:napplets` turbo task and `@kehto/demo#build` workspace override ensuring napplet dists exist before preview-serving

## Task Commits

Each task was committed atomically:

1. **Task 1: Bump @playwright/test to ^1.54.0 and add test:serve:demo script** - `d2beec6` (chore)
2. **Task 2: Rewrite playwright.config.ts to use array-form webServer** - `6de79ca` (feat)
3. **Task 3: Add build:napplets turbo task and wire @kehto/demo#build** - `78b1ba4` (feat)

## Before / After Snapshots

### package.json devDependencies + scripts

**Before:**
```json
"devDependencies": {
  "@playwright/test": "^1.52.0",
  ...
},
"scripts": {
  "test:serve": "pnpm --filter @test/harness dev",
  ...
}
```

**After:**
```json
"devDependencies": {
  "@playwright/test": "^1.54.0",
  ...
},
"scripts": {
  "test:serve": "pnpm --filter @test/harness dev",
  "test:serve:demo": "pnpm --filter @kehto/demo preview --port 4174",
  ...
}
```

### playwright.config.ts webServer field

**Before:**
```typescript
webServer: {
  command: 'pnpm test:serve',
  url: 'http://localhost:4173',
  reuseExistingServer: !process.env.CI,
  timeout: 60000,
},
```

**After:**
```typescript
webServer: [
  {
    command: 'pnpm --filter @test/harness preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
  {
    command: 'pnpm --filter @kehto/demo preview --port 4174',
    url: 'http://localhost:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
],
```

### turbo.json tasks block

**Before:**
```json
"tasks": {
  "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
  "test": { "dependsOn": ["build"] },
  "test:unit": { "dependsOn": ["build"], "outputs": ["coverage/**"] },
  "test:e2e": { "dependsOn": ["build"], "cache": false },
  "type-check": { "dependsOn": ["^build"] },
  "lint": {}
}
```

**After:**
```json
"tasks": {
  "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
  "build:napplets": { "dependsOn": ["^build"], "outputs": ["apps/demo/napplets/*/dist/**"] },
  "@kehto/demo#build": { "dependsOn": ["^build", "build:napplets"], "outputs": ["dist/**"] },
  "test": { "dependsOn": ["build"] },
  "test:unit": { "dependsOn": ["build"], "outputs": ["coverage/**"] },
  "test:e2e": { "dependsOn": ["build"], "cache": false },
  "type-check": { "dependsOn": ["^build"] },
  "lint": {}
}
```

## Verification Output

**Playwright version:**
```
Version 1.59.1
```

**turbo run build:napplets --dry-run (truncated):**
```
• Running build:napplets in 11 packages
Packages in Scope: @kehto/acl, @kehto/demo, @kehto/demo-bot, @kehto/demo-chat,
  @kehto/runtime, @kehto/services, @kehto/shell, @test/auth-napplet,
  @test/harness, @test/publish-napplet, @test/pure-napplet
```

**type-check:** 8 successful, 8 total (FULL TURBO cache hit)

## Files Created/Modified

- `/home/sandwich/Develop/kehto/package.json` — Playwright bumped to ^1.54.0, test:serve:demo script added
- `/home/sandwich/Develop/kehto/playwright.config.ts` — Array-form webServer with 2 entries
- `/home/sandwich/Develop/kehto/turbo.json` — build:napplets task + @kehto/demo#build override
- `/home/sandwich/Develop/kehto/pnpm-lock.yaml` — Regenerated (Playwright bump only)

## Decisions Made

- **preview over dev for webServer commands** — `@napplet/vite-plugin` emits `aggregateHash=""` in dev mode which poisons ACL key state; preview mode uses the production build where hash is stable
- **test:serve kept unchanged** — Points at `@test/harness dev` for backward compat with manual harness-development workflows; Playwright config invokes preview directly via the webServer `command` field
- **build:napplets as root task** — No individual napplet package needs to define a `build:napplets` script yet; turbo's existing `build` task already covers each napplet's `dist/**`

## Deviations from Plan

None - plan executed exactly as written.

## Known Caveats

- Demo preview (`:4174`) will return 404 for napplet assets until `apps/demo` is built (`pnpm test:build`). This is expected — Phase 17 will wire the full build→run→Playwright loop. The port is reachable when preview is running; only napplet asset paths 404 until `apps/demo/napplets/*/dist/` exists.
- The three deleted spec files (`acl-matrix-hotkey.spec.ts`, `inter-pane.spec.ts`, `state-isolation.spec.ts`) were already staged for deletion before this plan — they were swept into the Task 1 commit as pre-existing deletions.

## Next Phase Readiness

- Phase 17 (Demo App Rewire) can now `pnpm test:e2e` and hit both harness (:4173) and demo (:4174) in a single invocation
- `page.consoleMessages()` / `pageErrors()` Playwright APIs available for Phase 17+ specs
- `pnpm turbo run build:napplets` pipeline exists for explicit napplet builds when needed

## Self-Check: PASSED

- package.json: FOUND
- playwright.config.ts: FOUND
- turbo.json: FOUND
- 16-02-SUMMARY.md: FOUND
- Commit d2beec6: FOUND (Task 1 — @playwright/test bump)
- Commit 6de79ca: FOUND (Task 2 — array webServer)
- Commit 78b1ba4: FOUND (Task 3 — build:napplets)

---
*Phase: 16-harness-triage-playwright-infrastructure*
*Completed: 2026-04-17*
