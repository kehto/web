---
status: complete
completed: 2026-06-30
---

# Fix gateway audit srcdoc check

## Outcome

Completed in commit `e78cd97`. The gateway audit stopped depending on the obsolete
exact `iframe.srcdoc = injectCspMeta(` spelling and instead checks srcdoc assignment
and CSP injection as separate semantic invariants.

## Verification

The current `scripts/audit-gateway-artifacts.mjs` preserves that invariant against
the refactored `playground-frame-loader.ts` implementation.

