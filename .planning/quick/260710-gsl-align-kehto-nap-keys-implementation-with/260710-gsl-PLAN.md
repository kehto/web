# Quick Task 260710-gsl: Align kehto NAP-KEYS implementation with napplet/naps draft

**Date:** 2026-07-10
**Status:** Complete

## Scope

Align PR #174 behavior with the active `napplet/naps` NAP-KEYS draft in PR #9
(`nub-keys`, `cecb642`), not with the older local interpretation.

## Tasks

1. Correct runtime and service control flow.
   - Remove service-side `keys.forward` to `keys.action` dispatch.
   - Keep `keys.forward` as napplet-to-shell only and ignore unmapped identities.
   - Emit `keys.registerAction.result` with `error` for registration failures.
   - Normalize bound chord strings before returning or pushing bindings.
   - Avoid binding NAP-reserved keys.

2. Remove shell host-keydown forwarding.
   - Stop installing/exporting the shell-side `keys-forwarder`.
   - Delete tests that assert shell-to-napplet `keys.forward`.
   - Update shell docs/comments to describe the napplet-to-shell direction.

3. Update tests, docs, and release metadata.
   - Adjust unit tests for local suppression semantics and normalized bindings.
   - Update service/shell documentation and the branch changeset.
   - Verify with focused unit tests plus build/type/docs/slop gates.

## Stop Condition

The branch should encode the NAP-KEYS control flow where active bound keys are
suppressed locally by napplet bindings, while `keys.forward` remains a shell
passthrough for unbound forwarded keystrokes.
