---
quick_id: 260728-pub
slug: update-kehto-compatibility-for-current-n
date: 2026-07-28
branch: chore/phase-106-napplet-latest-release
---

# Quick: Publish Kehto against the current Napplet line

## Goal

Close the Phase 106 publication gap against the registries as they exist now.
The public Kehto packages must be built and tested against the current Napplet
line, receive explicit Changesets release intent, pass the protected
changeset/version/release sequence, and install with `@napplet/core@latest` and
`@napplet/nap@latest` from a clean downstream project.

## Tasks

- [x] Align every active Kehto, playground, and fixture Napplet dependency with
      the current published line (`core`/`nap` 0.31.0, `shim` 0.29.0, `sdk`
      0.27.0, `vite-plugin` 0.14.0). Migrate the Kehto INC and INTENT host
      surfaces from the superseded 0.29 draft behavior to the merged canonical
      NAP contracts packaged by 0.31.0. Update tests and documentation together.
- [x] Add Changesets release intent for every public `@kehto/*` package whose
      shipped output or compatibility metadata changes. Regenerate the lockfile
      and prove build, type-check, unit, Playwright, docs, AI-slop, and clean
      downstream install/import/build gates.
- [ ] Push and merge the green corrective PR, verify exact-main CI/docs/Pages,
      merge the generated Version Packages PR, verify that generated commit,
      trigger `release.yml`, and monitor npm plus JSR publication. Update the
      Phase 106 closeout with the exact PRs, SHAs, workflow runs, versions,
      registry metadata, and clean consumer proof.

## Authoritative inputs

- Merged NAP registry: `napplet/naps` master
  `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`, especially
  `naps/NAP-INTENT.md`, `naps/NAP-INC.md`, and `naps/NAP-SHELL.md`.
- Published Napplet packages: `@napplet/core@0.31.0`,
  `@napplet/nap@0.31.0`, `@napplet/shim@0.29.0`,
  `@napplet/sdk@0.27.0`, and `@napplet/vite-plugin@0.14.0`.
- Upstream release change `7b67562`: align INC and INTENT with their merged
  canonical contracts; remove the draft URI invocation, deferred
  `intent.deliver`, and acceptance-only result model.
- Upstream release change `d201bd0`: add optional NAP-FS surfaces. Kehto may
  leave that optional domain unavailable, but must compile and inject the
  current namespace without claiming unsupported FS capability.

## Verification

- `pnpm install --frozen-lockfile`
- `pnpm build`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm docs:check`
- relevant and full `pnpm test:e2e`
- `npx --yes aislop@0.12.0 scan -d`
- `git diff --check`
- exact GitHub PR/check/run SHA inspection for both merges
- direct npm and JSR version, latest-tag, peer-range, and import-map assertions
- clean temporary consumer install of `@kehto/paja@latest`,
  `@napplet/core@latest`, and `@napplet/nap@latest`, followed by ESM import and
  minimal bundle smoke tests

## Terminal condition

Completion requires a successful release run from the exact generated Version
Packages merge SHA, all intended versions visible as `latest` on npm and JSR,
and the clean downstream consumer proof. A source PR, changeset, or merged
Version Packages PR alone is not completion.
