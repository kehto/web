---
quick_id: 260728-pub
slug: update-kehto-compatibility-for-current-n
date: 2026-07-28
status: complete
source_pr: 220
version_packages_pr: 221
release_run: 30389303760
---

# Summary

Phase 106 now satisfies its publication terminal condition against the current
Napplet package line, rather than only the earlier 0.29 release snapshot.

## Delivered

- Migrated Kehto's active INC and INTENT surfaces to the canonical contracts
  packaged by `@napplet/core@0.31.0` and `@napplet/nap@0.31.0`, checked against
  merged `napplet/naps` master
  `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`.
- Added the explicit Changeset missing from the prior release path for all
  eight affected public packages.
- Merged source PR #220 as `9390eca7d294375e8330730c411ed5aef74a7a61`.
- Verified and merged generated Version Packages PR #221 as exact release
  source `b61b8cf5e4e40859b0fba6c6e690dc9726f03431`.
- Dispatched Release #30389303760 and verified npm OIDC plus topologically
  ordered JSR publication.

## Published package proof

Direct npm and JSR `latest` queries agree on:

- `@kehto/acl@0.17.0`
- `@kehto/cli@0.4.0`
- `@kehto/firewall@0.5.0`
- `@kehto/nip@0.5.0`
- `@kehto/paja@0.10.0`
- `@kehto/runtime@0.20.0`
- `@kehto/services@0.18.0`
- `@kehto/shell@0.19.0`

Direct Napplet peers use `>=0.31.0 <0.32.0`; Paja's published JSR mappings use
`^0.31.0`.

## Verification

- Source CI #30387669270, Pages #30387670585, and slop #30387669702 passed on
  exact source SHA `9390eca7d294375e8330730c411ed5aef74a7a61`.
- Release-source CI #30388794341, Pages #30388794322, and slop #30388796044
  passed on exact SHA `b61b8cf5e4e40859b0fba6c6e690dc9726f03431`.
- Release #30389303760 passed on that same SHA.
- Local gates passed: frozen install, build, forced type-check, 126 files /
  1,525 unit tests, docs, 79 E2E passes with one intentional skip, AI-slop
  100/100, and `git diff --check`.
- A clean temporary npm consumer resolved Paja/core/nap as
  0.10.0/0.31.0/0.31.0 without peer errors. Direct ESM import and a 179.2 KiB
  Node esbuild bundle both exposed `startPajaServer`.

## Remaining debt

The Phase 105 12/24 UI audit remains explicit non-passing post-merge debt. This
release is protocol/package sign-off, not visual sign-off.
