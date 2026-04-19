---
phase: 27-real-media-backend
plan: 03
subsystem: demo
tags: [media-controller, nub-media, mediaCreateSession, mediaReportState, mediaOnCommand, STUB_ONLY_SERVICES, shell-host, MEDIA-03]

requires:
  - phase: 27-real-media-backend
    plan: 01
    provides: Real createMediaService with navigator.mediaSession mirror + media.command emission
  - phase: 27-real-media-backend
    plan: 02
    provides: HostMediaBridge interface + createBrowserMediaBridge factory
  - phase: 26-real-keys-backend
    plan: 03
    provides: hotkey-chord napplet structural template + topology.ts dynamic frame-container pattern

provides:
  - apps/demo/napplets/media-controller/ napplet (5 files) — SDK-driven, mediaCreateSession + mediaReportState + mediaOnCommand, zero raw postMessage
  - DEMO_NAPPLETS 10th entry for media-controller (topology.ts generates frame-container dynamically)
  - STUB_ONLY_SERVICES demoted to [] — all 8 non-stub NUB domains exercised end-to-end
  - window.__grantMediaControl__ host hook in bootShell() — pre-locks Plan 27-04 capability-gate
  - createMediaService onSessionCreate updated from stub log to real-backend log

affects:
  - 27-04 (E2E-13 Layer-B spec — uses __grantMediaControl__ hook + asserts DOM sentinels + navigator.mediaSession)

tech-stack:
  added:
    - "@napplet/nub-media@^0.2.1 (dependency of @kehto/demo-media-controller)"
  patterns:
    - D-04 init pattern (storage.getItem probe gates on AUTH, identical to hotkey-chord + feed napplets)
    - mediaCreateSession -> sessionId -> mediaOnCommand subscription pattern (SDK-owned correlation, no hand-rolled IDs)
    - Per-napplet grant-hook preinstallation (__grantMediaControl__ mirrors __grantKeysForward__ exactly)
    - topology.ts dynamic frame-container generation from DEMO_NAPPLETS (NO index.html edit — Plan 26-03 precedent)

key-files:
  created:
    - apps/demo/napplets/media-controller/package.json
    - apps/demo/napplets/media-controller/tsconfig.json
    - apps/demo/napplets/media-controller/vite.config.ts
    - apps/demo/napplets/media-controller/index.html
    - apps/demo/napplets/media-controller/src/main.ts
  modified:
    - apps/demo/src/shell-host.ts

key-decisions:
  - "media-controller napplet uses @napplet/nub-media helpers (mediaCreateSession, mediaReportState, mediaOnCommand) exclusively — zero raw window.addEventListener('message') calls, zero Math.random correlation IDs; SDK owns correlation + Promise resolution"
  - "STUB_ONLY_SERVICES demoted from ['media'] to [] in Plan 27-03 (not Plan 27-04) — the stub-only era ends at the point the real backend napplet is wired, not at the E2E spec"
  - "apps/demo/index.html NOT edited — topology.ts dynamically renders #media-controller-frame-container from DEMO_NAPPLETS at boot time; static div would duplicate ID (Plan 26-03 precedent confirmed)"
  - "__grantMediaControl__ mirrors __grantKeysForward__ verbatim: looks up media-controller by name from napplets Map, checks authenticated flag, calls aclState.grant with media:control cap"
  - "DEMO_METADATA hard-coded as { title: 'Kehto Demo Track', artist: 'v1.4 Media', mediaType: 'audio' } per UI-SPEC; no artwork field (deferred to Phase 28 DOCS-05)"

requirements-completed:
  - MEDIA-03

duration: 4min
completed: 2026-04-19
---

# Phase 27 Plan 03: media-controller Demo Napplet + Shell-Host Wiring Summary

**SDK-driven media-controller napplet (5 files) + DEMO_NAPPLETS 10th entry + STUB_ONLY_SERVICES = [] + __grantMediaControl__ host hook; all 8 non-stub NUB domains now exercised end-to-end**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-19
- **Completed:** 2026-04-19
- **Tasks:** 2
- **Files created:** 5 (napplet)
- **Files modified:** 1 (shell-host.ts)

## Accomplishments

- Scaffolded `apps/demo/napplets/media-controller/` with 5 files mirroring the hotkey-chord napplet structure: package.json (adds `@napplet/nub-media` dep), tsconfig.json (1:1 copy), vite.config.ts (`nappletType: 'demo-media-controller'`), index.html (5 DOM sentinels + silent-audio element), src/main.ts (D-04 AUTH probe + mediaCreateSession + mediaReportState + mediaOnCommand — 100% SDK-driven)
- Retired stub-only era: `STUB_ONLY_SERVICES` changed from `['media']` to `[]`; createMediaService `onSessionCreate` upgraded from `console.debug` stub-language to `console.info` real-backend log
- DEMO_NAPPLETS grows 9 → 10 entries; topology.ts auto-generates `#media-controller-frame-container` — NO apps/demo/index.html edit
- `window.__grantMediaControl__` host hook installed in `bootShell()` — exact structural twin of `__grantKeysForward__` from Plan 26-03; scoped to media-controller napplet, returns true/false, grants `media:control` capability
- Coverage-gate comment updated from "7 non-stub NUB domains" to "ALL 8 non-stub NUB domains"; Phase 26 → Phase 26 → Phase 27 heading
- `pnpm build` exits 0 with 22/22 tasks successful; 10 napplet `dist/index.html` artifacts produced

## Task Commits

1. **Task 1: Scaffold media-controller napplet** — `76e6c08` (feat)
2. **Task 2: Wire media-controller into demo shell** — `19ae118` (feat)

## Files Created/Modified

- `apps/demo/napplets/media-controller/package.json` — `@kehto/demo-media-controller`, private, `@napplet/nub-media@^0.2.1` dep alongside shim/sdk
- `apps/demo/napplets/media-controller/tsconfig.json` — ES2022, bundler, strict, DOM — verbatim copy of hotkey-chord
- `apps/demo/napplets/media-controller/vite.config.ts` — nip5aManifest with `nappletType: 'demo-media-controller'`
- `apps/demo/napplets/media-controller/index.html` — 5 DOM sentinels with correct initial text per UI-SPEC; `<audio>` silent-loop element (`data:audio/wav;base64,...`); `<meta name="napplet-napp-type" content="demo-media-controller">`
- `apps/demo/napplets/media-controller/src/main.ts` — D-04 AUTH probe -> `mediaCreateSession(DEMO_METADATA)` -> `setStatus('session-ready')` -> play/pause button wire -> `mediaOnCommand` subscription; `DEMO_METADATA = { title: 'Kehto Demo Track', artist: 'v1.4 Media', mediaType: 'audio' }`; zero raw postMessage listeners; zero Math.random correlation IDs
- `apps/demo/src/shell-host.ts` — STUB_ONLY_SERVICES `['media']` -> `[]`; DEMO_NAPPLETS 10th entry; createMediaService onSessionCreate stub -> real log; coverage-gate comment Phase 26 -> Phase 27; `__grantMediaControl__` hook in bootShell

## Decisions Made

- media-controller consumes `@napplet/nub-media` helpers directly (not via `@napplet/sdk` `media` namespace) per CONTEXT.md Area 1 decision to reuse SDK helpers verbatim.
- DEMO_METADATA hardcoded per UI-SPEC with verbatim strings: `title: 'Kehto Demo Track'`, `artist: 'v1.4 Media'`, `mediaType: 'audio'`.
- apps/demo/index.html NOT edited — topology.ts dynamically renders the frame-container div from DEMO_NAPPLETS (Plan 26-03 precedent).
- `__grantMediaControl__` hook is media:control specific (not a generic grant API) — mirrors `__grantKeysForward__` pattern exactly.
- pnpm-lock.yaml staged alongside napplet files in Task 1 commit (new `@napplet/nub-media` workspace dep resolves in lockfile).

## Deviations from Plan

None — plan executed exactly as written. All 5 files match the plan's action blocks verbatim. Shell-host.ts edits match all 5 specified edit blocks. Type-check + demo build + 10-napplet artifact count all pass on first attempt.

## Known Stubs

None. The napplet wires the real media backend end-to-end via SDK helpers. STUB_ONLY_SERVICES is now `[]`. No placeholder values, no hardcoded empties, no TODOs in any public surface. The only "stub" element is the silent-audio data URL — but that is intentional per CONTEXT.md Area 1 (shell mirrors MediaSession, napplets own their own audio elements; the silent WAV primes the OS transport surface).

## Self-Check

- `apps/demo/napplets/media-controller/package.json` — FOUND
- `apps/demo/napplets/media-controller/tsconfig.json` — FOUND
- `apps/demo/napplets/media-controller/vite.config.ts` — FOUND
- `apps/demo/napplets/media-controller/index.html` — FOUND
- `apps/demo/napplets/media-controller/src/main.ts` — FOUND
- `apps/demo/src/shell-host.ts` — FOUND (modified)
- Commit 76e6c08 — Task 1
- Commit 19ae118 — Task 2

## Self-Check: PASSED
