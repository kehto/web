---
id: 260703-nva
status: in-progress
description: Fix kehto paja to use NIP-5D event kinds instead of NIP-5A event kinds
created: 2026-07-03
---

# Quick Task 260703-nva: Fix Paja NIP-5D Event Kinds

## Spec Facts

- Current upstream NIP-5D PR #2303 defines napplet manifest kinds `5129` (snapshot), `15129` (root), and `35129` (named/addressable).
- Current upstream NIP-5A defines nsite manifest kinds `5128` (snapshot), `15128` (root), and `35128` (named/addressable).
- The local `@kehto/nip/5d` module already exports `NAPPLET_KINDS` and `isNappletManifestKind()` for the NIP-5D kind set.

## Tasks

1. Update Paja runtime pointer resolution to use the canonical `@kehto/nip/5d` NIP-5D kind constants/guard.
2. Add tests proving `nevent` pointers can resolve NIP-5D snapshot/root manifests and that NIP-5A nsite kinds are rejected.
3. Update Paja package docs and add a changeset for the shipped fix.

## Verification

- `pnpm --filter @kehto/paja test -- runtime-resolver`
- `pnpm --filter @kehto/paja type-check`
- `pnpm --filter @kehto/paja build`
- `git diff --check`
