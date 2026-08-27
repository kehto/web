# Phase 95 Context: NAP-LINK Runtime Parity

## Scope

Implement one NAP: `link` / `NAP-LINK`.

Out of scope:

- `common`
- `lists`
- `ble`
- `webrtc`
- `serial`

## Canonical References

- `/home/sandwich/Develop/napplet/packages/nap/src/link/types.ts`
- `/home/sandwich/Develop/napplet/packages/nap/src/link/shim.ts`
- `/home/sandwich/Develop/napplet/packages/nap/src/link/sdk.ts`

## Decisions

- Advertise `link` only when a host wires link behavior, matching the existing `upload` and `intent` capability-gate pattern.
- Implement `link` as a service-backed NAP domain in `@kehto/services`; runtime should only route and not own browser navigation policy.
- Default reference service must deny unsafe or malformed URLs before calling host code.
- Paja gets deterministic behavior suitable for local authoring and tests.
- Playground gets a small dedicated napplet so Playwright can prove real shim/helper use, not just unit-level message handling.

## Existing Patterns

- Service-backed domains route through `packages/runtime/src/domain-handlers.ts` via `handleServiceOnlyMessage`.
- Capability advertisement lives in `packages/shell/src/shell-init.ts`.
- Optional host backends use shell adapter hooks (`upload`, `intent`) to decide capability exposure.
- Paja service wiring lives in `packages/paja/src/browser-host.ts`.
- Paja static parity guard lives in `packages/paja/src/parity.ts` and `packages/paja/src/parity.test.ts`.
