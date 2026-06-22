---
"@kehto/runtime": minor
"@kehto/shell": minor
"@kehto/services": minor
"@kehto/paja": minor
"@kehto/playground": minor
---

Add NAP-WEBRTC runtime parity.

The runtime now dispatches the `webrtc` domain, `@kehto/services` exports a reference service for shell-mediated WebRTC open/send/close sessions and host-pushed events, shell capabilities can advertise NAP-WEBRTC, and Paja/playground hosts register deterministic WebRTC support.
