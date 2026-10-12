---
status: passed
score: 2/2
---

# Phase 109 verification

- FILM-01: ffprobe confirms H.264, 1200×1000, 24 fps, 24 seconds.
  `scripts/kernl-film/scene.js` supplies five timed scenes and real API excerpts.
  `captures/proof.json` records ready status, shell.ready/init and theme.get/result.
  Browser playback confirms the delivered MP4 decodes and advances.
- FILM-02: Seven site browser tests include reduced motion, manual playback,
  pause retention, offscreen suspension, keyboard navigation, native fullscreen,
  captions, and no-JavaScript fallback. Artifact route checks include MP4/VTT
  status and MIME types. Transcript and download remain ordinary HTML links.
