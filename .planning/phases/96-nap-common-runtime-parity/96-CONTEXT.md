# Phase 96 Context: NAP-COMMON Runtime Parity

## Scope

Implement one NAP: `common` / `NAP-COMMON`.

Out of scope:

- `lists`
- `ble`
- `webrtc`
- `serial`

## Canonical References

- `/home/sandwich/Develop/napplet/packages/nap/src/common/types.ts`
- `/home/sandwich/Develop/napplet/packages/nap/src/common/shim.ts`
- `/home/sandwich/Develop/napplet/packages/nap/src/common/sdk.ts`
- `/home/sandwich/Develop/napplet/packages/core/src/types/common.ts`

## Decisions

- Advertise `common` only when a host wires common behavior, matching optional service-backed domain patterns.
- Implement `common` as a service-backed NAP domain in `@kehto/services`; runtime should only route and not own social-policy decisions.
- Public NIP-19 encode/decode can be deterministic in the reference service. Social/profile actions use host hooks or return structured `ok: false` results.
- Paja gets deterministic behavior suitable for local authoring and tests.
- Playground gets a small dedicated napplet so Playwright can prove real shell-mediated message handling.

## Existing Patterns

- Service-backed domains route through `packages/runtime/src/domain-handlers.ts` via `handleServiceOnlyMessage`.
- Capability advertisement lives in `packages/shell/src/shell-init.ts`.
- Optional host backends use shell adapter hooks (`upload`, `intent`, `link`) to decide capability exposure.
- Paja service wiring lives in `packages/paja/src/browser-host.ts`.
- Paja static parity guard lives in `packages/paja/src/parity.ts` and `packages/paja/src/parity.test.ts`.
