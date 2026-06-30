---
status: complete
completed: 2026-06-30
quick_id: 260630-i9k
slug: make-paja-useful-development-tool
---

# Make Paja useful for napplet development

## Delivered

- Added a Paja dev console for supported-interface toggles, ACL capability controls, signer identity, and filterable message logs.
- Split browser host wiring into adapter and devtools modules so the host stays focused on frame/session lifecycle.
- Registered the target iframe with a source-derived session entry so ACL grants/revokes apply to the hosted napplet.
- Added a generated in-browser Nostr development signer and confirmation prompts for every sign and publish request.
- Added e2e coverage for identity/outbox publish, dialog prompts, message filtering, ACL revocation, and interface disabling.
- Updated Paja docs and added a getting-started guide.

## Verification

- `pnpm --filter @kehto/paja type-check`
- `pnpm --filter @kehto/paja build`
- `pnpm --filter @kehto/paja test:unit`
- `npx playwright test tests/e2e/paja-single-window.spec.ts --workers=1`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm docs:check`
- `npx aislop scan --changes --base origin/main && git diff --check`

## Notes

- Full-repo `npx aislop scan` still reports pre-existing unrelated findings in playground files; changed-scope slop is clean at 100/100.
