---
status: resolved
trigger: User supplied Funclet NAP-MEDIA reproduction in deployed Paja
created: 2026-10-27
updated: 2026-10-27
---

## Symptoms and evidence

Funclet artifact SHA-256 66f0973c4361d99d7cef612c4a0f7c0501c02b414d975e4607feaef0a575b8f7, address 35129:3aa5817273c3b2f94f491840e0472f049d0f10009e23de63006166bca9b36ea3:n-6b7a37cac1d.
Clicking Omarchy Radio on deployed Paja returns unsupported owner mode.
Captured request: owner shell, source URL https://radio.cliamp.stream/omarchy/stream, metadata title Omarchy Radio/mediaType audio, live true, autoplay false.
Funclet uses the retained sendCommand alias after capabilities delivery.
PR #354 fixes owner support but buffers the entire resource before playback, so open-ended radio still cannot start.

## Authority

NAP-MEDIA draft PR #10 at napplet/naps@7806f438530251fce5129f8e6239d6b642278759 rechecked unchanged. Shell owns source fetch policy and output lifecycle; live sources may omit seeking. Streaming transport is host-internal, without new NAP-RESOURCE wire messages.

NAP-RESOURCE PR #80 at ae5b9c64ab8a4d8909f288829a01e99d6bd713bc confirms atomic wire results only. Its newer wire encoding/bulk-shape changes are outside this media task. Browser-only DNS-time IP enforcement remains a documented host-policy limitation; the new transport rejects literal private addresses and redirects but cannot replace a production DNS-aware resolver.

## Current Focus

root_cause: Atomic resource.bytes waits for EOF, so an open-ended radio source never becomes playable.
resolution: Implemented in ae738167 and verified for PR #354.

## Resolution and verification

Added host-only ResourceService.openStream through the existing endpoint origin-grant decision. Both hosts supply a public-HTTPS, redirect-free, credential-free browser stream resolver with MP3/ADTS byte classification. Live MediaSource playback applies read backpressure above 30 seconds ahead, 64 KiB appends and 15-second history eviction; teardown aborts the response and revokes output.

- Same Funclet artifact downloaded from Blossom and verified against its SHA-256, then served unchanged in local Paja.
- Clicking Omarchy Radio reached ON AIR against the real https://radio.cliamp.stream/omarchy/stream endpoint. At 112.34 seconds, playback was advancing and buffered range was [95.29, 115.88], proving old audio eviction. Host Pause paused the element and Close session removed it.
- All five focused browser cases pass, including open-ended real MP3 HTTP responses in both hosts, Funclet's legacy sendCommand ordering, disabled live seeking, reader cancellation and playground origin denial.
- Four new unit cases cover split-prefix streaming before EOF, upstream cancellation, MIME spoofing, private/credentialed URL rejection and endpoint grants/abort identity.
- No signed artifact bytes or app implementation were edited. Deployment remains a later merge/deploy step.
- Closing gates pass: build, type-check, strict docs, 2,307 unit tests across 182 files and all 155 browser tests. Quality score 95/100 matches the original baseline diagnostics; no rules changed. Focused backend tests were rerun after adding live-stop/replay assertions and pass.
