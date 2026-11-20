---
"@kehto/services": patch
"@kehto/runtime": patch
---

Report `capacity`, `busy` and `unavailable` approval outcomes as host conditions, not policy denials (kehto/web#513). CVM, OUTBOX, UPLOAD, WEBRTC, SERIAL, BLE, IDENTITY, THEME, COMMON, MEDIA, INTENT and NOTIFY use `approval capacity reached` / `approval busy` / `approval unavailable` (NOTIFY busy is `rate limited`); COUNT uses `count-unavailable`, DM `unavailable`, LISTS `list-unavailable`, FS `io-error`, GAMEPAD `unavailable`, and LINK keeps `status: "denied"` with the approval reason in `error`. Runtime `relay.*` reports `approval busy` and `approval unavailable` instead of `relay authorization unavailable or denied`.
