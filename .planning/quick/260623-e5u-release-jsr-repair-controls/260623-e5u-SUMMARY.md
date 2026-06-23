---
quick_id: 260623-e5u
slug: release-jsr-repair-controls
status: complete
---

# Summary

Added manual-only release workflow controls for partial registry repair:

- `skip_npm` lets a `workflow_dispatch` avoid a known npm registry blocker.
- `jsr_filter` lets a repair dispatch publish only selected JSR packages instead
  of re-touching every already-published package.

Tag-triggered releases still run the normal npm publish and default JSR
topological publish across `./packages/*`.

## Context

The v1.35 repair dispatch reached JSR after npm failed, but JSR rate-limited on
already-published `@kehto/nip@0.4.0` before it could publish the still-missing
`@kehto/services@0.12.0` and `@kehto/shell@0.14.0` versions.
