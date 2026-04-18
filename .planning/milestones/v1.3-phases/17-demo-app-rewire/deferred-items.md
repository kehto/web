# Deferred Items — Phase 17 Demo App Rewire

## Pre-existing Type Errors (out-of-scope for 17-04)

These TS errors exist in files not modified by 17-04. They are pre-existing from earlier plans and should be resolved in their respective plan scope.

- `acl-modal.ts(21,22,23)` — `sign:event`, `sign:nip04`, `sign:nip44` capability strings removed in v1.2 but still referenced in demo UI labels. Resolve in 17-05 or 17-06 (ACL panel rewire).
- `acl-panel.ts(18,31,42)` — same `sign:*` capabilities. Same scope.
- `node-details.ts(147)` — same `sign:*` capabilities. Same scope.
- `shell-host.ts(429)` — `randomBytes` not in `CryptoHooks` interface. Should be fixed in v1.3 cleanup.
- `shell-host.ts(741)` — `relay.sendChallenge` not on `ShellBridge` type. Legacy AUTH flow; remove or retype.
- `shell-host.ts(867-869)` — `sign:*` capabilities in ACL check table. Same ACL panel scope.
- `main.ts(85)` — `@napplet/services` import error (should be `@kehto/services`). Pre-existing.
