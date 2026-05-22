# Phase 56: Contract Authority and Package Source Baseline - Verification

Verified: 2026-05-22T19:04:05+02:00

## Commands

| Command | Result |
|---------|--------|
| `pnpm install` | Passed: lockfile updated; existing optional peer warnings for `@emnapi/*` under `unocss` remained |
| `pnpm exec turbo run type-check --dry=json` | Passed: package scope includes `@napplet/core`, `@napplet/nub`, `@napplet/sdk`, `@napplet/shim`, and `@napplet/vite-plugin` |
| `pnpm type-check` | Passed: 18/18 tasks, including local `@napplet/core` and `@napplet/nub` builds before Kehto consumers |
| `pnpm test:unit -- tests/unit/sdk-migration-guard.test.ts` | Passed: 33 files, 552 tests |
| `git diff --check` | Passed |

## Requirement Evidence

- CONTRACT-01/02: `specs/NIP-5D.md` records the pinned raw URL and commit and
  covers sandbox, transport, object envelopes, source identity, manifest
  `requires`, shell-derived `supports()`, unknown-type handling, and no
  napplet-visible `window.nostr`.
- CONTRACT-03: `RUNTIME-SPEC.md` now describes the active object-envelope,
  identity-at-iframe-creation model and explicitly retires AUTH/REGISTER/NIP-01
  negotiation for protocol identity.
- CONTRACT-04: `napplet/specs/NIP-5D.md` is marked non-authoritative.
- CONTRACT-05: unknown envelope types are documented as silently ignored, with
  NUB-specific errors allowed only where the NUB contract defines them.
- SOURCE-01/02: root overrides and lockfile entries resolve local
  `@napplet/*` protocol packages; `sdk-migration-guard.test.ts` fails if the
  workspace/override/lockfile invariant disappears or published snapshots for
  active protocol packages reappear.
- EXT-01: `docs/policies/NIP-5D-CONFORMANCE.md` classifies `connect`, `class`,
  `nostrdb`, `identity.decrypt`, and `relay.publishEncrypted`.

## Remaining Risks

- The raw demo-envelope allowlist is only policy-level in this phase; source
  replacement/classification and static guards are phase 58/59 work.
- `supports()` and manifest `requires` behavior are intentionally deferred to
  phases 57 and 58.
