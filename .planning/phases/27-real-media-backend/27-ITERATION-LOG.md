# Phase 27 Iteration Log — Real Media Backend

**Canon:** E2E iteration-loop discipline (v1.3 Phase 22 established canon; baked into v1.4 per-phase success criteria).

**ROADMAP Phase 27 success criterion 5:** "Build → run → Playwright iteration loop recorded against the post-refactor commit: `pnpm clean && pnpm build && pnpm test:e2e` reports baseline+1 (49 / 0 / 0) green; result captured in the phase iteration log."

**Phase:** 27-real-media-backend
**Requirements covered:** MEDIA-01, MEDIA-02, MEDIA-03, E2E-13 (closed here)
**Cross-cutting gate:** E2E iteration-loop discipline (v1.4 canon)
**Started:** 2026-04-19T17:38:17Z
**Closed:** 2026-04-19T17:45:14Z
**Commit SHA at run:** a652ec52492a7c5c2f90140a48fc5bba3affb597

## Summary Table

| Requirement                                                                                     | Plan  | Status              |
|-------------------------------------------------------------------------------------------------|-------|---------------------|
| MEDIA-01 (real navigator.mediaSession mirror + media.command push + silent-audio prime)         | 27-01 | CLOSED              |
| MEDIA-02 (HostMediaBridge interface + createBrowserMediaBridge factory + barrel export)         | 27-02 | CLOSED              |
| MEDIA-03 (media-controller demo napplet + shell wiring + __grantMediaControl__ hook + STUB_ONLY_SERVICES=[] cascade) | 27-03 | CLOSED              |
| E2E-13 (Layer-B media-controller.spec.ts + cascaded demo-boot.spec.ts fix + fresh-build iteration loop) | 27-04 | CLOSED (this plan)  |

<!-- section-divider -->

## Capability-Gate Handling (Plan 27-04 Task 1)

Plan 27-03 installed a `window.__grantMediaControl__` host hook in bootShell() (scoped to the media-controller napplet — looks up its windowId from the napplets Map, then calls `relay.runtime.aclState.grant(pubkey, dTag, hash, 'media:control')`). Plan 27-04's spec invokes the hook after gating on `#media-controller-status = 'session-ready'`; the hook returns `true` since the napplet is authenticated by that point.

Note: all `media.*` messages require the `media:control` capability (enforced by `resolveCapabilitiesNub` in `packages/acl/src/resolve.ts:242`). The `__grantMediaControl__` hook grants this before the spec clicks Play/Pause, ensuring `mediaReportState` envelopes are accepted by the runtime.

Exact mirror of Plan 26-04's `__grantKeysForward__` pattern — no investigation branches, no spec-side grant logic. The spec simply calls:

```ts
const granted = await page.evaluate(() => {
  const fn = (window as Window & { __grantMediaControl__?: () => boolean }).__grantMediaControl__;
  return typeof fn === 'function' ? fn() : false;
});
expect(granted, '__grantMediaControl__ must return true — hook installed by Plan 27-03 bootShell').toBe(true);
```

<!-- section-divider -->

## ROADMAP §4 Deviation: napplet-ready helper

ROADMAP Phase 27 success criterion 4 cites "canonical demoBeforeEach + waitForNappletReady". The :4174 demo does NOT install `window.__nappletReady__` — only the :4173 harness does (helpers diverge here by design). The spec uses the status-sentinel wait `toContainText('session-ready')` which provides equivalent coverage: it blocks until the napplet's SDK AUTH probe (storage.getItem) and the mediaCreateSession round-trip have both completed, observable via the #media-controller-status DOM transition.

`tests/e2e/hotkey-chord.spec.ts` + `tests/e2e/relay-subscribe.spec.ts` follow the same pattern for the same reason. This deviation is a property of the :4174 demo, not a planning gap — documented here + in the spec's file-level docblock so future audits can trace it.

<!-- section-divider -->

## Dual-Path Assertion (E2E-13 specific vs. E2E-12)

E2E-12 (hotkey-chord) asserted on DOM sentinels only. E2E-13 (media-controller) asserts on BOTH:

1. **DOM sentinel path**: #media-controller-status text transitions ('session-ready' → 'playing' → 'paused'); asserted via frameLocator on the sandbox iframe.

2. **Browser-API path**: navigator.mediaSession.playbackState + metadata.title, read from the TOP-LEVEL page context (shell page) via page.evaluate. Plan 27-01's createBrowserMediaBridge writes to the shell's singleton navigator.mediaSession — NOT the iframe's. Reads therefore target the top-level page.

Browser-scope limitation: Chromium supports the full MediaSession API; Firefox + Safari have partial support. This spec runs on Chromium only (Playwright default on ubuntu-latest, matching v1.4 milestone's Chromium-only CI scope).

<!-- section-divider -->

## Fresh-Build Iteration Loop (ROADMAP Phase 27 §5)

**Commands executed:** `pnpm clean && pnpm build && pnpm test:e2e`
(`pnpm clean` is not defined at root; manual-clean substitute used per Phase 22-08 + Phase 24-02 + Phase 26-04 precedent: `rm -rf packages/*/dist packages/*/.turbo tests/fixtures/napplets/*/dist tests/e2e/harness/dist tests/e2e/harness/.turbo apps/*/dist apps/*/.turbo apps/demo/napplets/*/dist apps/demo/napplets/*/.turbo node_modules/.cache` + `find . -type d -name ".turbo" -not -path "*/node_modules/*" -exec rm -rf {} +`.)

### Clean

```
# manual-clean completed; all dist/ and .turbo/ trees removed across packages/, apps/, apps/demo/napplets/, tests/fixtures/napplets/, tests/e2e/harness/
```
Exit code: 0

### Build (cold — fresh clean)

```
@test/harness:build: dist/assets/main-BE60xBSI.js  42.85 kB │ gzip: 13.54 kB
@test/harness:build: ✓ built in 282ms
@kehto/demo:build: ✓ 104 modules transformed.
@kehto/demo:build: dist/index.html                 26.39 kB │ gzip:  6.12 kB
@kehto/demo:build: dist/assets/main-_LIv1z9n.css    4.36 kB │ gzip:  1.15 kB
@kehto/demo:build: dist/assets/main-Dt7kr-gg.js   277.20 kB │ gzip: 89.19 kB
@kehto/demo:build: ✓ built in 792ms

 Tasks:    22 successful, 22 total
Cached:    0 cached, 22 total
  Time:    5.73s
```
Exit code: 0

New build task `@kehto/demo-media-controller:build` is the +1 task vs the Phase 26-04 baseline of 21 tasks (baseline at 26-04 close was `21 successful, 21 total`). All 22 tasks cache-miss on this cold rebuild (0 cached / 22 total).

### E2E (full suite) — Iteration 2 (final, post-bringToFront fix)

```
Running 49 tests using 8 workers

  ✓  1 [chromium] › tests/e2e/media-controller.spec.ts:72:1 › media-controller napplet drives navigator.mediaSession via real media backend (DOM + browser-API dual-path) (1.1s)
  ...
  ✓  49 [chromium] › tests/e2e/demo-node-inspector.spec.ts:79:1 › no anti-term in console output during inspector interactions (1.5s)

  49 passed (18.7s)
```
Exit code: 0

**Result:** 49 passed / 0 failed / 0 skipped.

Baseline at Plan 27-03 close: **48** passed (inherited from v1.4 Phase 26-04 closure).
Final at Plan 27-04 close: **49** passed.
Delta: **+1** (tests/e2e/media-controller.spec.ts).

<!-- section-divider -->

## Iteration History

### Iteration 1 — 2026-04-19T17:38:17Z

**Commands:** manual clean → `pnpm build` → `pnpm test:e2e`
**Result:** 48 passed / **1 failed** / 0 skipped — `tests/e2e/media-controller.spec.ts:109` failed with `expected "session-ready" to contain "playing"`.

The spec clicked `#media-controller-play` in the sandboxed iframe but the status did not transition to 'playing' within 5 seconds when 8 parallel Playwright workers competed for Chromium resources. Root cause: Chromium's background-tab JS throttling suppresses iframe `onclick` execution in non-focused browser contexts. The status updated correctly in isolated single-worker runs but failed consistently in full-suite parallel mode.

Note: the demo-boot.spec.ts cascaded fix (Task 2) was already committed before the build, so it did NOT produce an iteration-1 failure (unlike Phase 26's iteration-1 demo-boot regression). The only iteration-1 failure was from the background-tab throttling bug.

**Fix applied (Rule 1 deviation — background-tab throttling bug):**

```diff
+  // bringToFront() ensures this browser tab is active before the click so
+  // Chromium does not throttle the sandboxed iframe's JS execution in a
+  // background tab.
+  await page.bringToFront();
   await mediaFrame.locator('#media-controller-play').click();
   ...
+  await page.bringToFront();
   await mediaFrame.locator('#media-controller-pause').click();
```

Commit: `a652ec52492a7c5c2f90140a48fc5bba3affb597`

### Iteration 2 — 2026-04-19T17:45:14Z

**Commands:** `pnpm test:e2e` (build unchanged; bringToFront fix applied in spec file)
**Result:** **49 passed / 0 failed / 0 skipped / 18.7s**. Green.

Confirmed stable across two consecutive full-suite runs.

<!-- section-divider -->

## Anti-Term Hygiene Grep Evidence

ROADMAP Phase 27 §5 requires zero `window.nostr` / `signer-service` / `BusKind` references in Phase 27 sources. Verified (source files only; built dist/ artifacts excluded per Phase 22-08 precedent):

```
$ grep -rnE "window\.nostr|signer-service|signer\.sign|BusKind|kind 29001|kind 29002" \
    packages/services/src/media-service.ts \
    apps/demo/napplets/media-controller/src/ \
    apps/demo/napplets/media-controller/index.html
# (no matches — exit code 1)
```

```
$ grep -rnE "window\.addEventListener\('message'|Math\.random|onNappletMessage|sendNappletMessage" \
    apps/demo/napplets/media-controller/src/
# (no matches — exit code 1)
```

The media-controller.spec.ts file DOES contain literal `BusKind` and `AUTH_KIND` tokens inside the ANTI_TERM_RE regex declaration and the anti-term hygiene note in the docblock — these are intentional: the spec exists to detect anti-term regressions, so it must name the forbidden patterns to match them. This is a false-positive class excluded from the grep scope above (matches the hotkey-chord.spec.ts + relay-subscribe.spec.ts precedent).

<!-- section-divider -->

## New Spec Evidence

Spec added: `tests/e2e/media-controller.spec.ts`
Run in isolation:

```
$ pnpm exec playwright test tests/e2e/media-controller.spec.ts --reporter=list

Running 1 test using 1 worker

  ✓  1 [chromium] › tests/e2e/media-controller.spec.ts:72:1 › media-controller napplet drives navigator.mediaSession via real media backend (DOM + browser-API dual-path) (1.0s)

  1 passed (3.7s)
```
Exit code: 0

Cascaded update: `tests/e2e/demo-boot.spec.ts` updated to reflect STUB_ONLY_SERVICES=[] topology (Task 2). Plan 26-04 precedent followed — cascaded topology-change test updates are in-scope for the phase that changed the topology. Unlike Phase 26's Iteration 1 (which caught the demo-boot regression), the Task 2 fix was already committed before the full-suite run, so demo-boot.spec.ts passed on the first iteration.

<!-- section-divider -->

## Closing Notes

Phase 27 closes with the real media backend shipped (Plan 27-01 — navigator.mediaSession metadata + playbackState mirror + media.command push via setActionHandler), the host-bridge contract exported (Plan 27-02 — HostMediaBridge + createBrowserMediaBridge), the media-controller demo napplet wired via the canonical @napplet/nub-media helpers (Plan 27-03 uses mediaCreateSession + mediaReportState + mediaOnCommand; __grantMediaControl__ hook pre-installed in bootShell), and the Layer-B contract locked via DUAL-PATH assertion (Plan 27-04 — DOM + navigator.mediaSession read).

The stub-only era ends here: STUB_ONLY_SERVICES = []. The v1.4 demo is now a 10-napplet showcase (8 from v1.3 + hotkey-chord from Phase 26 + media-controller from Phase 27).

**Background-tab throttling note (Rule 1 auto-fix):** The media-controller spec is unique among Phase 27 specs in requiring iframe button clicks (vs. the hotkey-chord spec which dispatches keyboard events to the top-level page). Chromium throttles JS execution in non-focused tabs when multiple parallel Playwright workers run. `page.bringToFront()` before each button click eliminates the throttling race. This is documented here and in the spec file for future iframe-click specs.

Phase 28 closes v1.4 by:
- Upgrading nub-keys.spec.ts + nub-media.spec.ts from stub-scope to full Layer-A coverage (E2E-14).
- Refreshing packages/services/README.md with keys + media API documentation (DOCS-05).
- Refreshing apps/demo/README.md with 10-napplet integration narrative (DOCS-06).

**STUB_ONLY_SERVICES status:** `[]` (was `['media']` at Phase 26 close, `['keys', 'media']` at Phase 25 close).

**v1.4 e2e baseline:** 49 passed (was 48 at Phase 26 close). Phase 28 will upgrade (not add) 2 existing specs from stub-scope to full coverage — final v1.4 baseline stays at 49 passed post-Phase-28 (no spec-count delta, only coverage-depth delta).

<!-- section-divider -->

## CI Verification (post-push)

{To be recorded after push — same structure as 26-ITERATION-LOG.md's CI Verification section. Atomic commit pushed: `{SHA}` (origin/main). All 3 CI workflows completed **success** against this SHA: Build / Unit Tests / E2E with URLs.}
