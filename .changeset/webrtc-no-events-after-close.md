---
"@kehto/services": patch
---

`createWebrtcService` no longer delivers `webrtc.event` for a session after the
napplet sends `webrtc.close` (NAP-WEBRTC napplet/naps#59 @ fb4dd6f0: the shell
"MUST NOT deliver messages for an unknown sessionId"). Close takes the session
out of delivery before the host `close` hook runs, so teardown notifications
and late peer messages, state changes and stats are dropped; a failed close
keeps the session deliverable. `ctx.emit` also drops events for a sessionId the
window never opened, except early `state` updates while its open is pending.
