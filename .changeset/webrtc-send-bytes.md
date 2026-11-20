---
"@kehto/services": minor
"@kehto/paja": minor
"@kehto/conformance": patch
---

Carry NAP-WEBRTC byte payloads. `createWebrtcService` gains a `sendBytes` hook that receives the decoded bytes; the service rejects non-canonical base64 with `invalid request`, answers `payload too large` above the session's `maxPayloadBytes` (now enforced for `webrtc.send` too, on the serialized payload), drops non-canonical peer `bytes` events, and still answers `unsupported` without the hook. `encodeWebrtcBytes` / `decodeWebrtcBytes` are exported. Paja's default WebRTC controller sends `sendBytes` as one binary data-channel message, delivers incoming binary as `bytes` events, and reports `maxPayloadBytes`; the `soy-rtc/1` multiplayer profile stays JSON-only. The conformance Kehto target now supports `sendBytes`, and the WebRTC fixture checks that non-canonical bytes are rejected.
