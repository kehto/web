# Summary 92-01: Dev Runtime NAP and Service Parity

## Completed

- Replaced the Phase 91 manual `shell.init` browser shim with a real `ShellBridge` and `@kehto/runtime` path in `@kehto/dev-runtime`.
- Registered the single iframe through `originRegistry` with generation-specific internal window ids so reloads receive fresh `shell.init` without adding more iframes or restarting the target app.
- Wired deterministic development service adapters for relay/outbox, storage, identity, keys, config, resource, theme, notify/notification, media, upload, intent, cvm, ACL, firewall, session state, and runtime persistence.
- Added parity metadata exports and a static guard that compares the current `@napplet/nap` web domain directories against the dev-runtime coverage model.
- Documented `shell` as the mandatory handshake domain and `ifc` as an upstream compatibility alias to `inc`, matching the current `@napplet/nap` source.
- Extended focused Playwright proof so the hosted fixture receives real replies for storage, config, theme, notify, identity, upload, intent, and cvm traffic.

## Verification

- `pnpm --filter @kehto/dev-runtime type-check`
- `pnpm --filter @kehto/dev-runtime test:unit`
- `pnpm --filter @kehto/dev-runtime build`
- `npx playwright test tests/e2e/dev-runtime-single-window.spec.ts --project=chromium`

## Follow-up

- Phase 93 owns typed CLI/config controls for changing the deterministic defaults: ACL, firewall, identity/signer, relay, storage, cache, upload, media, config, theme, intent, and cvm modes.
