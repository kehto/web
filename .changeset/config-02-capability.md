---
"@kehto/acl": minor
---

NUB-CONFIG (v1.7 Phase 39): add `config:read` capability and extend `resolveCapabilitiesNub` for the `config.*` domain.

Sender gate: `config:read` for all napplet-originated config requests (`config.get`, `config.subscribe`, `config.unsubscribe`, `config.registerSchema`, `config.openSettings`).

Recipient gate: `config:read` for shell-originated config pushes (`config.values`, `config.registerSchema.result`, `config.schemaError`) — napplets without the cap never see the pushes.

Anti-overlap with NUB-STORAGE: CONFIG is shell-managed per-napplet configuration (napplet reads, shell writes). STORAGE remains the general key-value surface. See `packages/services/src/config-service.ts` (Plan 39-02) for the scope boundary documentation.

Additive — no breaking changes. Minor bump because the public capability surface expanded.
