# Phase 21 Iteration Log — Fixture Napplets & Layer-A Specs

**Phase:** 21-fixture-napplets-layer-a-specs
**Requirement:** E2E-09 (Layer-A fixture napplets + nub-* specs)
**Cross-cutting gate:** E2E-11 (build -> run -> Playwright -> fix loop)
**Started:** 2026-04-18T11:07:48Z
**Closed:** 2026-04-18T11:14:30Z

## Pre-flight Checks

- [x] `pnpm install` clean — no errors, 21 workspace projects (6 fixture-nub-* packages discovered)
- [x] `pnpm ls @napplet/core --depth 3` shows single deduplicated `link:` instance across all @kehto/* packages
- [x] `pnpm build` succeeds — all 20 tasks successful, 20 cached (FULL TURBO, 48ms)
- [x] `pnpm type-check` clean — 8 tasks successful, 8 cached (FULL TURBO, 48ms)
- [x] All 6 fixture dist directories present: nub-identity, nub-ifc, nub-notify, nub-relay, nub-storage, nub-theme

### Pre-flight command outputs

```
$ pnpm install --prefer-offline | tail -5
Scope: all 21 workspace projects
Lockfile is up to date, resolution step is skipped
Already up to date
Done in 684ms using pnpm v10.8.0
```

```
$ pnpm list --filter '*' '@napplet/core'
@kehto/acl@0.1.0 /home/sandwich/Develop/kehto/packages/acl
  dependencies: @napplet/core link:../../../napplet/packages/core
@kehto/runtime@0.1.0 /home/sandwich/Develop/kehto/packages/runtime
  dependencies: @napplet/core link:../../../napplet/packages/core
@kehto/services@0.1.0 /home/sandwich/Develop/kehto/packages/services
  dependencies: @napplet/core link:../../../napplet/packages/core
@kehto/shell@0.1.0 /home/sandwich/Develop/kehto/packages/shell
  dependencies: @napplet/core link:../../../napplet/packages/core
```

Single deduplicated `link:` instance — Pitfall 3 clear.

```
$ pnpm build | tail -5
Tasks:    20 successful, 20 total
Cached:    20 cached, 20 total
  Time:    48ms >>> FULL TURBO
```

```
$ pnpm type-check | tail -5
Tasks:    8 successful, 8 total
Cached:    8 cached, 8 total
  Time:    48ms >>> FULL TURBO
```

## Iteration 1

**Command:** `pnpm test:e2e`
**Result:** 47 passed / 0 failed / 68 skipped
**Duration:** 26.5s

All 47 active tests passed on the first run. No failures. The 68 skipped tests are all from legacy `test.describe.skip(...)` blocks across 7 spec files — by design, citing Phase 21 (E2E-09). No new skips were introduced.

### Test output (passing tests):

```
  ✓  [chromium] tests/e2e/demo-boot.spec.ts › demo renders 8 topology service nodes on boot (3.8s)
  ✓  [chromium] tests/e2e/demo-node-inspector.spec.ts › ACL node opens inspector with grant/revoke table (4.7s)
  ✓  [chromium] tests/e2e/demo-debugger.spec.ts › debugger displays canonical envelope type strings after auth (4.7s)
  ✓  [chromium] tests/e2e/demo-service-toggle.spec.ts › notifications service toggle flips .service-disabled class (4.6s)
  ✓  [chromium] tests/e2e/demo-notification-service.spec.ts › notification topology node is visible (4.5s)
  ✓  [chromium] tests/e2e/harness-smoke.spec.ts › TEST-06: Shell test harness › shell boots and sets __SHELL_READY__ flag (541ms)
  ✓  [chromium] tests/e2e/harness-smoke.spec.ts › TEST-06: Shell test harness › exposes __loadNapplet__ function (435ms)
  ✓  [chromium] tests/e2e/harness-smoke.spec.ts › TEST-06: Shell test harness › exposes __TEST_MESSAGES__ array (498ms)
  ✓  [chromium] tests/e2e/harness-smoke.spec.ts › TEST-06: Shell test harness › exposes __clearMessages__ function (536ms)
  ✓  [chromium] tests/e2e/harness-smoke.spec.ts › TEST-06: Shell test harness › harness exposes __getServiceNames__ returning a string[] (514ms)
  ✓  [chromium] tests/e2e/harness-smoke.spec.ts › TEST-06: Shell test harness › harness exposes __nappletReady__ returning a boolean (511ms)
  ✓  [chromium] tests/e2e/acl-revoke-relay-write.spec.ts › revoking relay:write on composer denies next publish (5.1s)
  ✓  [chromium] tests/e2e/acl-revoke-storage-write.spec.ts › revoking state:write on preferences denies next save (10.6s)
  ✓  [chromium] tests/e2e/demo-audit-correctness.spec.ts › revoke chat relay:write and keep debugger paths legible (5.4s)
  ✓  [chromium] tests/e2e/identity-flow.spec.ts › profile-viewer reads identity.getPublicKey and renders truncated pubkey (4.2s)
  ✓  [chromium] tests/e2e/ifc-roundtrip.spec.ts › chat input triggers ipc envelope; bot reply appears in chat messages (4.1s)
  ✓  [chromium] tests/e2e/napplet-auth.spec.ts › chat napplet reaches authenticated state at :4174 (3.7s)
  ✓  [chromium] tests/e2e/napplet-auth.spec.ts › bot napplet reaches authenticated state at :4174 (3.6s)
  ✓  [chromium] tests/e2e/notify-lifecycle.spec.ts › toaster creates notification and Dismiss all empties the list (4.4s)
  ✓  [chromium] tests/e2e/nub-identity.spec.ts › nub-identity: getPublicKey envelope dispatched and fixture sentinel updates (858ms)
  ✓  [chromium] tests/e2e/nub-ifc.spec.ts › nub-ifc: ifc.subscribe envelope dispatched and fixture sentinel reaches authenticated (884ms)
  ✓  [chromium] tests/e2e/nub-keys.spec.ts › nub-keys: keys.registerAction envelope dispatchable + runtime stub response captured (842ms)
  ✓  [chromium] tests/e2e/nub-media.spec.ts › nub-media: media.session.create envelope dispatchable + runtime stub response captured (835ms)
  ✓  [chromium] tests/e2e/nub-notify.spec.ts › nub-notify: notify.send envelope dispatched and fixture sentinel reflects shell id (830ms)
  ✓  [chromium] tests/e2e/nub-relay.spec.ts › nub-relay: relay.publish envelope dispatched and fixture sentinel updates (756ms)
  ✓  [chromium] tests/e2e/nub-storage.spec.ts › nub-storage: setItem + getItem round-trip via fixture sentinels (727ms)
  ✓  [chromium] tests/e2e/nub-theme.spec.ts › nub-theme: fixture authenticates via storage probe; theme.get envelope round-trips (1.0s)
  ✓  [chromium] tests/e2e/relay-publish-encrypted.spec.ts › composer with encrypted toggle dispatches relay.publishEncrypted envelope (4.7s)
  ✓  [chromium] tests/e2e/relay-publish.spec.ts › composer dispatches relay.publish envelope visible in debugger (4.4s)
  ✓  [chromium] tests/e2e/relay-publish.spec.ts › composer with encrypted toggle dispatches relay.publishEncrypted envelope (2.6s)
  ✓  [chromium] tests/e2e/relay-subscribe.spec.ts › feed napplet subscribes and renders 5 fixture events from mock relay pool (4.4s)
  ✓  [chromium] tests/e2e/storage-persist.spec.ts › preferences round-trips display-name and theme-preference across page.reload() (5.9s)
  ✓  [chromium] tests/e2e/theme-broadcast.spec.ts › clicking theme-switcher dark button propagates theme.changed to preferences napplet (3.6s)
  (plus additional demo-node-inspector, demo-notification-service, demo-service-toggle, demo-debugger, demo-audit-correctness tests)
```

All 47 passed. 0 failures. No fixes needed.

### Skipped tests (legacy describe.skip — by design):

The 68 skipped tests are distributed across 7 spec files that retain `test.describe.skip(...)` markers:
- `acl-enforcement.spec.ts` — 9 tests (ACL-01 through ACL-09)
- `acl-lifecycle.spec.ts` — 14 tests (TST-04 through TST-06)
- `acl-matrix-relay.spec.ts` — 9 tests (relay:write/read matrix)
- `acl-matrix-state.spec.ts` — 14 tests (state:read/write matrix)
- `lifecycle.spec.ts` — 5 tests (LCY-01 through LCY-05)
- `replay.spec.ts` — 5 tests (RPL-01 through RPL-05)
- `routing.spec.ts` — 9 tests (MSG-01 through MSG-09)

These carry `test.describe.skip(...)` markers citing Phase 21 (E2E-09). Their removal is v1.4 scope (Phase 21 plan explicitly defers these).

## Final Status

**Command:** `pnpm test:e2e`
**Result:** 47 passed / 0 failed / 68 skipped (skipped = legacy describe.skip from pre-Phase-21)
**Duration:** 26.5s

**E2E-09 (Layer-A) GREEN — Phase 21 iteration loop complete.**

### Coverage Summary

- Layer-A nub-* (NEW): 8 specs green
  - nub-identity.spec.ts: identity.getPublicKey dispatch + sentinel (858ms)
  - nub-ifc.spec.ts: ifc.subscribe dispatch + authenticated sentinel + ifc.emit on click (884ms)
  - nub-notify.spec.ts: notify.send dispatch + shell notification id sentinel (830ms)
  - nub-relay.spec.ts: relay.publish dispatch + sentinel + publishEncrypted dispatch (756ms)
  - nub-storage.spec.ts: storage.setItem + getItem round-trip via sentinels (727ms)
  - nub-theme.spec.ts: storage AUTH probe + theme.get envelope round-trip (1.0s)
  - nub-keys.spec.ts: keys.registerAction dispatch + stub service capture (842ms) [STUB-SCOPE]
  - nub-media.spec.ts: media.session.create dispatch + stub service capture (835ms) [STUB-SCOPE]
- Layer-A harness-smoke: 6 tests green (TEST-06 suite)
- Layer-B Phase 17 (DEMO-*): 14 tests green (boot, node-inspector, debugger, service-toggle, notification-service, audit-correctness)
- Layer-B Phase 18 (NAP-01/02): 3 tests green (napplet-auth x2, ifc-roundtrip)
- Layer-B Phase 19 (NAP-03/04/05): 6 tests green (relay-publish x2, relay-publish-encrypted, storage-persist, notify-lifecycle, acl-revoke-relay-write, acl-revoke-storage-write)
- Layer-B Phase 20 (NAP-06/07/08): 3 tests green (relay-subscribe, identity-flow, theme-broadcast)
- Skipped (legacy describe.skip — by design): 68 tests across 7 spec files

### Anti-term Hygiene

- Fixture src files (`tests/fixtures/napplets/nub-*/src/`): 0 occurrences of banned terms (verified)
  - `addEventListener('message')`: 0
  - `window.nostr|signer-service|BusKind|kind === 2900[12]|core-compat`: 0
- New nub-*.spec.ts files: 0 occurrences (excluding spec files' own ANTI_TERM_RE constant references)

### NAP-09 Regression Check

Ran Phase 20 Layer-B specs in isolation to confirm 8-domain showcase intact:
```
$ pnpm test:e2e tests/e2e/relay-subscribe.spec.ts tests/e2e/identity-flow.spec.ts tests/e2e/theme-broadcast.spec.ts
Running 3 tests using 3 workers
  ✓  identity-flow.spec.ts:30:1 - profile-viewer reads identity.getPublicKey (1.7s)
  ✓  relay-subscribe.spec.ts:31:1 - feed napplet subscribes and renders 5 fixture events (1.8s)
  ✓  theme-broadcast.spec.ts:33:1 - clicking theme-switcher dark button propagates theme.changed (1.9s)
  3 passed (5.3s)
```

- Demo's 8 service topology nodes: still rendering (demo-boot.spec.ts green)
- composer/preferences/toaster/feed/profile-viewer/theme-switcher: still functional in Layer-B specs
- No regressions from Phase 21 fixture napplet additions
