/**
 * media-controller.spec.ts — E2E-13 (Phase 27 real media backend).
 *
 * The media-controller napplet (Plan 27-03) creates a media session via the
 * @napplet/nub/media helpers: `mediaCreateSession(...)` + `mediaReportState(...)`
 * + `mediaOnCommand(...)`. The helper internally routes the shell's
 * `media.session.create.result` envelope (Plan 27-01 preserves that wire shape)
 * and the `media.command` push (Plan 27-01 emits this on every matching
 * navigator.mediaSession setActionHandler fire) to the napplet callback.
 *
 * This spec is the Layer-B contract: it drives play/pause via DOM button clicks
 * AND asserts the OS-level mirror through navigator.mediaSession reads via
 * page.evaluate. DUAL-PATH assertion:
 *   1. DOM sentinel path: status transitions, command counter baseline
 *   2. Browser-API path: navigator.mediaSession.playbackState + metadata.title
 *
 * The full loop under test:
 *
 *   Napplet boot:
 *     media-controller main.ts calls `await mediaCreateSession({ title, artist, mediaType })`
 *     → helper sends media.session.create envelope
 *     → shell routes to media-service.handleMessage (Plan 27-01)
 *     → service stores sessionRegistry[sessionId] = { windowId, metadata, ... }
 *     → service calls bridge.setMetadata(sessionId, metadata) → mirrors to navigator.mediaSession.metadata
 *     → service calls bridge.setActiveSession(sessionId) → primes silent-audio + installs setActionHandlers
 *     → service sends media.session.create.result back
 *     → helper resolves the mediaCreateSession Promise
 *     → napplet status transitions 'connecting...' → 'session-ready'
 *
 *   Play button click:
 *     → napplet onclick fires → mediaReportState(sessionId, { status: 'playing' })
 *     → helper sends media.state envelope
 *     → shell routes to media-service.handleMessage (Plan 27-01)
 *     → service calls bridge.setPlaybackState(sessionId, 'playing')
 *     → bridge writes navigator.mediaSession.playbackState = 'playing'
 *     → (separately) napplet local setStatus('playing') updates DOM sentinel
 *
 *   Pause button click: symmetric to Play, status becomes 'paused'.
 *
 * Serial mode prevents postMessage timing interference across worker lifetimes.
 *
 * ROADMAP §4 deviation (the napplet-ready helper): the :4174 demo does not
 * install `window.__nappletReady__` (only the :4173 harness does — helpers
 * diverge here by design). This spec uses the status-sentinel wait
 * `toContainText('session-ready')` which provides equivalent coverage because
 * it blocks until both the napplet's init and the
 * mediaCreateSession round-trip have completed — observable via the
 * #media-controller-status DOM transition. hotkey-chord.spec.ts +
 * relay-subscribe.spec.ts follow the same pattern for the same reason.
 *
 * Capability gate: Plan 27-03's `window.__grantMediaControl__` host hook grants
 * `media:control` to the media-controller napplet. The spec invokes it after
 * gating on 'session-ready' (which implies identity-bound). Exact mirror of
 * Plan 26-04's __grantKeysForward__ mechanism.
 *
 * Browser-scope note: Chromium supports the full MediaSession API. Firefox +
 * Safari have partial support. This spec runs on Chromium only (Playwright
 * default on ubuntu-latest, matching the v1.4 milestone's Chromium-only CI
 * scope).
 *
 * ANTI-TERM hygiene: standard v1.4 regex covering window.nostr / signer-service
 * / BusKind / AUTH_KIND / legacy kind 29001|29002.
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;

test('media-controller napplet drives navigator.mediaSession via real media backend (DOM + browser-API dual-path)', async ({ page }) => {
  test.setTimeout(60_000);
  const consoleMessages: string[] = [];
  page.on('console', (msg) => consoleMessages.push(msg.text()));
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await demoBeforeEach(page);

  const mediaFrame = page.frameLocator('#media-controller-frame-container iframe');

  // Step 1: wait for napplet mediaCreateSession round-trip.
  // The init pattern + `await mediaCreateSession(...)` means status
  // transitions 'connecting...' → 'session-ready'. We accept
  // 'session-ready' as evidence that the helper resolved the mediaCreateSession
  // Promise (the real backend registered the session AND mirrored metadata to
  // navigator.mediaSession).
  await expect(mediaFrame.locator('#media-controller-status')).toContainText('session-ready', { timeout: 15_000 });

  // Step 2: initial counter state is '0' (baseline sanity check).
  await expect(mediaFrame.locator('#media-controller-command-count')).toHaveText('0', { timeout: 3_000 });

  // Step 3: grant media:control capability via the pre-installed host hook
  // (Plan 27-03 bootShell installs window.__grantMediaControl__). The hook
  // returns true when the grant succeeded, false if the napplet isn't loaded
  // or identity-bound yet. Because Step 1 gated on 'session-ready' (which
  // implies identity-bound), the grant MUST succeed here.
  const granted = await page.evaluate(() => {
    const fn = (window as Window & { __grantMediaControl__?: () => boolean }).__grantMediaControl__;
    return typeof fn === 'function' ? fn() : false;
  });
  expect(granted, '__grantMediaControl__ must return true — hook installed by Plan 27-03 bootShell').toBe(true);

  // Step 4: DOM-path assertion — click Play, wait for #media-controller-status
  // to transition to 'playing'. This proves the napplet's onclick handler
  // fired (mediaReportState + local setStatus).
  //
  // bringToFront() ensures this browser tab is active before the click so
  // Chromium does not throttle the sandboxed iframe's JS execution in a
  // background tab (background-tab JS throttling would prevent the onclick
  // from running within the assertion timeout when the full suite runs 8
  // parallel worker contexts).
  await page.bringToFront();
  await mediaFrame.locator('#media-controller-play').click();
  await expect(mediaFrame.locator('#media-controller-status')).toContainText('playing', { timeout: 5_000 });

  // Step 5: Browser-API-path assertion — read navigator.mediaSession from the
  // top-level page (shell) context via page.evaluate. Plan 27-01's real backend
  // mirrors mediaReportState(playing) → bridge.setPlaybackState(sessionId, 'playing')
  // → navigator.mediaSession.playbackState = 'playing'.
  //
  // Use expect.poll() to allow the mirror to propagate (mediaReportState → envelope
  // → service handleMessage → bridge.setPlaybackState is async-but-fast; a
  // small retry window absorbs sub-second timing jitter).
  await expect.poll(async () => {
    return page.evaluate(() => (navigator.mediaSession?.playbackState ?? 'unknown') as string);
  }, { timeout: 5_000, message: 'navigator.mediaSession.playbackState should be "playing" after mediaReportState' }).toBe('playing');

  // Step 6: assert navigator.mediaSession.metadata.title was populated on
  // session.create (Plan 27-01 calls bridge.setMetadata inside handleMessage
  // for the session.create branch). The hard-coded title is 'Kehto Demo Track'
  // per UI-SPEC.md + Plan 27-03 main.ts DEMO_METADATA.
  const metadataTitle = await page.evaluate(() => navigator.mediaSession?.metadata?.title ?? null);
  expect(metadataTitle).toBe('Kehto Demo Track');

  // Step 7: click Pause → status 'paused' → navigator.mediaSession.playbackState 'paused'.
  await page.bringToFront();
  await mediaFrame.locator('#media-controller-pause').click();
  await expect(mediaFrame.locator('#media-controller-status')).toContainText('paused', { timeout: 5_000 });
  await expect.poll(async () => {
    return page.evaluate(() => (navigator.mediaSession?.playbackState ?? 'unknown') as string);
  }, { timeout: 5_000, message: 'navigator.mediaSession.playbackState should be "paused" after pause click' }).toBe('paused');

  // Step 8: ANTI-TERM hygiene — no forbidden patterns in console or page errors.
  const antiConsole = consoleMessages.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiConsole, `anti-term found in console: ${antiConsole.join(' | ')}`).toHaveLength(0);
  const antiErrors = pageErrors.filter((m) => ANTI_TERM_RE.test(m));
  expect(antiErrors, `anti-term found in page errors: ${antiErrors.join(' | ')}`).toHaveLength(0);
});
