---
"@kehto/shell": minor
---

Neuter direct WebRTC egress in the injected napplet realm. No CSP directive
covers WebRTC, so an opaque-origin napplet could open an `RTCPeerConnection`
data channel and exfiltrate past `connect-src 'none'` (napplet/evil finding #1;
Delta Chat's webxdc write-up). The prelude now removes the whole WebRTC constructor
surface from the napplet realm before any napplet script runs — every `RTC*`
global plus the legacy `webkit`/`moz`-prefixed aliases — as a non-writable,
non-configurable `undefined`, so feature detection sees the
capability as absent and degrades.

NAP-WEBRTC is unaffected: its `RTCPeerConnection` runs in the shell realm, and
napplets reach it only through the mediated `window.napplet.webrtc` domain. This
does not reach un-CSP'd `srcdoc` grandchild frames, which share the Chromium
per-process connection pool with the shell and are tracked as a bounded gap in
docs/policies/NIP-5D-CONFORMANCE.md ("Direct WebRTC egress"). `@kehto/paja`
inherits the hardened prelude through its `@kehto/shell` dependency.
