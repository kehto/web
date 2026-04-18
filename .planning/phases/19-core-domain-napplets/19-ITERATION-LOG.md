# Phase 19 — Core-Domain Napplets — Iteration Log

This log captures the build → preview → Playwright → fix cycles per E2E-11.
Each iteration appends below.

===

## Iteration 1 — 2026-04-18T03:00:00Z

### Build

- pnpm ls @napplet/core: **single linked instance** — all @napplet/core symlinks resolve to `/home/sandwich/Develop/napplet/packages/core` (Pitfall 4 confirmed clear)
- pnpm build (turbo): **PASS** — 14 tasks, all cached (34ms turbo full-cache hit); fresh napplet builds completed in under 2s each when triggered
- napplet aggregate hashes (5 napplets): consistently empty (VITE_DEV_PRIVKEY_HEX unset — Phase 18 decision; all 5 uniformly empty = OK)
  - bot dist/index.html: `""` (empty — expected)
  - chat dist/index.html: `""` (empty — expected)
  - composer dist/index.html: `""` (empty — expected)
  - preferences dist/index.html: `""` (empty — expected)
  - toaster dist/index.html: `""` (empty — expected)

### Spec Results (full v1.3 Layer-B suite — 13 spec files)

Run 1 result (27 tests, 8 workers, port 4174):

| # | Spec | Outcome | Notes |
|---|------|---------|-------|
| 1 | demo-boot | FAIL | Initial run — composer dist served wrong bundle (pre-fix) |
| 2 | demo-node-inspector | PASS | (Phase 17) |
| 3 | demo-debugger | PASS | (Phase 17) |
| 4 | demo-service-toggle | PASS | (Phase 17) |
| 5 | demo-notification-service | PASS | (Phase 17) |
| 6 | napplet-auth | PASS | (Phase 18 — chat + bot AUTH) |
| 7 | ifc-roundtrip | PASS | (Phase 18) |
| 8 | relay-publish | PASS | (Phase 19 NAP-03) |
| 9 | relay-publish-encrypted | PASS | (Phase 19 NAP-03) |
| 10 | storage-persist | PASS | (Phase 19 NAP-04) |
| 11 | notify-lifecycle | PASS | (Phase 19 NAP-05) |
| 12 | acl-revoke-relay-write | FAIL | composer #composer-status showed `"published: unknown"` instead of `"denied:"` |
| 13 | acl-revoke-storage-write | PASS | (Phase 19 E2E-08) |

**Initial result: 25 passed, 2 failed**

### Root Cause Analysis (Iteration 1 failures)

**acl-revoke-relay-write failure:**

Root cause: `@napplet/nub-relay` shim `publish()` function (compiled dist at
`/home/sandwich/Develop/napplet/packages/nubs/relay/dist/index.js`) only handled
`relay.publish.result` message type. When ACL gate denied `relay:write`, the runtime
sent a `relay.publish.error` envelope. The napplet's `publish()` Promise had no
listener for that type and hung indefinitely.

Compounding issue: After applying the fix to `nub-relay/dist/index.js` and rebuilding
the composer napplet, the Vite content-hash produced a NEW file
(`index-CIPzb-cY.js`) but `index.html` was briefly pointing to the old
`index-CrP-G50i.js` (pre-fix). A clean `rm -rf dist/ && pnpm build` resolved the
stale-dist artifact.

**demo-boot was a false flake** — the Playwright `reuseExistingServer` caused a
brief period where the old demo bundle was cached. After clean rebuild + server
restart, demo-boot passed.

### Fixes Applied (Iteration 1)

**Fix 1 — nub-relay publish() error handler:**

Modified `/home/sandwich/Develop/napplet/packages/nubs/relay/src/shim.ts` and
`dist/index.js` — the `publish()` Promise listener now handles BOTH
`relay.publish.result` AND `relay.publish.error`:

```javascript
// BEFORE (only result):
if (msg.type !== 'relay.publish.result') return;
...reject if result.error...

// AFTER (both types):
if (msg.type !== 'relay.publish.result' && msg.type !== 'relay.publish.error') return;
...reject if result.error OR msg.type === 'relay.publish.error'...
```

Source also updated: `/home/sandwich/Develop/napplet/packages/nubs/relay/src/shim.ts`

**Fix 2 — clean composer napplet dist rebuild:**

```bash
rm -rf apps/demo/napplets/composer/dist/
pnpm --filter @kehto/demo-composer build
pnpm --filter @kehto/demo build
fuser -k 4174/tcp  # restart preview server
```

Result: single clean bundle `index-CIPzb-cY.js` with the relay.publish.error fix;
`index.html` references it correctly.

===

## Iteration 2 — 2026-04-18T03:35:37Z

### Build

- pnpm ls @napplet/core: **single linked instance** (confirmed, same as Iter 1)
- pnpm build (turbo): **PASS** — 14 tasks, 14 cached (34ms), FULL TURBO
- napplet aggregate hashes: consistently empty across all 5 napplets (expected)

### Spec Results (full v1.3 Layer-B suite — 13 spec files, 27 tests)

Run 1 of 2 (27/27 passed, 11.4s):

| # | Spec | Outcome | Notes |
|---|------|---------|-------|
| 1 | demo-boot | PASS | (Phase 17) |
| 2 | demo-node-inspector | PASS | (Phase 17) |
| 3 | demo-debugger | PASS | (Phase 17) |
| 4 | demo-service-toggle | PASS | (Phase 17) |
| 5 | demo-notification-service | PASS | (Phase 17) |
| 6 | napplet-auth | PASS | (Phase 18 — chat + bot AUTH) |
| 7 | ifc-roundtrip | PASS | (Phase 18) |
| 8 | relay-publish | PASS | (Phase 19 NAP-03) |
| 9 | relay-publish-encrypted | PASS | (Phase 19 NAP-03) |
| 10 | storage-persist | PASS | (Phase 19 NAP-04) |
| 11 | notify-lifecycle | PASS | (Phase 19 NAP-05) |
| 12 | acl-revoke-relay-write | PASS | Fix confirmed: `denied:` prefix appears in #composer-status; debugger shows relay.publish.error |
| 13 | acl-revoke-storage-write | PASS | (Phase 19 E2E-08) |

**Run 2 of 2 (stability check) — 27/27 passed, 11.3s**

Result confirmed stable across two consecutive runs.

### Anti-term grep

**Composer + preferences (zero live-code matches expected):**
```bash
grep -rE "addEventListener\(['\"]message|BusKind|kind === 2900[12]|window\.nostr|signer-service|\['REGISTER'|\['EVENT'|\['OK'|\['CLOSED'|\['NOTICE'|pendingAcks" \
  apps/demo/napplets/composer/src apps/demo/napplets/preferences/src \
  | grep -v "^[[:space:]]*[\*\/]"
```
Result: **zero matches** — CLEAN

**Toaster (exactly ONE window.addEventListener('message'); zero of the rest):**
```bash
TOASTER_LISTENER_COUNT=$(grep -c "window.addEventListener('message'" apps/demo/napplets/toaster/src/main.ts)
echo "Toaster listener count: $TOASTER_LISTENER_COUNT (expect: 1)"
# → Toaster listener count: 1 (expect: 1) ✓

grep -rE "BusKind|kind === 2900[12]|window\.nostr|signer-service|\['REGISTER'|\['EVENT'|\['OK'|\['CLOSED'|\['NOTICE'" \
  apps/demo/napplets/toaster/src | grep -v "^[[:space:]]*[\*\/]"
```
Result: **count = 1 (OK); zero other anti-term matches** — CLEAN

**Bot + chat (Phase 18 regression baseline):**
```bash
grep -rE "addEventListener\(['\"]message|BusKind|kind === 2900[12]|\['REGISTER'|\['EVENT'|\['OK'" \
  apps/demo/napplets/bot/src apps/demo/napplets/chat/src \
  | grep -v "^[[:space:]]*[\*\/]"
```
Result: **zero matches** — CLEAN

### pnpm dedupe check

```bash
pnpm ls @napplet/core --depth 5
# All @napplet/core symlinks → /home/sandwich/Develop/napplet/packages/core (single instance)

readlink -f node_modules/... (shim, sdk, nub-relay all → /home/sandwich/Develop/napplet/packages/core)
```
Result: **single linked instance confirmed** (Pitfall 4 guard — PASS)

`pnpm dedupe --check` exits with peer-dep warnings only (pre-existing @emnapi unrelated to
@napplet/core; no lockfile bloat detected).

### Fixes (Iteration 2)

None — gate green. All 27 tests PASS on both consecutive runs.

===

## Phase Close Gate

- [✓] All 13 Layer-B spec files GREEN against pnpm preview build (full v1.3 suite — 27/27 tests, 2 consecutive stable runs)
- [✓] No Phase 17 (E2E-06, 5 specs) regressions — demo-boot, demo-node-inspector, demo-debugger, demo-service-toggle, demo-notification-service all PASS
- [✓] No Phase 18 (E2E-07 napplet-auth + ifc-roundtrip, 2 specs) regressions — both PASS
- [✓] All 4 new Phase 19 E2E-07 specs pass (relay-publish, relay-publish-encrypted, storage-persist, notify-lifecycle)
- [✓] Both new Phase 19 E2E-08 specs pass (acl-revoke-relay-write, acl-revoke-storage-write)
- [✓] Anti-term grep over apps/demo/napplets/{composer,preferences}/src returns zero live-code matches
- [✓] Anti-term grep over apps/demo/napplets/toaster/src returns ZERO matches outside the EXACTLY-ONE allowed window.addEventListener('message') (Plan 19-03 SDK-gap exemption documented in src JSDoc)
- [✓] pnpm ls @napplet/core: single linked instance — all symlinks resolve to /home/sandwich/Develop/napplet/packages/core (Pitfall 4 guard)
- [✓] All 5 napplet dist/index.html files carry napplet-aggregate-hash meta tag (consistently empty across all 5 — VITE_DEV_PRIVKEY_HEX unset; Phase 18 decision: uniform empty = OK)
- [✓] Demo at :4174 renders 5 napplet topology cards + 8 service nodes (demo-boot confirms 8 nodes; no regressions vs Phase 17 baseline)
- [✓] 19-ITERATION-LOG.md committed via gsd-tools commit
