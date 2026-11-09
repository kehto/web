---
quick_id: 261101-ia2
slug: add-kehto-mocks-package-with-determinist
date: 2026-11-01
branch: feat/nap-mocks
status: complete
---

# Summary — `@kehto/mocks`

New package `packages/mocks` with deterministic, in-memory mocks for all 47
NAP documents in `napplet/naps` (master `43cb3a4e8555` plus every open PR head),
recorded per domain as `<DOMAIN>_SPEC_REF`.

- Core: `defineMockService` (route map → `ServiceHandler` + `mock` controls),
  seeded ids, clock/scheduler injection, `createMockNapServices`,
  `createMockNapEnvironment` (shared Nostr store + storage persistence +
  exposed-domain list).
- Kinds: 23 built-in `service` domains, 18 `extension` domains (incl. push-only
  `class`), `storage` adapter, `inc`/`shell`/`connect` runtime-owned,
  `class-1`/`class-2` posture.
- Transfer domains (torrent, nzb, soulseek, resource, upload, fs, blossom,
  hashtree, git) use the Linux distribution image catalog only.
- Skills: `skills/use-nap-mocks` (implementers), `skills/maintain-nap-mocks`
  (agents) with `scripts/audit-naps.mjs` (current/stale/retired/missing).
- Docs: `docs/packages/mocks.md`, README, index/sidebar/API rows, generated
  domain tables (`scripts/render-domain-table.mjs`).
- Tests: per-domain suites, registry inventory, environment, audit script.

Spec deviations recorded in module headers: NAP-CLASS has a `class.assigned`
push (extension, push-only); NAP-CONNECT defines no wire protocol
(runtime-owned helpers instead of a service).
