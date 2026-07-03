---
status: in_progress
created: 2026-07-03
---

# Quick Task 260703-vfz: Chase Current NAP-OUTBOX Contract

## Objective

Align Kehto's NAP-OUTBOX implementation with upstream `napplet/naps` PR #32 after:

- `70515a5` removed caller-visible `strategy` and `live` options.
- `dcdb5e6` removed caller-visible `outbox.eose`.

## Tasks

1. Update service/router contracts and tests.
   - Files: `packages/services/src/outbox-service.ts`, `packages/services/src/relay-pool-outbox-router.ts`, related tests.
   - Action: remove napplet-facing strategy/live options while preserving runtime-owned relay routing and internal relay EOSE handling.
   - Verify: focused service/router tests and type-check.

2. Update ACL and conformance guards.
   - Files: `packages/acl/src/resolve.ts`, `packages/acl/src/resolve.test.ts`, `tests/unit/nip5d-conformance-guard.test.ts`.
   - Action: stop recognizing `outbox.eose` as a NAP-OUTBOX message and add a guard against reintroducing removed NAP-OUTBOX surface terms.
   - Verify: focused ACL/conformance tests.

3. Update docs and release metadata.
   - Files: package docs/READMEs/changelogs as needed, `.changeset`.
   - Action: remove stale caller-visible `strategy`, `live`, and `outbox.eose` wording.
   - Verify: docs check if docs changed, plus `git diff --check`.

## Validation

- `pnpm --filter @kehto/services test -- --run ...`
- `pnpm --filter @kehto/acl test -- --run ...`
- `pnpm test:unit`
- `pnpm type-check`
- `pnpm docs:check` if docs changed
- `pnpm dlx aislop@0.12.0 scan --changes --base origin/main`
- `git diff --check`
