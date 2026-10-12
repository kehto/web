# kernl runtime film

An original 24-second, silent, 1200 × 1000 H.264 film. Abstract modules assemble,
real integration excerpts connect them, and browser captures show a working
Paja runtime loading the sample app and returning a theme response. All artwork
is procedural; no stock imagery, external fonts, or third-party footage.

## Reproduce

From the repository root, with dependencies installed, Chrome and ffmpeg available:

```sh
pnpm build
node scripts/build-paja-pages.mjs
PAGES_PREVIEW_PATH=/web/paja/ node scripts/serve-pages.mjs
# In another terminal:
node scripts/kernl-film/capture.mjs
node scripts/kernl-film/render.mjs
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` overrides the macOS Chrome path.
`KERNL_CAPTURE_URL` overrides the local Paja URL. Rendering is deterministic at
24 fps; capture content reflects the current Paja implementation. The capture
script verifies `shell.init` and `theme.get.result`, and writes the observed
message types to `captures/proof.json`. The sample is explicitly a local
unsigned development app, not a relay-published verified artifact.

Outputs: `web/assets/runtime-film.mp4`, `runtime-poster.jpg`, and
`runtime-film.vtt`. The page provides a transcript, native no-JavaScript playback,
pause/play, fullscreen, and a static poster for reduced motion. Autoplay is muted
and stops offscreen. Captions are available in the native fullscreen player.

## Storyboard

| Time | Scene |
| --- | --- |
| 0–6 s | Four isometric modules arrive and assemble: runtime, permissions, services, shell. |
| 6–11 s | `createShellBridge(adapter)` connects host backends to the runtime. |
| 11–16 s | `createThemeService({ initialTheme })` and `registerService('theme', service.handler)` connects an app service. |
| 16–21 s | Captured Paja session: sandboxed app connects, requests and receives its theme. |
| 21–24 s | kernl mark and “Your runtime. Your rules.” |

Code excerpts are intentionally partial, matching the existing host tutorial.
They require a real host adapter and the theme service import shown on the page.

## Protocol authority check

Checked `napplet/naps@e5308ac92cfd49e4fb026812c60886571515e219`,
`naps/NAP-SHELL.md` and `naps/NAP-THEME.md`, on 2026-10-12. Its shell environment exchange is now optional
and does not grant domains. This film records the existing released host's
exchange without claiming it is mandatory or that the host fully conforms to
that newer contract. Updating the runtime's older mandatory-shell behavior is
outside this brand and documentation change. The captured theme query/result agrees with NAP-THEME. No wire semantics are changed.
