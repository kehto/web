---
"@kehto/shell": patch
---

v1.3 additive + bug-fix rollup — no protocol changes to `@kehto/shell`:

- **publishTheme fan-out.** `originRegistry.getAllWindowIds()` is now the canonical enumeration for the `publishTheme()` broadcast so every loaded napplet (not only pubkey-bound sessions) receives `theme.changed` push events (Phase 20 fix).
- **PendingUpdate type re-export.** `PendingUpdate` is now exported from the `@kehto/shell` package index, resolving a typedoc documentation-surface warning and providing host-app integrators a public type import path for `sessionRegistry.getPendingUpdate()` (Phase 22 Plan 22-02).
- **Documentation surface.** Canonical v1.2 `packages/shell/README.md` with `@example` JSDoc coverage for every factory function (`createShellBridge`, per-domain proxies, `createKeysForwarder`); v1.2 anti-feature posture is framed descriptively (no host-injected 'nostr' object; shell-mediated signing via `relay.publish` / `relay.publishEncrypted`).

Requirement IDs covered:
- DEMO-02 (signer modal + NIP-46 connect flow via canonical identity + relay publishEncrypted)
- NAP-08 (theme-switcher dispatches `publishTheme()` that other napplets observe)
- E2E-07 (`theme-broadcast` spec green: theme-switcher → preferences propagation)
- DOCS-01, DOCS-02 (typedoc + shell README)

Additive only. No API renames. No breaking changes.
