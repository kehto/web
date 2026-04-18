---
"@kehto/services": patch
---

v1.3 behavior-alignment rollup — no new services, no breaking changes:

- **notification-service canonical `notify.*` handling.** The service now handles both canonical v1.2 NIP-5D `notify.create` / `notify.list` / `notify.read` / `notify.dismiss` envelopes AND the legacy `ifc.emit` format for in-flight compatibility (Phase 17 + Phase 19 alignment). Registered under both `'notifications'` (topology key) and `'notify'` (runtime routing key) so the demo topology and the runtime dispatch both resolve correctly from a single handler instance (Phase 19 dual-register pattern).
- **identity-service `getPublicKey` contract.** The service always returns a result envelope (with an empty pubkey when no signer is present) rather than throwing — matches the `identity.getPublicKey` "Always succeeds" contract. Enables the `profile-viewer` napplet to render a `no-pubkey` sentinel cleanly under the no-signer case (Phase 20).
- **Documentation surface.** Canonical v1.2 `packages/services/README.md` groups factories by NIP-5D NUB domain with explicit capability-gate annotations (e.g., `createIdentityService` requires `identity:read` ACL entry).

Requirement IDs covered:
- DEMO-05 (`createDemoHooks()` registers reference services for keys / media / theme alongside identity / notifications)
- DEMO-07 (notification demo + kinds panel + constants panel reflect v1.2 data)
- NAP-05 (toaster creates / lists / dismisses via `notify.*`)
- NAP-07 (profile-viewer calls `identity.getPublicKey` + `identity.getProfile`)
- E2E-07 (`notify-lifecycle`, `identity-flow` specs green)
- DOCS-01, DOCS-02 (typedoc + services README)

No API renames. Additive behavior; legacy call sites continue to work.
