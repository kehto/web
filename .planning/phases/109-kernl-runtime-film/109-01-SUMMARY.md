---
phase: 109-kernl-runtime-film
plan: 01
status: complete
requirements-completed: [FILM-01, FILM-02]
---

# Runtime assembly film

Produced a 24-second H.264 MP4 at 1200×1000, 24 fps, approximately 1.5 MB.
The film joins isometric module assembly, real shell/service APIs, and captured
Paja behavior. The capture loads a local sample into a sandboxed iframe and
asserts shell.init and theme.get.result before recording evidence.

Included deterministic rendering source, captured frames and message proof,
poster, VTT captions, transcript, downloadable MP4, play/pause, fullscreen,
native no-JavaScript controls, and reduced-motion poster behavior. Browser
checks prove playback, pause retention, offscreen suspension, native fullscreen,
and captions availability. No third-party imagery, fonts, or video libraries.

Source audit corrected an existing tutorial's obsolete theme API. The website
and film now use initialTheme and service.handler. NAP-SHELL and NAP-THEME were
checked at napplet/naps@e5308ac92cfd49e4fb026812c60886571515e219. Theme
query/result is conformant; existing host mandatory-shell drift is documented
as outside this branding change. No runtime protocol behavior was changed.
