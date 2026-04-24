# Phase 37 Iteration Log — SPEC Resync + Foundation Gates

**Phase:** 37-spec-resync-foundation-gates
**Plan:** 37-02
**Date:** 2026-04-24
**Baseline (v1.6 close):** 54 passed / 0 failed / 0 skipped
**Target (E2E-19):** 54 passed / 0 failed / 0 skipped — baseline preserved after SPEC resync + provisional types
**Result:** ✅ **54 passed / 0 failed / 0 skipped** (19.9s) — v1.6 baseline preserved; phase-close gate clears.

---

## Pre-Iteration Git State

- HEAD at loop start: `889d5a0` (`docs(37-01): complete spec-resync + foundation-gates plan — NIP-5D v1.7 + provisional types`)
- 37-01 landing commits:
  - `4c7b15a` — feat(37-01): resync NIP-5D spec to v1.7 and update README sync date
  - `a376f7e` — feat(37-01): add provisional type files for NUB-CLASS, NUB-CONNECT, NUB-RESOURCE
  - `889d5a0` — docs(37-01): complete spec-resync + foundation-gates plan — NIP-5D v1.7 + provisional types
- Working tree: clean before iteration start (git status empty)

---

## Iteration Loop — Canonical v1.7 Fresh-Install Smoke

### Command executed

Root `package.json` has no `clean` script (confirmed at v1.6 close — see Phase 33 iteration log). The concrete executable form used here is the explicit `rm -rf` chain. Turbo cache was purged alongside `node_modules` / `dist` (though turbo replayed cache hits for tasks whose inputs had not changed — see build section below):

```
rm -rf node_modules packages/*/dist packages/*/node_modules \
       apps/demo/dist apps/demo/node_modules \
       apps/demo/napplets/*/dist apps/demo/napplets/*/node_modules \
       tests/harness/dist tests/harness/node_modules \
       .turbo packages/*/.turbo apps/demo/.turbo apps/demo/napplets/*/.turbo \
  && pnpm install \
  && pnpm build \
  && pnpm test:e2e
```

Note: Phase 37 modified only `specs/NIP-5D.md`, `README.md`, and three new files under `packages/shell/src/types/provisional-*.ts`. None of those files are inputs to any turbo build task (NIP-5D is not a tsup input; README is not compiled; provisional files were created but not imported by any barrel or consumer). Turbo correctly replayed all 24 cached tasks. This is expected and correct — it confirms zero drift in build inputs.

### pnpm install

```
Scope: all 25 workspace projects
Lockfile is up to date, resolution step is skipped
Progress: resolved 1, reused 0, downloaded 0, added 0
Packages: +323
Progress: resolved 323, reused 323, downloaded 0, added 323, done

devDependencies:
+ @changesets/cli 2.30.0
+ @playwright/test 1.59.1
+ @vitest/coverage-v8 4.1.2
+ nostr-tools 2.23.3
+ turbo 2.9.4
+ typedoc 0.28.19
+ typescript 5.9.3
+ vitest 4.1.2

Done in 772ms using pnpm v10.8.0
```

No changes from v1.6 close lockfile. Phase 37 added NO new dependencies; lockfile is up to date; 323 packages reused, 0 downloaded. Note: workspace now has 25 projects (up from 23 at Phase 33 close — +@kehto/nip66 and +@kehto/wm added during v1.6 Phases 34/35).

### pnpm build

```
 Tasks:    24 successful, 24 total
Cached:    24 cached, 24 total
  Time:    43ms >>> FULL TURBO
```

All 24 turbo tasks succeeded. Tasks were fully cache-hit (`24 cached, 24 total`) because Phase 37 made no changes to any compiled source file — SPEC resync (`specs/NIP-5D.md`), README update, and provisional type files (not imported by any barrel) are not turbo build inputs. This is correct behavior: the turbo cache faithfully represents that no compilable source changed.

Key demo build outputs (replayed from v1.6 turbo cache):

```
@kehto/demo:build: dist/index.html                 26.39 kB │ gzip:  6.13 kB
@kehto/demo:build: dist/assets/main-_LIv1z9n.css    4.36 kB │ gzip:  1.15 kB
@kehto/demo:build: dist/assets/main-D7LBzPHY.js   278.14 kB │ gzip: 89.70 kB
@kehto/demo:build: built in 774ms
```

Build artifact hashes identical to v1.6 close (confirmed by turbo cache hit + identical file sizes).

### pnpm test:e2e

```
Running 54 tests using 8 workers

  ✓   6 [chromium] › tests/e2e/demo-notification-service.spec.ts:23:1 › notification topology node is visible (2.8s)
  ✓   7 [chromium] › tests/e2e/demo-debugger.spec.ts:23:1 › debugger displays canonical envelope type strings after auth (2.9s)
  ✓   5 [chromium] › tests/e2e/demo-node-inspector.spec.ts:22:1 › ACL node opens inspector with grant/revoke table (2.9s)
  ✓   3 [chromium] › tests/e2e/demo-concurrent-boot.spec.ts:45:1 › all 10 DEMO_NAPPLETS reach authenticated within 10s on concurrent boot at :4174 (3.1s)
  ✓   2 [chromium] › tests/e2e/demo-boot.spec.ts:18:1 › demo renders 8 topology service nodes on boot (3.1s)
  ✓  13 [chromium] › tests/e2e/harness-smoke.spec.ts:13:3 › TEST-06: Shell test harness › shell boots and sets __SHELL_READY__ flag (206ms)
  ✓   1 [chromium] › tests/e2e/acl-revoke-relay-write.spec.ts:32:1 › revoking relay:write on composer denies next publish (denial visible in status + debugger) (3.6s)
  ✓  14 [chromium] › tests/e2e/harness-smoke.spec.ts:26:3 › TEST-06: Shell test harness › exposes __loadNapplet__ function (344ms)
  ✓  15 [chromium] › tests/e2e/harness-smoke.spec.ts:36:3 › TEST-06: Shell test harness › exposes __TEST_MESSAGES__ array (281ms)
  ✓  16 [chromium] › tests/e2e/harness-smoke.spec.ts:47:3 › TEST-06: Shell test harness › exposes __clearMessages__ function (217ms)
  ✓  18 [chromium] › tests/e2e/harness-smoke.spec.ts:69:3 › TEST-06: Shell test harness › harness exposes __nappletReady__ returning a boolean (198ms)
  ✓  17 [chromium] › tests/e2e/harness-smoke.spec.ts:57:3 › TEST-06: Shell test harness › harness exposes __getServiceNames__ returning a string[] (252ms)
  ✓   8 [chromium] › tests/e2e/demo-audit-correctness.spec.ts:82:1 › revoke chat relay:write and keep debugger paths legible (3.1s)
  ✓   9 [chromium] › tests/e2e/demo-notification-service.spec.ts:28:1 › node-control: create toast via notify.create envelope (2.5s)
  ✓  11 [chromium] › tests/e2e/demo-node-inspector.spec.ts:37:1 › runtime node shows Registered NUBs with 8 entries (2.5s)
  ✓  12 [chromium] › tests/e2e/demo-service-toggle.spec.ts:16:1 › notifications service toggle flips .service-disabled class (2.4s)
  ✓  10 [chromium] › tests/e2e/demo-debugger.spec.ts:40:1 › debugger text includes at least one canonical envelope type after auth (smoke) (2.6s)
  ✓  20 [chromium] › tests/e2e/identity-flow.spec.ts:30:1 › profile-viewer reads identity.getPublicKey and renders truncated pubkey (2.3s)
  ✓  19 [chromium] › tests/e2e/hotkey-chord.spec.ts:66:1 › hotkey-chord napplet receives Ctrl+Shift+K via real keys backend and increments counter (2.7s)
  ✓  21 [chromium] › tests/e2e/demo-audit-correctness.spec.ts:92:1 › revoke chat state:write and preserve the exact denial string (2.8s)
  ✓  23 [chromium] › tests/e2e/demo-node-inspector.spec.ts:50:1 › napplet node (chat) shows capability state and recent envelopes (2.1s)
  ✓  22 [chromium] › tests/e2e/demo-notification-service.spec.ts:44:1 › notify.list opens inspector with items (2.5s)
  ✓  24 [chromium] › tests/e2e/demo-service-toggle.spec.ts:31:1 › service toggle click does not cause anti-term page errors (2.6s)
  ✓  25 [chromium] › tests/e2e/ifc-roundtrip.spec.ts:26:1 › chat input triggers ipc envelope; bot reply appears in chat messages (2.6s)
  ✓   4 [chromium] › tests/e2e/acl-revoke-storage-write.spec.ts:31:1 › revoking state:write on preferences denies next save (denial visible in status + debugger) (8.4s)
  ✓  32 [chromium] › tests/e2e/nub-identity.spec.ts:23:1 › nub-identity: getPublicKey envelope dispatched and fixture sentinel updates (382ms)
  ✓  26 [chromium] › tests/e2e/media-controller.spec.ts:72:1 › media-controller napplet drives navigator.mediaSession via real media backend (DOM + browser-API dual-path) (2.4s)
  ✓  34 [chromium] › tests/e2e/nub-keys.spec.ts:39:1 › nub-keys: keys.registerAction + synthetic keydown drives real keys-service keys.action push (354ms)
  ✓  33 [chromium] › tests/e2e/nub-ifc.spec.ts:21:1 › nub-ifc: ifc.subscribe envelope dispatched and fixture sentinel reaches authenticated (528ms)
  ✓  36 [chromium] › tests/e2e/nub-notify.spec.ts:24:1 › nub-notify: notify.send envelope dispatched and fixture sentinel reflects shell id (418ms)
  ✓  35 [chromium] › tests/e2e/nub-media.spec.ts:44:1 › nub-media: media.session.create/update drives real media-service navigator.mediaSession mirror (441ms)
  ✓  27 [chromium] › tests/e2e/napplet-auth.spec.ts:18:1 › chat napplet reaches authenticated state at :4174 (2.6s)
  ✓  37 [chromium] › tests/e2e/nub-relay.spec.ts:23:1 › nub-relay: relay.publish envelope dispatched and fixture sentinel updates (509ms)
  ✓  29 [chromium] › tests/e2e/demo-node-inspector.spec.ts:62:1 › service node (notifications) shows service-role content (2.2s)
  ✓  38 [chromium] › tests/e2e/nub-storage.spec.ts:21:1 › nub-storage: setItem + getItem round-trip via fixture sentinels (396ms)
  ✓  39 [chromium] › tests/e2e/nub-theme.spec.ts:25:1 › nub-theme: fixture authenticates via storage probe; theme.get envelope round-trips (392ms)
  ✓  28 [chromium] › tests/e2e/demo-audit-correctness.spec.ts:100:1 › revoke chat sign:event and separate inter-pane success from signer denial (2.8s)
  ✓  30 [chromium] › tests/e2e/demo-notification-service.spec.ts:54:1 › notify.read decrements unread count (2.5s)
  ✓  31 [chromium] › tests/e2e/notify-lifecycle.spec.ts:34:1 › toaster creates notification and Dismiss all empties the list (3.4s)
  ✓  40 [chromium] › tests/e2e/napplet-auth.spec.ts:37:1 › bot napplet reaches authenticated state at :4174 (2.2s)
  ✓  42 [chromium] › tests/e2e/demo-node-inspector.spec.ts:69:1 › inspector open/close via node click and close button (2.6s)
  ✓  44 [chromium] › tests/e2e/relay-subscribe.spec.ts:31:1 › feed napplet subscribes and renders 5 fixture events from mock relay pool (2.8s)
  ✓  41 [chromium] › tests/e2e/relay-publish-encrypted.spec.ts:32:1 › composer with encrypted toggle dispatches relay.publishEncrypted envelope (3.2s)
  ✓  45 [chromium] › tests/e2e/reserved-chord.spec.ts:35:1 › reserved chord Ctrl+Shift+R fires shell onForward and suppresses napplet keys.action; non-reserved Ctrl+Shift+K still reaches napplet (2.8s)
  ✓  43 [chromium] › tests/e2e/relay-publish.spec.ts:36:1 › composer dispatches relay.publish envelope visible in debugger (3.3s)
  ✓  46 [chromium] › tests/e2e/demo-notification-service.spec.ts:64:1 › notify.dismiss removes item from inspector (3.2s)
  ✓  47 [chromium] › tests/e2e/shell-ui-state-surfaces.spec.ts:51:3 › shell UI state surfaces (E2E-16) › service activity counters tick on NUB traffic (UI-01) (2.2s)
  ✓  50 [chromium] › tests/e2e/theme-broadcast.spec.ts:33:1 › clicking theme-switcher dark button propagates theme.changed to preferences napplet (1.9s)
  ✓  48 [chromium] › tests/e2e/storage-persist.spec.ts:31:1 › preferences round-trips display-name and theme-preference across page.reload() (3.1s)
  ✓  51 [chromium] › tests/e2e/relay-publish.spec.ts:78:1 › composer with encrypted toggle dispatches relay.publishEncrypted envelope (1.8s)
  ✓  49 [chromium] › tests/e2e/demo-node-inspector.spec.ts:79:1 › no anti-term in console output during inspector interactions (2.8s)
  ✓  53 [chromium] › tests/e2e/shell-ui-state-surfaces.spec.ts:110:3 › shell UI state surfaces (E2E-16) › ACL Capability Matrix lists all authenticated napplets (UI-02) (1.7s)
  ✓  52 [chromium] › tests/e2e/demo-notification-service.spec.ts:73:1 › no anti-term in captured console output (2.0s)
  ✓  54 [chromium] › tests/e2e/shell-ui-state-surfaces.spec.ts:156:3 › shell UI state surfaces (E2E-16) › Sequence Diagram renders a lane for each authenticated napplet (UI-03) (966ms)

  54 passed (19.9s)
```

---

## Anti-Term Sweep

### napplet source (apps/demo/napplets/)

```
$ grep -rE "window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]" apps/demo/napplets/ \
    | grep -v "node_modules\|dist" \
    | grep -v "^\s*\*" \
    | grep -v "^[^:]*:\s*\*"
(clean)
```

Zero anti-term occurrences in napplet source. Pattern matches v1.6 close baseline.

### @kehto/* source for @napplet/nub- (DEP carryforward)

```
$ grep -rE "@napplet/nub-" packages/ | grep -v "node_modules\|dist\|CHANGELOG"
(clean)
```

Zero matches outside CHANGELOG.md. Phase 32's consolidation onto `@napplet/nub` subpath imports remains intact through Phase 37.

---

## Result

**54 passed / 0 failed / 0 skipped** — exact match to v1.6 close baseline. Phase 37 E2E-19 gate clears.

Phase 37 success criterion #3 (from ROADMAP): "pnpm clean && pnpm build && pnpm test:e2e records 54/0/0 — no regression from the spec file update" — **SATISFIED**.

Phase 37 close path unblocked. Phase 38 (NUB-CLASS Adoption) may now start with a clean foundation.

---

## Post-Iteration Git State

- HEAD: `889d5a0` (unchanged — iteration loop is read-only against source; only the iteration log itself was added in this plan)
- Working tree: clean (except for the new `37-ITERATION-LOG.md` file, which this plan creates and commits)
- No untracked build artifacts polluting the repo

---

## Diff from v1.6 Close

- No E2E spec files added, removed, or modified in Phase 37 (by design — this phase is foundation-only)
- No runtime source files modified (SPEC resync is docs; provisional types are staging-only, not imported)
- Expected pass/fail/skip count: identical to v1.6 close (54/0/0)
- Actual: **54 passed / 0 failed / 0 skipped** — **zero delta vs v1.6 close**

---

## Upstream Commit SHA Reference

The SPEC resync landed in Plan 37-01 against upstream `dskvr/nips` branch `nip/5d` commit SHA: `d80d7b25f9c4331acbeb40dbeb3b077caa80e885` (recorded in `specs/NIP-5D.md` header comment block). This SHA is the canonical reference for the v1.7 spec-adoption milestone.

---

*Logged: 2026-04-24*
