---
status: complete
created: 2026-06-30
quick_id: 260630-k7p
slug: fix-gateway-audit-srcdoc-check
---

# Fix gateway audit srcdoc check

## Target

Restore the Pages workflow by aligning `scripts/audit-gateway-artifacts.mjs`
with the current verified-byte injection shape in `apps/playground/src/shell-host.ts`.

## Evidence

- `Publish Web to GitHub Pages` failed on run `28457349966`.
- Failed step: `Audit gateway artifacts`.
- Log: `shell-host.ts does not inject verified bytes via iframe.srcdoc`.
- Current source sets `iframe.srcdoc = injectNappletNamespacePrelude(injectCspMeta(...), ...)`, so the invariant is true but the audit searched for the older exact string `iframe.srcdoc = injectCspMeta(`.

## Plan

1. Keep the audit invariant but check assignment to `iframe.srcdoc` separately from `injectCspMeta(`.
2. Run the gateway audit and diff checks.
3. Push a small PR.

## Verification

- `pnpm audit:gateway-artifacts`
- `git diff --check`
