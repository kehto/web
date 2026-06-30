---
status: in-progress
created: 2026-06-30
branch: feat/paja-visible-errors-real-signers
---

# Paja visible errors and real signers

## Goal

Make Paja's dev console show actionable service error text in the message log, and let local authoring sessions use a real browser signer instead of only the generated dev signer.

## Scope

- Show visible error details for `*.error` message rows while preserving the compact log.
- Add signer controls for dev signer, NIP-07, and bunker/NIP-46.
- Route Paja identity and outbox signing through the active signer provider, with fixed simulation identity still taking precedence.
- Keep every sign and publish request behind the existing Paja confirmation prompt.
- Update Paja docs and add a patch changeset.

## Verification

- Package type-check and build.
- Paja unit tests.
- Paja Playwright single-window coverage for visible errors and NIP-07 routing.
- Docs gate if docs changed.
- `git diff --check` before commit.
