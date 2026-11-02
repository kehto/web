---
"@kehto/shell": patch
---

Remove the whole WebRTC constructor surface from the napplet realm, not just
`RTCPeerConnection`. The injected prelude now sweeps every global whose name
starts with `RTC` (`RTCDataChannel`, `RTCSessionDescription`, `RTCIceCandidate`,
`RTCRtp*`, …) plus the legacy `webkit`/`moz`-prefixed aliases, each as a pinned,
non-writable `undefined`, before any napplet script runs. None has a
napplet-realm use: NAP-WEBRTC is mediated in the shell realm.
