---
"@kehto/services": patch
---

`createWebrtcService` now forgets a session as soon as the backend's `closed`
event for it is delivered (napplet/naps#59 at `fb4dd6f0`: the shell "MUST NOT
deliver messages for an unknown sessionId"). Later events for it are dropped,
and a later `webrtc.send` or `webrtc.close` gets `session not found` without
reaching the host hooks. A `closed` reported while the open is still pending is
delivered right after the open result, and that session is never kept. A
failing close no longer brings back a session the backend closed in the
meantime.
