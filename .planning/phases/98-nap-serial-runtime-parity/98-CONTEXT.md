# Phase 98 Context: NAP-SERIAL Runtime Parity

## Objective

Implement exactly one missing recent `@napplet/nap` domain: `serial` / `NAP-SERIAL`.

## Authoritative Contract

Inspected 2026-06-22 from packed npm artifacts:

- `@napplet/nap@0.20.0/dist/serial/types.d.ts`
- `@napplet/nap@0.20.0/dist/serial/sdk.d.ts`
- `@napplet/core@0.20.0` serial exports

Outbound messages:

- `serial.open` with `id` and `request`
- `serial.write` with `id`, `sessionId`, and byte `data`
- `serial.close` with `id`, `sessionId`, and optional `reason`

Inbound messages:

- `serial.open.result` with `id`, optional `session`, optional `error`
- `serial.write.result` with `id`, optional `error`
- `serial.close.result` with `id`, optional `error`
- `serial.event` with runtime-pushed state/data/closed event

## Constraints

- One NAP only: do not implement BLE or WebRTC in this milestone.
- No new dependencies.
- Serial device handles, OS paths, browser `SerialPort` objects, stream objects, permissions, chooser UI, lifecycle, reads, write ordering, and policy remain shell/runtime owned.
- Paja must keep minimal chrome.
- Playground proof must use the real shell path, not a napplet-local fake.

## Reusable Local Patterns

- Runtime service-only domains: `common`, `link`, `lists`
- Conditional shell capability hooks: `CommonHooks`, `LinkHooks`, `ListsHooks`
- Reference services: `common-service.ts`, `link-service.ts`, `lists-service.ts`
- Deterministic Paja services in `packages/paja/src/browser-host.ts`
- Raw-envelope demo exceptions documented in `docs/policies/NIP-5D-CONFORMANCE.md`

## Out Of Scope

- Real Web Serial API integration.
- Native serial backends.
- BLE or WebRTC.
- Direct hardware handle exposure to napplets.
