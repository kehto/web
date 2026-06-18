---
quick_id: 260618-l4w
slug: add-nap-and-nip-5d-conformance-guardrail
status: complete
commit: 7e829c3
---

# Summary

Added NAP-RELAY subscribe conformance guardrails so canonical relay hints cannot be implemented in one kehto surface while being dropped elsewhere.

## Completed

- Wired `relay.subscribe` `relay` hints through `createRelayPoolService`, `createCoordinatedRelay`, and the playground relay service.
- Added service/playground behavioral tests proving explicit relay hints bypass relay selection.
- Added a static NIP-5D conformance guard that pins the canonical installed `@napplet/nap` `RelaySubscribeMessage` fields and checks runtime/services/playground/test surfaces.
- Updated `AGENTS.md` with an explicit NAP/NIP-5D drift checklist for future agents.

## Verification

- `pnpm exec vitest run tests/unit/nip5d-conformance-guard.test.ts tests/unit/playground-relay-service.test.ts packages/services/src/relay-pool-service.test.ts packages/services/src/coordinated-relay.test.ts` — 4 files, 18 tests passed
- `pnpm type-check` — passed
- `pnpm test:unit` — 73 files, 1059 tests passed
- `pnpm build` — passed
- `pnpm docs:check` — passed
- `pnpm test:e2e` — 66 tests passed
- `git diff --check` — passed

## Notes

- `npx aislop scan` completed with 0 errors and a healthy verdict, but reported pre-existing unrelated warnings in `theme-switcher-host.ts`, `shell-host.ts`, and `vite.config.ts`.
