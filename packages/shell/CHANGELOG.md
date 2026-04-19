# @kehto/shell

## 0.2.0

### Minor Changes

- 226cdca: Canonical NIP-5D shell posture. `window.nostr` injection is removed — napplet iframes no longer see a host-provided `window.nostr` at any lifecycle point. `shell.supports()` now uses the `perm:<permission>` namespace for sandbox permissions (e.g., `shell.supports('perm:popups')`); bare names continue to resolve NUB capabilities. Signing and NIP-44 encryption are shell-mediated exclusively via `relay.publish` / `relay.publishEncrypted` — napplets never receive raw signing keys or plaintext of encrypted payloads. New per-domain proxies (identity, keys, media, notify, storage) are available as optional composition seams for host-app interception. `keys-forwarder` module published for host-app DOM-event bridging. `ShellBridge.publishTheme()` added as a first-class broadcast API so host apps can push theme changes to every registered napplet.

  **Breaking changes:**

  - `window.nostr` injection REMOVED (reverses v1.1 SH-I02). Napplets relying on `window.nostr` must migrate to `nostr.publish(...)` / `nostr.publishEncrypted(...)` via the shell bridge.
  - `shell.supports('<permission>')` renamed to `shell.supports('perm:<permission>')` for sandbox-permission checks.
  - Signer-side shell exports removed (no `signEvent` / `nip04` / `nip44` surface).

  **Peer deps:**

  - @napplet/core bumped from >=0.1.0 to ^0.2.0
  - Added @napplet/nub-identity, @napplet/nub-ifc, @napplet/nub-keys, @napplet/nub-media, @napplet/nub-notify, @napplet/nub-relay, @napplet/nub-storage, @napplet/nub-theme (all ^0.2.0)

### Patch Changes

- 41b12b9: v1.3 additive + bug-fix rollup — no protocol changes to `@kehto/shell`:

  - **publishTheme fan-out.** `originRegistry.getAllWindowIds()` is now the canonical enumeration for the `publishTheme()` broadcast so every loaded napplet (not only pubkey-bound sessions) receives `theme.changed` push events (Phase 20 fix).
  - **PendingUpdate type re-export.** `PendingUpdate` is now exported from the `@kehto/shell` package index, resolving a typedoc documentation-surface warning and providing host-app integrators a public type import path for `sessionRegistry.getPendingUpdate()` (Phase 22 Plan 22-02).
  - **Documentation surface.** Canonical v1.2 `packages/shell/README.md` with `@example` JSDoc coverage for every factory function (`createShellBridge`, per-domain proxies, `createKeysForwarder`); v1.2 anti-feature posture is framed descriptively (no host-injected 'nostr' object; shell-mediated signing via `relay.publish` / `relay.publishEncrypted`).

  Requirement IDs covered:

  - DEMO-02 (signer modal + NIP-46 connect flow via canonical identity + relay publishEncrypted)
  - NAP-08 (theme-switcher dispatches `publishTheme()` that other napplets observe)
  - E2E-07 (`theme-broadcast` spec green: theme-switcher → preferences propagation)
  - DOCS-01, DOCS-02 (typedoc + shell README)

  Additive only. No API renames. No breaking changes.

- Updated dependencies [226cdca]
- Updated dependencies [226cdca]
- Updated dependencies [97b7bc8]
- Updated dependencies [97b7bc8]
  - @kehto/acl@0.2.0
  - @kehto/runtime@0.2.0
