---
status: complete
created: 2026-06-30
quick_id: 260630-i9k
slug: make-paja-useful-development-tool
---

# Make Paja useful for napplet development

## Target

Turn Paja from a passive iframe shell into a usable development runtime:

- show supported interfaces and allow per-interface injection toggles
- show a filterable message debug log
- expose implemented/configurable ACL controls
- keep adapter-based runtime wiring
- provide a production implementation path through Kehto surfaces
- provide a real signer, with every sign/publish request gated by confirmation
- update tests and docs, then ship via pushed branch + PR

## Current evidence

- Worktree clean on `fix/paja-managed-target-port`.
- `packages/paja/src/browser-host.ts` already creates a ShellBridge adapter and services.
- `packages/paja/src/host-page.ts` exposes only target iframe, theme, reload, and footer.
- Paja defaults to anonymous identity, so identity-dependent napplets receive an empty pubkey unless configured.
- Playground has reusable patterns for service toggles, ACL, message tap, and signer state.

## Implementation plan

1. Add a Paja dev console panel to the hosted page for interfaces, ACL, signer, and message log.
2. Register a source-derived session entry for the target iframe so ACL has a real target identity.
3. Add message tap/logging around inbound and outbound envelopes with UI filtering.
4. Add per-domain interface toggles that update simulation capabilities and reload the target.
5. Add ACL capability controls over `bridge.runtime.aclState` for the single target identity.
6. Replace anonymous-only default with a generated real in-browser dev signer, and confirm every sign and publish request.
7. Extend unit/e2e coverage and docs/getting-started.
8. Run focused tests, repo gates where feasible, commit, push, open PR.

## Verification

- `pnpm --filter @kehto/paja test:unit`
- focused Playwright Paja spec
- `pnpm --filter @kehto/paja build`
- `pnpm type-check`
- docs check if docs touched
- `git diff --check`
