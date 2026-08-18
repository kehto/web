---
phase: 97
milestone: v1.25
title: NAP-LISTS Runtime Parity
status: planned
created: 2026-06-22T22:24:33+02:00
---

# Phase 97 Context: NAP-LISTS Runtime Parity

## Scope

Implement exactly one missing recent `@napplet/nap` domain: `lists`.

Authoritative source:

- `/home/sandwich/Develop/napplet/packages/nap/src/lists`
- `/home/sandwich/Develop/napplet/packages/core/src/types/lists.ts`

## Decisions

- D-01: Keep list mutation authority in the shell/runtime. Napplets send semantic list refs/items only.
- D-02: Advertise `lists` only when a host wires a lists backend.
- D-03: Use the normal service-only runtime path, matching `link` and `common`.
- D-04: Reference service hook absence must return structured unsupported results, not throw.
- D-05: Paja and playground use deterministic in-memory behavior for proof, not real relay publishing.

## Out Of Scope

- NAP-BLE, NAP-WEBRTC, NAP-SERIAL.
- Real NIP-51 relay query/sign/publish implementation inside Kehto's reference service.
- New dependencies.
- Paja UI expansion beyond existing chrome.

## Verification Target

Focused unit tests cover shell advertisement, runtime dispatch, and service envelopes. Playground Playwright proves `lists.supported`, `lists.add`, and `lists.remove` through the shell path. Full gates run before PR.
