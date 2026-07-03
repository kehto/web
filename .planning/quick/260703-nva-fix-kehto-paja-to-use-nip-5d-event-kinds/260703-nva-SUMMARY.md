---
id: 260703-nva
status: complete
completed: 2026-07-03
commit: e8cedd0
---

# Quick Task 260703-nva: Fix Paja NIP-5D Event Kinds

## Result

Paja runtime pointer resolution now uses the canonical `@kehto/nip/5d` NIP-5D manifest kind set (`5129`, `15129`, `35129`) instead of accepting only the named/addressable kind. The existing singular `PAJA_NAPPLET_MANIFEST_KIND` export remains as the named/addressable compatibility alias, and `PAJA_NAPPLET_MANIFEST_KINDS` exposes the full accepted set.

## Changed Files

- `packages/paja/src/runtime-resolver.ts`
- `packages/paja/src/runtime-resolver.test.ts`
- `packages/paja/src/index.ts`
- `docs/packages/paja.md`
- `.changeset/paja-nip5d-manifest-kinds.md`

## Verification

- `pnpm --filter @kehto/paja test -- runtime-resolver` — 10 files / 41 tests passed
- `pnpm --filter @kehto/paja type-check` — passed
- `pnpm --filter @kehto/paja build` — passed
- `pnpm test:unit` — 100 files / 1282 tests passed
- `pnpm docs:check` — passed
- `pnpm build` — passed
- `pnpm type-check` — passed
- `pnpm dlx aislop@0.12.0 scan --changes --base HEAD` — 100/100, no issues
- `git diff --check` — passed

## Notes

- `naddr` remains scoped to the named/addressable NIP-5D kind because the pointer carries a `d` identifier.
- Root and snapshot NIP-5D manifests resolve through `nevent` pointers by event id.
- `pnpm test:e2e` was not run; this change is resolver/package-level and did not touch playground or shell wiring.
