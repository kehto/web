---
phase: 113-service-authorization-boundaries
plan: "10"
subsystem: webrtc-authorization
tags: [webrtc, firewall, paja, signaling]
requires: [113-02]
provides: [approved-webrtc-signaling-plan, revocable-peer-sessions]
affects: [114]
tech-stack:
  added: []
  patterns: [plan-approve-execute, source-owned-session]
key-files:
  modified:
    - packages/services/src/webrtc-service.ts
    - packages/paja/src/browser-webrtc.ts
decisions:
  - Non-empty configured ICE/TURN endpoints fail closed until Firewall defines a typed endpoint scope.
  - Opaque injected peer factories are rejected before a runtime-approved plan exists.
metrics:
  completed: 2026-10-17
status: complete
---

# Phase 113 Plan 10: WebRTC Authorization Summary

WebRTC now plans host-owned signaling destinations before approval and closes all source-owned peer work on revocation.

## Protocol Authority

Checked the complete NAP-WEBRTC draft at `napplet/naps` PR #59 head
`69523e8cf44c8653155c5e77d25340d4ea3d0887` and NIP-5D PR #2303 head
`5560820fa4f37f45b8ab742a11aeb3001b17dc67`. The implementation retains canonical
`webrtc.open`, `webrtc.send`, `webrtc.close`, and pushed `webrtc.event` envelopes;
raw SDP, ICE, signaling payloads, and peer handles remain host-private.

## Delivered

- Added a pure `WebrtcOpenPlan` that snapshots signaling relay URLs and a host-private peer or room resource before controller use.
- Composed interface, resource, and normalized WebSocket signaling-origin requirements through `ServiceRuntimeContext.authorizeOperation` before peer creation, subscription, signing, or signaling publication.
- Propagated the approval signal into Paja sessions; revocation physically closes peer connections and signaling subscriptions while stale callbacks cannot emit to the retired source.
- Rejected opaque injected peer factories. A typed factory must declare ICE/TURN endpoints; the current host policy rejects non-empty declarations because Firewall origin scopes do not model `stun:` or `turn:` safely.
- Preserved the Phase 114 boundary: this work governs host-mediated WebRTC and does not claim to constrain direct iframe network traffic.

## Evidence

- `9b9e95e5` `feat(webrtc): approve mediated peer setup`
- `3cf50656` includes the corresponding Paja browser-adapter signaling snapshot wiring, committed concurrently with the coordinator's LINK revocation repair.
- `pnpm exec vitest run packages/services/src/webrtc-service.test.ts packages/paja/src/browser-webrtc.test.ts` — 11 passed.
- `@kehto/services` type-check is blocked by concurrent `intent-service.ts` ApprovalSignal/AbortSignal drift and media-service test implicit parameters.
- `@kehto/paja` type-check is blocked downstream because the concurrent services errors prevent generation of `@kehto/services` declarations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security] Rejected configured ICE/TURN endpoints without a typed Firewall scope**
- **Found during:** Task 1 protocol and Firewall scope review.
- **Issue:** Treating `stun:` or `turn:` as an HTTP/WebSocket origin would approve a different resource than the peer factory can contact.
- **Fix:** Non-empty explicitly declared ICE/TURN endpoints return the bounded canonical error `configured ICE/TURN endpoints unsupported by host policy` before approval or controller use.
- **Files modified:** `packages/services/src/webrtc-service.ts`, `packages/paja/src/browser-webrtc.ts`.
- **Commit:** `9b9e95e5`.

## Deferred Integration Gates

Concurrent service work currently blocks aggregate services/Paja type checks. The focused WebRTC behavior suite is green; the Phase coordinator owns the shared type failures described above.

## Self-Check: PASSED

The listed implementation files and evidence commit exist on the phase branch.
