---
"@kehto/services": patch
"@kehto/mocks": minor
"@kehto/conformance": patch
---

NAP-WEBRTC revocation and after-close answers (napplet/naps#59 at `fb4dd6f0`):

- `createWebrtcService` now sends `closed` with reason `policy denied` for each
  live session when policy revokes WebRTC for a window (`onPermissionRevoked`,
  or an ACL block through `onCapabilityRevoked(windowId, null)`), then forgets
  the session. The draft lists "policy revokes the capability" among the
  `closed` triggers. Requests already in flight still get their result, and an
  open still waiting on approval gets `policy denied`. Window destroy stays
  silent.
- `@kehto/mocks`: the WebRTC mock now answers `webrtc.send`, `webrtc.sendBytes`
  and `webrtc.close` on an ended session with `session not found`, like the
  service. Before, it answered `session closed` to a send and succeeded on a
  second close. This is a minor bump because tests asserting the old answers
  will need updating. The mock also handles `onPermissionRevoked`.
- `@kehto/conformance` adds the `webrtc/event-closed-on-revoke` push and the
  `webrtc.revoke` host control.
