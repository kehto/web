# Phase 26 Iteration Log — Real Keys Backend

**Canon:** E2E iteration-loop discipline (v1.3 Phase 22 established canon; baked into v1.4 per-phase success criteria).

**ROADMAP Phase 26 success criterion 5:** "Build → run → Playwright iteration loop recorded against the post-refactor commit: `pnpm clean && pnpm build && pnpm test:e2e` reports baseline+1 (48 / 0 / 0) green; result captured in the phase iteration log."

**Phase:** 26-real-keys-backend
**Requirements covered:** KEYS-01, KEYS-02, KEYS-03, E2E-12 (closed here)
**Cross-cutting gate:** E2E iteration-loop discipline (v1.4 canon)
**Started:** 2026-04-19T14:05:55Z
**Closed:** 2026-04-19T14:07:46Z
**Commit SHA at run:** a164fd833ac53a36757a89df775af06c8fac693b (pre-atomic-commit HEAD; Plan 26-04 atomic commit lands on top of this SHA)

## Summary Table

| Requirement                                                                         | Plan  | Status              |
|-------------------------------------------------------------------------------------|-------|---------------------|
| KEYS-01 (real document-level chord listener + keys.action push)                     | 26-01 | CLOSED              |
| KEYS-02 (HostKeysBridge interface + barrel export)                                  | 26-02 | CLOSED              |
| KEYS-03 (hotkey-chord demo napplet + shell wiring + __grantKeysForward__ hook)       | 26-03 | CLOSED              |
| E2E-12 (Layer-B hotkey-chord.spec.ts + fresh-build iteration loop + atomic commit)  | 26-04 | CLOSED (this plan)  |

---

## Capability-Gate Handling (Plan 26-04 Task 1)

Plan 26-03 installed a `window.__grantKeysForward__` host hook in bootShell() (scoped to the hotkey-chord napplet — looks up its windowId from the napplets Map, then calls `relay.runtime.aclState.grant(pubkey, dTag, hash, 'keys:forward')`). Plan 26-04's spec invokes the hook after gating on `#hotkey-chord-status = 'subscribed'`; the hook returns `true` since the napplet is authenticated by that point.

This is the canonical path per checker cascading fix on blocker 1 — no investigation branches, no spec-side grant logic. The spec simply calls:

```ts
const granted = await page.evaluate(() => {
  const fn = (window as Window & { __grantKeysForward__?: () => boolean }).__grantKeysForward__;
  return typeof fn === 'function' ? fn() : false;
});
expect(granted, '__grantKeysForward__ must return true — hook installed by Plan 26-03 bootShell').toBe(true);
```

---

## ROADMAP §4 Deviation: napplet-ready helper

ROADMAP Phase 26 success criterion 4 cites "canonical demoBeforeEach + the canonical napplet-ready helper". The :4174 demo does NOT install `window.__nappletReady__` — only the :4173 harness does (helpers diverge here by design). The spec uses the status-sentinel wait `toContainText('subscribed')` which provides equivalent coverage: it blocks until the napplet's SDK AUTH probe (storage.getItem) and the keys.registerAction round-trip have both completed, observable via the #hotkey-chord-status DOM transition.

`tests/e2e/relay-subscribe.spec.ts` follows the same pattern for the same reason. This deviation is a property of the :4174 demo, not a planning gap — documented here + in the spec's file-level docblock so future audits can trace it.

---

## Fresh-Build Iteration Loop (ROADMAP Phase 26 §5)

**Commands executed:** `pnpm clean && pnpm build && pnpm test:e2e`
(`pnpm clean` is not defined at root; manual-clean substitute used per Phase 22-08 + Phase 24-02 precedent: `rm -rf packages/*/dist packages/*/.turbo tests/fixtures/napplets/*/dist tests/e2e/harness/dist tests/e2e/harness/.turbo apps/*/dist apps/*/.turbo apps/demo/napplets/*/dist apps/demo/napplets/*/.turbo node_modules/.cache` + `find . -type d -name ".turbo" -not -path "*/node_modules/*" -exec rm -rf {} +`.)

### Clean

```
# manual-clean completed; all dist/ and .turbo/ trees removed across packages/, apps/, apps/demo/napplets/, tests/fixtures/napplets/, tests/e2e/harness/
```
Exit code: 0

### Build (cold — fresh clean)

```
@test/harness:build: dist/index.html                0.68 kB │ gzip:  0.44 kB
@test/harness:build: dist/assets/pure-B1f2xkdA.js  27.52 kB │ gzip: 11.13 kB
@test/harness:build: dist/assets/main-BE60xBSI.js  42.85 kB │ gzip: 13.54 kB
@test/harness:build: ✓ built in 275ms
@kehto/demo:build: ✓ 104 modules transformed.
@kehto/demo:build: dist/index.html                 26.39 kB │ gzip:  6.12 kB
@kehto/demo:build: dist/assets/main-_LIv1z9n.css    4.36 kB │ gzip:  1.15 kB
@kehto/demo:build: dist/assets/main-BdnTrmUt.js   272.66 kB │ gzip: 87.76 kB
@kehto/demo:build: ✓ built in 756ms

 Tasks:    21 successful, 21 total
Cached:    0 cached, 21 total
  Time:    5.58s
```
Exit code: 0

New build task `@kehto/demo-hotkey-chord:build` (20.51 kB napplet bundle) is the +1 task vs the Phase 24-02 baseline of 20 tasks. All 21 tasks cache-miss on this cold rebuild (0 cached / 21 total).

### E2E (full suite)

```
Running 48 tests using 8 workers
...
  ✓  19 [chromium] › tests/e2e/hotkey-chord.spec.ts:66:1 › hotkey-chord napplet receives Ctrl+Shift+K via real keys backend and increments counter (2.5s)
...
  ✓  48 [chromium] › tests/e2e/demo-node-inspector.spec.ts:79:1 › no anti-term in console output during inspector interactions (1.5s)

  48 passed (16.8s)
```
Exit code: 0

**Result:** 48 passed / 0 failed / 0 skipped.

Baseline at Plan 26-03 close: **47** passed (inherited from v1.3 Phase 22 closure; preserved unchanged through v1.4 Phases 23–25 per each phase's ITERATION-LOG).
Final at Plan 26-04 close: **48** passed.
Delta: **+1** (tests/e2e/hotkey-chord.spec.ts).

---

## Iteration History

### Iteration 1 — first fresh-build run (2026-04-19T14:05:55Z)

**Commands:** manual clean → `pnpm build` → `pnpm test:e2e`
**Result:** 47 passed / **1 failed** / 0 skipped — `tests/e2e/demo-boot.spec.ts:29` failed.

The pre-existing `demo-boot.spec.ts` asserts `[data-service-name="keys"][data-service-stub="true"]` count = 1 and `.stub-badge` count = 2. Plan 26-03 intentionally demoted keys from `STUB_ONLY_SERVICES` (`['keys', 'media'] → ['media']`) — so keys is no longer tagged stub, and the assertion now correctly reports `Received: 0` for the keys+stub combined locator and `1` for `.stub-badge` (only media remains).

The failure is **directly caused by Plan 26-03's intended change** — the spec encodes a stub-topology assumption that Phase 26 deliberately invalidates. Per the executor's Rule 1 (auto-fix bug) + scope-boundary rule (only auto-fix issues directly caused by the current plan's changes), the fix is in-scope for this plan.

**Fix applied (Rule 1 deviation, Plan 26-04 Task 2 — cascaded):**

```diff
 /**
- * demo-boot.spec.ts — E2E-06: demo boots clean at :4174 with all 8 service nodes.
- *
- * Asserts: topology renders 8 service nodes, keys+media have stub-only marker,
+ * demo-boot.spec.ts — E2E-06: demo boots clean at :4174 with all 8 service nodes.
+ *
+ * Asserts: topology renders 8 service nodes, media has the stub-only marker
+ * (keys graduated to real-backend in Phase 26 — see STUB_ONLY_SERVICES in
+ * apps/demo/src/shell-host.ts), no anti-term...
   ...
-   // keys + media have stub-only marker
-   await expect(page.locator('[data-service-name="keys"][data-service-stub="true"]')).toHaveCount(1);
-   await expect(page.locator('[data-service-name="media"][data-service-stub="true"]')).toHaveCount(1);
-   await expect(page.locator('.stub-badge')).toHaveCount(2);
+   // media has the stub-only marker; keys graduated to real-backend in Phase 26.
+   await expect(page.locator('[data-service-name="keys"][data-service-stub="true"]')).toHaveCount(0);
+   await expect(page.locator('[data-service-name="media"][data-service-stub="true"]')).toHaveCount(1);
+   await expect(page.locator('.stub-badge')).toHaveCount(1);
```

### Iteration 2 — post-fix re-run (2026-04-19T14:07:46Z)

**Commands:** `pnpm test:e2e` (build unchanged; only spec-file change)
**Result:** **48 passed / 0 failed / 0 skipped / 16.8s**. Green.

---

## Anti-Term Hygiene Grep Evidence

ROADMAP Phase 26 §5 requires zero `window.nostr` / `signer-service` / `BusKind` references in Phase 26 sources. Verified (source files only; built dist/ artifacts excluded per Phase 22-08 precedent):

```
$ grep -rnE "window\.nostr|signer-service|signer\.sign|BusKind|kind 29001|kind 29002" \
    packages/services/src/keys-service.ts \
    apps/demo/napplets/hotkey-chord/src/ \
    apps/demo/napplets/hotkey-chord/index.html
# (no matches — exit code 1)
```

```
$ grep -rnE "window\.addEventListener\('message'|Math\.random|onNappletMessage|sendNappletMessage" \
    apps/demo/napplets/hotkey-chord/src/
# (no matches — exit code 1)
```

The hotkey-chord.spec.ts file DOES contain literal `BusKind` and `AUTH_KIND` tokens inside the ANTI_TERM_RE regex declaration (line 64) and the anti-term hygiene note in the docblock (line 56) — these are intentional: the spec exists to detect anti-term regressions, so it must name the forbidden patterns to match them. This is a false-positive class excluded from the grep scope above (matches the relay-subscribe.spec.ts precedent).

---

## New Spec Evidence

Spec added: `tests/e2e/hotkey-chord.spec.ts`
Run in isolation:

```
$ pnpm exec playwright test tests/e2e/hotkey-chord.spec.ts --reporter=list
Running 1 test using 1 worker

  ✓  1 [chromium] › tests/e2e/hotkey-chord.spec.ts:66:1 › hotkey-chord napplet receives Ctrl+Shift+K via real keys backend and increments counter (791ms)

  1 passed (3.4s)
```
Exit code: 0

---

## Closing Notes

Phase 26 closes with the real keys backend shipped (Plan 26-01 — document-level chord listener + keys.action push to the owning napplet), the host-bridge contract exported (Plan 26-02), the hotkey-chord demo napplet wired via the canonical @napplet/sdk `keys` namespace (Plan 26-03 uses `keys.registerAction` + `keys.onAction`; `__grantKeysForward__` hook pre-installed in bootShell), and the Layer-B contract locked (Plan 26-04).

Phase 27 picks up the same pattern for media: real Web Audio + MediaSession backend, HostMediaBridge interface, media-controller demo napplet, media-controller.spec.ts.

**STUB_ONLY_SERVICES status:** `['media']` (was `['keys', 'media']` at Phase 25 close).

**v1.4 e2e baseline:** 48 passed (was 47 at Phase 25 close). Phase 27 will target 49 (adding media-controller.spec.ts); Phase 28 will close v1.4 with the full Layer-A/Layer-B coverage.
