# @kehto/acl

## 0.2.0

### Minor Changes

- 226cdca: ACL full 8-domain coverage. `resolveCapabilitiesNub` now maps capabilities for identity, ifc, keys, media, notify, relay, storage, theme. Signer domain removed (getPublicKey/getRelays moved to identity; signEvent/nip04/nip44 are shell-mediated via relay.publish/publishEncrypted). New capability constants: identity:read, keys:bind, keys:forward, media:control, notify:send, notify:channel, theme:read.

  **Breaking changes:**

  - Removed capability constants: sign:event, sign:nip04, sign:nip44
  - Removed `resolveCapabilitiesNub` case 'signer'

  **Peer deps:**

  - @napplet/core bumped from >=0.1.0 to ^0.2.0
  - Added @napplet/nub-identity, @napplet/nub-ifc, @napplet/nub-keys, @napplet/nub-media, @napplet/nub-notify, @napplet/nub-relay, @napplet/nub-storage, @napplet/nub-theme (all ^0.2.0)

### Patch Changes

- 97b7bc8: v1.3 consume-and-showcase — no protocol changes to `@kehto/acl`. The demo's ACL panel (`apps/demo/src`) now drives grant/revoke/block/unblock through the canonical v1.2 `ShellAdapter.acl` hooks, and ACL-capability-matrix Playwright specs prove the package's enforcement contract end-to-end against the v1.3 demo napplet showcase.

  Documentation:

  - New canonical v1.2 `packages/acl/README.md` with `@example` JSDoc coverage for every non-type public export.
  - typedoc reference generated via `pnpm docs:api` at repo root.

  Requirement IDs covered:

  - DEMO-03 (ACL panel grant/revoke/block/unblock flows)
  - E2E-08 (`acl-grant-revoke`, `acl-block-unblock`, `acl-revoke-relay-write`, `acl-revoke-storage-write` specs green)
  - DOCS-01, DOCS-02 (typedoc + per-package README)
