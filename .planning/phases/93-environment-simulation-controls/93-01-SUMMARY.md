# Summary 93-01: Dev Runtime Simulation Controls

## Completed

- Added a normalized `DevRuntimeSimulation` schema with defaults and validation for capability toggles, ACL/firewall metadata, identity mode, relay mode, storage/cache modes, upload mode, media/notification availability, config values, theme values, intent, and CVM.
- Added JSON config-file loading and nested option merging so CLI flags and config files share the same raw option contract.
- Extended the CLI with focused simulation flags and a concise simulation summary in CLI output.
- Added an optional `@kehto/shell` capability filter hook so disabled dev-runtime domains are removed from the production `shell.init` capabilities instead of being represented only in local metadata.
- Wired the browser host service adapters to simulation state for fixed identity, relay/outbox, config, theme, notify, media, upload, intent, and CVM behavior.
- Added compact host chrome for simulation state: a theme selector in the top bar and a simulation summary in the bottom bar.
- Extended focused Playwright coverage to prove non-default simulation config reaches `shell.init` and service responses, and that the compact theme control survives iframe reload.

## Verification

- `pnpm --filter @kehto/shell build`
- `pnpm --filter @kehto/dev-runtime type-check`
- `pnpm --filter @kehto/dev-runtime test:unit`
- `pnpm vitest run --config vitest.config.ts packages/shell/src/shell-init.test.ts`
- `pnpm --filter @kehto/dev-runtime build`
- `npx playwright test tests/e2e/dev-runtime-single-window.spec.ts --project=chromium`
- `pnpm docs:check`
- `pnpm build`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm dlx aislop@0.12.0 scan --changes --base HEAD`
- `git diff --check`

## Follow-up

- Phase 94 owns final full-suite verification, generated docs/API checks, release-readiness sweep, branch push, and PR.
