---
quick_id: 261101-ia2
slug: add-kehto-mocks-package-with-determinist
date: 2026-11-01
branch: feat/nap-mocks
status: in-progress
---

# Add `@kehto/mocks` — deterministic mock services for every NAP domain

## Goal

Shells built on kehto need data for every NAP domain while implementing them,
without depending on real relays, devices, LLM providers, downloaders, or
hardware. Ship a `@kehto/mocks` package whose mocks register as plain
`ServiceHandler`s (built-in domains) or extension handlers (draft domains
outside the built-in dispatcher), plus the skills and docs that let
implementers use them and let agents keep them in sync with `napplet/naps`.

## Spec authority

Every NAP document checked for this task is exported to the session scratchpad
(`naps/<NAP>@master.md` or `naps/<NAP>@pr<N>.md`). Source refs recorded in
`packages/mocks/src/registry.ts` as `{ nap, source, pr, sha, path }`:

- Merged `napplet/naps` master `43cb3a4`: IDENTITY, INC, INTENT, SHELL, THEME.
- Draft PR heads (number → sha): see `MOCK_NAP_REGISTRY`.

Subject for torrent / nzb / soulseek fixtures is Linux distribution ISOs.

## Tasks

1. Package scaffold: `packages/mocks` (package.json, jsr.json, tsup, tsconfig,
   README), vitest alias, typedoc entry, docs page + index/sidebar/API ref rows,
   root README row.
2. Core helpers: seeded RNG, deterministic ids, envelope helpers,
   `defineMockService`, push sink, clock/scheduler, shared fixtures (nostr
   events, relays, Linux distro catalog).
3. Domain mocks (one file + test per NAP), written against the recorded spec
   refs, in parallel batches.
4. Registry + `createMockNapServices()` aggregate; registry conformance test
   (every inventoried NAP present, spec ref shape, descriptor/domain match,
   extension domains declare `messageCapabilities`).
5. Skills: `skills/use-nap-mocks/SKILL.md` (implementers) and
   `skills/maintain-nap-mocks/SKILL.md` (agents: audit refs vs upstream, add
   new NAPs) with `packages/mocks/scripts/audit-naps.mjs`.
6. Docs, changeset, gates (`pnpm build`, `type-check`, `test:unit`,
   `docs:check`, aislop), commits, push, PR.

## Out of scope

- Replacing existing reference services in `@kehto/services`.
- Wiring mocks into Paja or the playground by default (documented opt-in only).
