# Phase 27: Real Media Backend - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning
**Mode:** Smart-discuss batch acceptance (user accepted all 3 grey-area recommendations)

<domain>
## Phase Boundary

Replace stub `@kehto/services` media-service with a real browser-side implementation that mirrors napplet-reported playback state to `navigator.mediaSession` (OS-level transport surface) and mirrors napplet-provided metadata to `navigator.mediaSession.metadata`. Define a `HostMediaBridge` interface so host apps (Electron/Tauri) can plug native media backends. Ship `apps/demo/napplets/media-controller` demo napplet + Layer-B Playwright spec (E2E-13). Anti-term hygiene + fresh-build iteration loop close the phase.

In scope:
- **MEDIA-01**: Real `media-service` — mirrors `media.session.update` → `navigator.mediaSession.metadata`, mirrors `media.state` → `navigator.mediaSession.playbackState`, installs `setActionHandler('play'|'pause'|'seek'|'nexttrack'|'previoustrack')` → emits `media.command` envelope to the owning napplet.
- **MEDIA-02**: `HostMediaBridge` interface + `createBrowserMediaBridge()` factory exported from `@kehto/services`. Reference browser impl satisfies the interface. `createMediaService({ hostBridge })` accepts an optional override.
- **MEDIA-03**: `apps/demo/napplets/media-controller` demo napplet exercising `mediaCreateSession` + `mediaReportState` + `mediaOnCommand`.
- **E2E-13**: `tests/e2e/media-controller.spec.ts` Layer-B spec — drives play/pause, asserts DOM sentinel AND `navigator.mediaSession.playbackState` + `.metadata.title`.
- **Iteration-loop**: `pnpm clean && pnpm build && pnpm test:e2e` recorded in `27-ITERATION-LOG.md` with delta from Phase 26 baseline (48 → 49, +1 E2E-13).

Out of scope:
- **OS-level native media daemons** (Electron MediaSession, Tauri `globalShortcut`-style media-keys) — deferred past v1.4 per REQUIREMENTS.md Future Requirements. Ship interface + browser reference impl only.
- **Shell-owned AudioContext or audio-stream routing** — napplets own their own `<audio>` elements; shell mirrors to MediaSession but does not process audio.
- **Layer-A upgrade of `nub-media.spec.ts`** — that graduation is Phase 28's E2E-14.
- **README / docs updates** — `packages/services/README.md` + `apps/demo/README.md` edits belong to Phase 28's DOCS-05/06.

</domain>

<decisions>
## Implementation Decisions

### Area 1: Real Backend Implementation Model (ACCEPTED)

- **Wire protocol**: Reuse existing `@napplet/nub-media@^0.2.1` envelopes — no new SDK methods, no wire-protocol additions. Napplet sends `media.session.create` / `media.session.update` / `media.state`; shell sends `media.command` / `media.controls` (already declared in the SDK). Parallel to Phase 26 KEYS-03's "reuse nub-keys" discipline.
- **Web Audio scope**: Shell does NOT own an `AudioContext`. The service mirrors `media.state.status` → `navigator.mediaSession.playbackState` and `media.session.update.metadata` → `navigator.mediaSession.metadata`. Napplets continue to own their own `<audio>` elements; the shell is a MediaSession **reflection** surface only.
- **Silent-audio prime**: Shell installs a minimal silent `<audio>` element (`autoplay=false`, programmatically `.play()`'d when a session becomes active). Without a playing audio element in the host page/frame, most browsers refuse to render OS media controls. A short silent loop primes the API. The element is WebKit-compatible (4 kHz silent WAV data-URL); cleaned up on last-session-destroy.
- **Multi-session semantics**: Last-active-wins. Track all `media.session.create` calls in a `Map<sessionId, {windowId, metadata, state}>`; the most-recently-updated (or most-recently-`media.state`-reported) session's metadata/state populates the browser's singleton `navigator.mediaSession`. Internal `activeSessionId` tracked for command-routing (action handlers always dispatch `media.command` to the owning napplet of the active session).

### Area 2: HostMediaBridge Interface + Override Model (ACCEPTED)

- **Interface shape** — OS-aware with browser default, mirroring `HostKeysBridge`:
  ```ts
  export interface HostMediaBridge {
    setMetadata(sessionId: string, metadata: MediaMetadata): void;
    setPlaybackState(sessionId: string, state: 'playing' | 'paused' | 'stopped' | 'buffering'): void;
    onAction(callback: (sessionId: string, action: MediaAction, value?: number) => void): () => void;
    setActiveSession?(sessionId: string | null): void;  // optional; browser impl tracks internally
    destroySession?(sessionId: string): void;           // optional; browser impl cleans up silent-audio on last session
  }
  ```
  Browser impl implements all five (optional fields included). Electron/Tauri impls could omit `setActiveSession` and override action-handler attachment to use OS-native hooks.
- **Override model**: Both paths supported:
  1. `createMediaService({ hostBridge: customBridge })` — factory accepts optional bridge override.
  2. `runtime.registerService('media', customHandler)` — wholesale replacement, same as today's stub-service override convention (preserved verbatim from Phase 26 KEYS-02).
- **Barrel exports** (`packages/services/src/index.ts`):
  - `HostMediaBridge` type
  - `MediaAction` re-export (for host-app type consumption) — already part of nub-media, but convenience re-export keeps Phase 26 parity for ergonomics
  - `createBrowserMediaBridge()` factory (extracted from `createMediaService`'s internal browser logic)
  - `MediaServiceOptions` (already exported)
- **ACL caps**: Reuse existing `media:control` + `media:session` capabilities (already wired in `shell-host.ts:1059`). No new cap strings. Phase 27 promotes enforcement from stub-scope to real-scope; Phase 20/21 wiring is already correct.

### Area 3: Demo Napplet + E2E Strategy (ACCEPTED)

- **Napplet UX** (`apps/demo/napplets/media-controller/src/main.ts`):
  - `#media-controller-status` — transitions `connecting... → authenticated → session-ready → playing | paused`
  - `#media-controller-play` / `#media-controller-pause` — buttons; click triggers `mediaReportState({ status: 'playing'|'paused' })`
  - `#media-controller-command-count` — integer counter incremented on each shell→napplet `media.command` delivery (evidence of reverse path)
  - `#media-controller-last-command` — text of most-recent command (e.g., `"play"`, `"pause"`)
  - Silent-loop `<audio>` element inside the napplet iframe — napplet's own playable surface; exercises actual audio pipeline end-to-end
- **Demo metadata** (hard-coded): `{ title: 'Kehto Demo Track', artist: 'v1.4 Media', mediaType: 'audio' }`. No artwork — artwork is optional per `MediaMetadata`; documented extension surface belongs to Phase 28 DOCS-05.
- **E2E dual-path assertion** (`tests/e2e/media-controller.spec.ts`):
  1. DOM sentinel path: `await expect(page.locator('#media-controller-status')).toContainText('session-ready')`; click `#media-controller-play`; assert `toContainText('playing')`; click `#media-controller-pause`; assert `toContainText('paused')`.
  2. Browser-API path (via `page.evaluate` inside the demo page context): `navigator.mediaSession.metadata.title === 'Kehto Demo Track'` and `navigator.mediaSession.playbackState === 'playing' | 'paused'` after state transitions.
  - Spec uses `demoBeforeEach` + status-sentinel wait (following Phase 26's `:4174` pattern — `__nappletReady__` is NOT installed on the demo port).
- **Capability-grant hook**: `window.__grantMediaControl__(windowId?) → boolean` installed in `bootShell()`. Scoped to media-controller napplet only (not generic). Returns `true` on successful grant, `false` when napplet not-yet-loaded or not-yet-authenticated so the Playwright spec can retry gated on the `#media-controller-status = 'session-ready'` sentinel. Exact Phase 26 `__grantKeysForward__` parallel.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/services/src/media-service.ts` (stub) — factory + session-lifecycle handler exist. Replace stub body with bridge-backed real impl.
- `packages/services/src/media-service.test.ts` — existing unit tests (stub-scope); augment with real-bridge tests.
- `packages/services/src/index.ts` — add `HostMediaBridge` + `createBrowserMediaBridge` exports.
- `@napplet/nub-media@^0.2.1` (installed) — declares all 8 envelope types (`MediaSessionCreateMessage`, `MediaStateMessage`, `MediaCommandMessage`, etc.), plus SDK helpers (`mediaCreateSession`, `mediaReportState`, `mediaOnCommand`). Reuse verbatim.
- `@napplet/sdk@^0.2.1` — exposes the nub-media helpers; media-controller napplet consumes via the generic SDK dispatch mechanism. No new SDK methods required.
- Phase 26 demo-napplet scaffolding precedent (`apps/demo/napplets/hotkey-chord/`) — directory structure, `package.json`, `index.html`, `src/main.ts`, `vite.config.ts`. Copy the topology.
- `bootShell()` in `apps/demo/src/shell-host.ts` — `window.__grantKeysForward__` pattern at the end of the function; mirror by adding `window.__grantMediaControl__`.

### Established Patterns
- Services factory pattern: `createXService(options: XServiceOptions): ServiceHandler` — `hostBridge` is a new optional field of `MediaServiceOptions`.
- Napplets use `@napplet/sdk` envelope handling only (no raw `window.addEventListener('message')`, no `BusKind`, no Math.random correlation IDs — SDK owns those).
- `demoBeforeEach` + status-sentinel wait (`:4174` demo port, no `__nappletReady__`). Chord from Phase 26 (`26-04-PLAN.md`).
- turbo task `build:napplets` picks up new napplet dirs via glob; no explicit `turbo.json` edit needed (Phase 26 precedent).
- Anti-term hygiene grep: `window.nostr|signer-service|BusKind|kind === 29001|kind === 29002|core-compat` MUST return zero matches across v1.4-touched paths.
- Docblock-quoted anti-feature literals cause false grep positives (Phase 26 Rule-1 fix). Describe anti-features in prose, not literal token quotations.

### Integration Points
- `apps/demo/src/shell-host.ts`:
  - Line ~457: `const mediaService = createMediaService({ onSessionCreate: ... })` stub — upgrade to `createMediaService({ hostBridge: createBrowserMediaBridge() })` (or omit `hostBridge` to use the default browser bridge).
  - Line 111: `STUB_ONLY_SERVICES: ['media']` — empty to `[]` after Phase 27 (keys already graduated). This retires stub-scope topology for the last-remaining stub service.
  - Line 125: `DEMO_NAPPLETS` array grows by 1 (+ `media-controller`).
  - Line 1059: `'media:control': relay.runtime.aclState.check(pk, dTag, hash, 'media:control')` ACL check — already wired; no change needed.
  - `bootShell()` tail: install `window.__grantMediaControl__(windowId?) → boolean` scoped to `media-controller` origin.
- `apps/demo/napplets/media-controller/` — new napplet dir.
- `packages/services/src/index.ts` — add type export (`HostMediaBridge`) + factory export (`createBrowserMediaBridge`).
- `tests/e2e/media-controller.spec.ts` — new Layer-B spec.
- `tests/e2e/demo-boot.spec.ts` — stub-assertion update (cascaded topology change — `STUB_ONLY_SERVICES` drops to empty; matches Phase 26's `demo-boot.spec.ts` fix pattern; in-scope for Phase 27).

</code_context>

<specifics>
## Specific Ideas

- **Silent-audio data URL**: `data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=` (4kHz, 44-byte silent WAV). Hosted inline, not fetched from network — zero network dependency for MediaSession prime.
- **ActionHandler matrix**: Install `setActionHandler('play')`, `setActionHandler('pause')`, `setActionHandler('seektoNtrack')`, `setActionHandler('previoustrack')`, `setActionHandler('seekto')` — each converts to a `media.command` envelope with `action: 'play'|'pause'|'next'|'prev'|'seek'` + optional `value` from `seekTime`.
- **Fallback handling**: Runtime `runtime.ts:939` currently emits fallback `media.session.create.result` when no service registered. Phase 27 registers the real service, so fallback path becomes dormant. No runtime change needed; document in `27-04-ITERATION-LOG.md`.
- **demo-boot.spec.ts delta**: Expect `STUB_ONLY_SERVICES` to be `[]` (empty) — cascaded update matching Phase 26's `keys` graduation pattern. In-scope for Phase 27 per the 26-04 precedent ("cascaded topology-change test updates are in-scope for the phase that changed the topology").
- **Test chord for play/pause shortcut (optional)**: Not in scope for Phase 27; could be a nice cross-phase integration (hotkey-chord sends `Ctrl+Shift+Space` → triggers media-controller play/pause) but belongs to a future milestone or Phase 28 docs example.
- **MediaSession browser support**: Chromium (demo browser) supports it. Firefox partial. Safari partial. Spec asserts on Chromium only (Playwright default) — documented as browser-scope limitation.

</specifics>

<deferred>
## Deferred Ideas

- **Electron / Tauri reference impls** — defer to v1.5+ or host-app example repos per REQUIREMENTS.md Future Requirements.
- **Shell-owned AudioContext / audio-stream routing** — out of v1.4 scope; would require iframe-audio-stream hoisting.
- **Artwork support in demo metadata** — deferred to Phase 28 DOCS-05 (documented as extension surface, not exercised by Phase 27 demo).
- **Cross-napplet media integration** (e.g., hotkey-chord triggers media-controller) — nice-to-have cross-demo integration; out of Phase 27 scope.
- **Multi-session UI surface in the shell** — demo renders no shell-level "now-playing" panel; napplet-internal DOM sentinels are the evidence surface for E2E-13.
- **Per-session volume orchestration** — the SDK supports `media.state.volume`; Phase 27 mirrors it internally but does not wire shell-level volume UI.

</deferred>
