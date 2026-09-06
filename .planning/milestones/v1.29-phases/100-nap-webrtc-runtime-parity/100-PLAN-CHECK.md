# Plan Check: 100-01 NAP-WEBRTC Runtime Parity

## Verdict

Approved.

## Checks

- Scope is one NAP only: `webrtc`.
- Contract source is current `@napplet/nap@0.20.0` / `@napplet/core@0.20.0`.
- No new dependencies required.
- Shell-owned WebRTC session boundary preserves host control over signaling, SDP, ICE, peer connections, and policy.
- Verification covers unit, static, playground Playwright, docs, changeset, and full repo gates.

## Risk Notes

- Real WebRTC networking is intentionally host-owned and out of reference-service scope. The deterministic service proves the NAP request/result/event contract without introducing browser or signaling dependencies.
- Raw postMessage listener in `webrtc-demo` must be explicitly allowlisted in the NIP-5D conformance policy, matching prior shell-owned result demo patterns.
