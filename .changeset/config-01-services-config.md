---
"@kehto/services": minor
---

NUB-CONFIG reference service (v1.7 Phase 39 / 9th NUB domain).

New public surface: `createConfigService(options)`, `ConfigServiceOptions`, `ConfigService`, `ConfigSchemaValidation`.

Shell-side reference implementation of the canonical `@napplet/nub/config` wire protocol (published at `^0.2.1`). Handles `config.get`, `config.subscribe` / `config.unsubscribe`, `config.registerSchema`, `config.openSettings`. Exposes `publishValues(values)` for live fan-out to subscribed napplets.

Options-as-bridge pattern (v1.6 Decision 18): host apps provide `getValues` (required) and optional `registerSchema`, `openSettings`, `onSubscribe`, `onUnsubscribe` hooks.

**Scope boundary (CONFIG-04):** NUB-CONFIG is shell-managed per-napplet configuration. Shell writes, napplet reads. There is NO `config.set` wire message — that is intentional. Do NOT use this service as a general key-value store; NUB-STORAGE (`state:read` / `state:write`) remains the general KV surface. See `packages/services/src/config-service.ts` top-of-file for the full anti-overlap documentation.

Pairs with `@kehto/acl` `config:read` capability and `resolveCapabilitiesNub` `config.*` dispatch wiring (shipped in the same Phase 39 plan batch).

Additive — no breaking changes. Minor bump because the public service surface expanded.
