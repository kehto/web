---
status: verifying
trigger: CI failing on PR 354
created: 2026-10-27
updated: 2026-10-27
---

## Evidence

PR head a2412911; CI run 40528580793. Build/types/docs and unit jobs pass. Playwright fails Paja audio and video playback; playground audio is flaky. All other browser tests, including live radio, pass.
Audio failures hang during mouse clicks or waiting for natural completion. Video metadata decodes but playback does not advance after Play.
The workflow installs Playwright's versioned Chromium, but playwright.config.ts always selects /usr/bin/chromium on Linux and system Google Chrome on macOS. Local system Chrome previously reproduced missed media clicks; Playwright-matched Chromium passed all 155 cases.

## Current Focus

root_cause: The OS-controls bridge loops an empty WAV with zero playable frames. Managed headless Chromium reproduces stalls in the media controls. CI also bypassed its installed browser through the system executable default.
next_action: Finish repeated media regressions and verify the exact pushed head in GitHub CI.

Managed Chromium reproduced the Paja audio failure locally (volume check stalled), so executable selection alone is insufficient. The OS-controls prime WAV has zero data frames and decodes with duration 0. Replacing it with one second of 4 kHz PCM silence is under test. A browser regression checks native decoded duration before interacting with the player.

Local default preview ports became occupied by an unrelated worktree's test run. Preserve that process; use a temporary config on ports 14173/14174 for this investigation.

## Verification

- Default managed Chromium reproduced failure before replacing the empty prime. With a one-second PCM clip, the same Paja case passed in 2.1 seconds. The test now proves a native decoded duration of one second before exercising controls.
- Build, type-check, 2,307 unit tests and strict docs pass. Browser tooling now uses Playwright's installed Chromium by default and retains the explicit executable environment override.

## Authority

NAP-MEDIA draft PR #10 head rechecked at 7806f438530251fce5129f8e6239d6b642278759. This investigation changes browser-test tooling, not protocol semantics.
