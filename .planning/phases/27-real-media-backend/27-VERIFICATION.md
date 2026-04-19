---
phase: 27-real-media-backend
verified: 2026-04-19T18:30:00Z
status: human_needed
score: 5/5 must-haves verified
human_verification:
  - test: "Run full E2E suite on origin/main after push"
    expected: "49 passed / 0 failed / 0 skipped; all three CI workflows (build.yml, unit.yml, e2e.yml) complete with status=success; CI URLs recorded in 27-ITERATION-LOG.md CI Verification section"
    why_human: "Phase 27 commits are on local main but have NOT been pushed to origin/main. The 27-ITERATION-LOG.md CI Verification section is a placeholder ('{To be recorded after push}') with no SHA or URL recorded. The local build + iteration loop (49 passed) is fully documented, but the CI gate used for Phase 26 requires actual push + green CI runs before the log is closed. Human must push and update the log."
---

# Phase 27: Real Media Backend Verification Report

**Phase Goal:** The stub `media-service` is replaced by a working Web Audio + MediaSession implementation exposed via the `media.*` NUB namespace; a `HostMediaBridge` interface lets host apps swap in native media backends; a `media-controller` demo napplet exercises playback control + metadata end-to-end and a Layer-B Playwright spec locks the contract.
**Verified:** 2026-04-19T18:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                                          | Status     | Evidence                                                                                                                             |
|----|--------------------------------------------------------------------------------------------------------------------------------|------------|--------------------------------------------------------------------------------------------------------------------------------------|
| 1  | MEDIA-01: media-service.ts installs navigator.mediaSession setActionHandler for 5 actions + mirrors metadata/playbackState + emits media.command + silent-audio prime | VERIFIED | File reads confirm ACTION_MATRIX (5 entries), setActionHandler calls, media.command emission, SILENT_AUDIO_DATA_URL constant. Grep counts: mediaSession/setActionHandler=32, media.command=8, data:audio/wav=1. |
| 2  | MEDIA-02: HostMediaBridge interface + createBrowserMediaBridge factory exported from @kehto/services; hostBridge option branch works | VERIFIED | export interface HostMediaBridge (line 147), export function createBrowserMediaBridge (line 294), index.ts exports both plus MediaAction re-export. Barrel grep=6 matches. |
| 3  | MEDIA-03: apps/demo/napplets/media-controller exists with 5 required files, 5 DOM sentinels, DEMO_METADATA title, __grantMediaControl__ hook, STUB_ONLY_SERVICES=[], 10 DEMO_NAPPLETS entries | VERIFIED | All 5 files confirmed (package.json, tsconfig.json, vite.config.ts, index.html, src/main.ts). 5 sentinel IDs in index.html. DEMO_METADATA title='Kehto Demo Track'. __grantMediaControl__ at shell-host.ts:903. STUB_ONLY_SERVICES=[]. Python count: 10 DEMO_NAPPLETS entries. |
| 4  | E2E-13: media-controller.spec.ts exists with DUAL-PATH assertion (DOM + navigator.mediaSession.playbackState + metadata.title via page.evaluate); demo-boot.spec.ts cascaded | VERIFIED | Spec confirmed with demoBeforeEach, :4174 baseURL, serial mode, bringToFront() fix, ANTI_TERM_RE check. Both playbackState assertions use expect.poll(). metadata.title asserted as 'Kehto Demo Track'. demo-boot.spec.ts stub-badge count=0, docblock updated. |
| 5  | Iteration loop: 48→49 delta (+1), 0 failed, 0 skipped, anti-term clean; commit SHA a652ec5 verified in git history | VERIFIED | Commit a652ec52492a7c5c2f90140a48fc5bba3affb597 confirmed (`git cat-file -t` returns `commit`). Log records 49 passed/0 failed/0 skipped (iteration 2). Anti-term grep shows 0 matches across media-service.ts and media-controller napplet sources. |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact                                                   | Provides                                                                     | Status   | Details                                                                                                 |
|------------------------------------------------------------|------------------------------------------------------------------------------|----------|---------------------------------------------------------------------------------------------------------|
| `packages/services/src/media-service.ts`                   | Real navigator.mediaSession mirror + media.command push + silent-audio prime | VERIFIED | 640 lines; contains navigator.mediaSession (32 occurrences), setActionHandler, media.command, data:audio/wav. No stub-level language. |
| `packages/services/src/media-service.ts`                   | HostMediaBridge interface + createBrowserMediaBridge factory                 | VERIFIED | `export interface HostMediaBridge` at line 147; `export function createBrowserMediaBridge` at line 294. |
| `packages/services/src/index.ts`                           | Barrel: createMediaService, createBrowserMediaBridge, HostMediaBridge, MediaAction | VERIFIED | Lines 71-84; exports both factory functions + 2 types + MediaAction re-export from @napplet/nub-media. |
| `packages/services/src/media-service.test.ts`              | 9 new describe blocks covering MockMediaSession integration                  | VERIFIED | grep count=9 for all describe names (navigator.mediaSession integration, media.command emission, last-active-wins, media.state status, media.capabilities narrows, media.session.destroy promotes, onWindowDestroyed cleans, destroy() detaches, HostMediaBridge integration). |
| `apps/demo/napplets/media-controller/package.json`         | @kehto/demo-media-controller package manifest                                | VERIFIED | Contains @napplet/sdk, @napplet/nub-media, @napplet/vite-plugin.                                       |
| `apps/demo/napplets/media-controller/vite.config.ts`       | Vite config with nappletType: 'demo-media-controller'                        | VERIFIED | nappletType: 'demo-media-controller' present.                                                           |
| `apps/demo/napplets/media-controller/index.html`           | 5 sentinel IDs + silent-loop <audio> element                                 | VERIFIED | #media-controller-status, #media-controller-play, #media-controller-pause, #media-controller-command-count, #media-controller-last-command all present. <audio> with data:audio/wav src at line 101. |
| `apps/demo/napplets/media-controller/src/main.ts`          | mediaCreateSession + mediaReportState + mediaOnCommand wiring                | VERIFIED | Imports all 3 nub-media helpers. DEMO_METADATA.title='Kehto Demo Track'. Status transitions: connecting → authenticated → session-ready → playing/paused. mediaOnCommand handler at line 105. |
| `apps/demo/src/shell-host.ts`                              | DEMO_NAPPLETS[9]=media-controller; STUB_ONLY_SERVICES=[]; __grantMediaControl__ | VERIFIED | 10 entries in DEMO_NAPPLETS. STUB_ONLY_SERVICES=[] at line 112. __grantMediaControl__ installed at line 903. |
| `tests/e2e/media-controller.spec.ts`                       | Layer-B DUAL-PATH spec (DOM + navigator.mediaSession via page.evaluate)      | VERIFIED | demoBeforeEach + :4174 baseURL. page.evaluate for playbackState (twice, with expect.poll) and metadata.title. ANTI_TERM_RE hygiene block. bringToFront() fix. |
| `tests/e2e/demo-boot.spec.ts`                              | Cascaded stub-assertion update: .stub-badge count=0                          | VERIFIED | toHaveCount(0) for keys stub, media stub, and .stub-badge. Docblock: "Both keys and media graduated to real-backend". |
| `.planning/phases/27-real-media-backend/27-ITERATION-LOG.md` | Fresh-build loop evidence: 49 passed / 0 failed / 0 skipped               | VERIFIED | Baseline 48 → final 49 (+1). SHA a652ec5 in git history. Anti-term grep documented. CI Verification section is a PLACEHOLDER (see gap below). |

---

### Key Link Verification

| From                                  | To                                               | Via                                                                     | Status   | Details                                                                                     |
|---------------------------------------|--------------------------------------------------|-------------------------------------------------------------------------|----------|---------------------------------------------------------------------------------------------|
| media-service.ts (createMediaService) | bridge.setMetadata / setPlaybackState / onAction | options.hostBridge ?? createBrowserMediaBridge(); bridge wired at service init | WIRED | bridge.onAction subscription at line 470; setActive() calls bridge.setMetadata + setPlaybackState (lines 490-491). |
| media-service.ts (createBrowserMediaBridge) | navigator.mediaSession.setActionHandler | applyActionHandlers() iterates ACTION_MATRIX, calls ms.setActionHandler | WIRED | ACTION_MATRIX at line 262; applyActionHandlers() at line 337; called from setActiveSession(). |
| media-service.ts                      | media.command push to napplet                    | bridge.onAction callback → sendHandles.get(windowId) → send(MediaCommandMessage) | WIRED | Lines 470-482: unsubscribeAction subscription; payload.type='media.command' constructed and sent. |
| index.ts barrel                       | media-service.ts                                 | export { createMediaService, createBrowserMediaBridge } + export type { HostMediaBridge } | WIRED | Lines 75-79 of index.ts. |
| shell-host.ts                         | createMediaService (real backend)                | createMediaService({ onSessionCreate }) — no hostBridge, default browser bridge used | WIRED | Line 476: createMediaService with onSessionCreate callback only; default bridge path activated. |
| media-controller/src/main.ts          | @napplet/nub-media mediaCreateSession            | await mediaCreateSession(DEMO_METADATA) → SDK routes to shell → media.session.create.result | WIRED | Import at line 26; called at line 78; setStatus('session-ready') at line 79 confirms resolution. |
| media-controller/src/main.ts          | @napplet/nub-media mediaReportState              | playBtn.onclick → mediaReportState(sessionId, { status: 'playing' })    | WIRED | Lines 84-92; pauseBtn.onclick at lines 94-98. |
| media-controller/src/main.ts          | @napplet/nub-media mediaOnCommand                | mediaOnCommand(sessionId, (action, value) => ...) subscribed after session create | WIRED | Line 105; increments commandCount, updates DOM sentinels. |
| shell-host.ts bootShell               | window.__grantMediaControl__ hook                | Installed at line 903; grants media:control via relay.runtime.aclState.grant | WIRED | Looks up media-controller entry by name, grants media:control capability. |
| media-controller.spec.ts              | window.__grantMediaControl__                     | page.evaluate(() => window.__grantMediaControl__?.())                   | WIRED | Lines 99-103; asserts return === true before clicking buttons. |
| media-controller.spec.ts              | navigator.mediaSession.playbackState (via page.evaluate) | page.evaluate reads shell-level navigator.mediaSession after button click | WIRED | Lines 126-128 (play), 141-143 (pause); uses expect.poll() for timing jitter. |

---

### Data-Flow Trace (Level 4)

| Artifact                              | Data Variable        | Source                                           | Produces Real Data | Status   |
|---------------------------------------|----------------------|--------------------------------------------------|--------------------|----------|
| `media-controller/src/main.ts`        | sessionId            | await mediaCreateSession(DEMO_METADATA)          | Yes — SDK sends envelope, shell stores in sessionRegistry, returns sessionId in .result | FLOWING |
| `media-controller/src/main.ts`        | #media-controller-status | setStatus() called at session-ready, playing, paused | Yes — driven by SDK promise resolution + button clicks | FLOWING |
| `media-service.ts` (browser bridge)   | navigator.mediaSession.playbackState | bridge.setPlaybackState → ms.playbackState = 'playing'|'paused'|'none' | Yes — driven by real media.state envelope from napplet | FLOWING |
| `media-service.ts` (browser bridge)   | navigator.mediaSession.metadata | bridge.setMetadata → writeMetadata() → ms.metadata = new MediaMetadata(init) | Yes — driven by real media.session.create envelope with DEMO_METADATA | FLOWING |
| `tests/e2e/media-controller.spec.ts`  | navigator.mediaSession.metadata.title | page.evaluate after play click | Yes — asserted as 'Kehto Demo Track' (matches DEMO_METADATA.title in napplet) | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — the spec requires a running preview server (:4174). The iteration loop in 27-ITERATION-LOG.md records the actual Playwright run result (49 passed, 18.7s) which is authoritative evidence. Local re-run would duplicate that evidence.

---

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                       | Status      | Evidence                                                                                                          |
|-------------|-------------|---------------------------------------------------------------------------------------------------|-------------|-------------------------------------------------------------------------------------------------------------------|
| MEDIA-01    | 27-01       | navigator.mediaSession mirror + media.command push + silent-audio prime                           | SATISFIED   | ACTION_MATRIX (5 entries), setActionHandler wiring, media.command envelope type, SILENT_AUDIO_DATA_URL in media-service.ts. |
| MEDIA-02    | 27-02       | HostMediaBridge interface + createBrowserMediaBridge factory + barrel export                      | SATISFIED   | export interface HostMediaBridge (line 147), export function createBrowserMediaBridge (line 294), barrel index.ts lines 71-84. |
| MEDIA-03    | 27-03       | media-controller napplet + shell wiring + __grantMediaControl__ + STUB_ONLY_SERVICES=[]           | SATISFIED   | All 5 napplet files exist; DEMO_NAPPLETS[9]=media-controller; STUB_ONLY_SERVICES=[]; __grantMediaControl__ installed. |
| E2E-13      | 27-04       | Layer-B media-controller.spec.ts + dual-path assertion + cascaded demo-boot fix + iteration loop | SATISFIED   | Spec exists with DOM + navigator.mediaSession page.evaluate assertions; demo-boot cascaded; iteration log records 49/0/0. |

No ORPHANED requirements found: all 4 MEDIA/E2E requirements mapped to Phase 27 plans are accounted for.

---

### Anti-Patterns Found

| File                                                      | Pattern | Severity | Impact    |
|-----------------------------------------------------------|---------|----------|-----------|
| `.planning/phases/27-real-media-backend/27-ITERATION-LOG.md` (CI Verification section) | Placeholder text: `{To be recorded after push...}` | Warning | CI evidence incomplete — Phase 27 commits are on local main but NOT pushed to origin/main. The local 49/0/0 iteration loop is fully documented; only the post-push CI URL record is missing. Does not block goal achievement but breaks the Phase 26 convention of capturing CI workflow URLs. |

No code anti-patterns found in Phase 27 source files:
- Zero `window.nostr`, `signer-service`, `BusKind`, `kind === 29001/29002` in media-service.ts or media-controller/src/
- Zero `window.addEventListener('message')` in napplet source
- Zero `Math.random` (no hand-rolled correlation IDs)
- Zero stub-level / `(stub)` language in media-service.ts docblock
- Silent-audio data URL is substantive (not a placeholder)

---

### Human Verification Required

#### 1. Push Phase 27 to origin/main and record CI evidence

**Test:** Push the local Phase 27 commits to origin/main: `git push origin main`. Wait for all three CI workflows (build.yml, unit.yml, e2e.yml) to complete. Record the resulting workflow run URLs in `.planning/phases/27-real-media-backend/27-ITERATION-LOG.md` under the "CI Verification (post-push)" section, replacing the `{To be recorded after push}` placeholder with the actual SHA and URL table (matching the format used in `26-ITERATION-LOG.md` lines 195-205).

**Expected:** All 3 workflows complete with status=success. The iteration log CI Verification section shows the pushed SHA and three URL rows.

**Why human:** Pushing to origin/main requires authenticated git access. The automated verifier cannot push or poll CI run status. The local iteration loop evidence (49/0/0, SHA a652ec5) is fully documented and verified — only the post-push CI closure is outstanding.

---

### Gaps Summary

No gaps blocking goal achievement. All 5 observable truths are VERIFIED against the actual codebase:
- MEDIA-01: Real navigator.mediaSession mirror with 5-action setActionHandler matrix, media.command push, and silent-audio prime are all substantive and wired.
- MEDIA-02: HostMediaBridge interface and createBrowserMediaBridge factory are exported from the barrel and the hostBridge option branch is functional.
- MEDIA-03: media-controller napplet has all 5 required files, all 5 DOM sentinels, DEMO_METADATA with 'Kehto Demo Track', and the __grantMediaControl__ hook. STUB_ONLY_SERVICES=[] confirmed. DEMO_NAPPLETS has 10 entries.
- E2E-13: media-controller.spec.ts is a complete DUAL-PATH spec (DOM + navigator.mediaSession via page.evaluate). demo-boot.spec.ts cascade is complete.
- Iteration loop: 48→49 delta (+1), 0 failed, 0 skipped documented in 27-ITERATION-LOG.md; commit SHA confirmed in git history.

The only outstanding item is the CI Verification section of 27-ITERATION-LOG.md, which is a post-push artifact (analogous to what Phase 26 completed after push). This does not indicate a code deficiency — it reflects that Phase 27 commits have not yet been pushed to origin/main.

---

_Verified: 2026-04-19T18:30:00Z_
_Verifier: Claude (gsd-verifier)_
