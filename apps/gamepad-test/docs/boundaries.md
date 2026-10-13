# Napplet Boundaries

Napplets run in a restrictive iframe and delegate privileged work to the shell.
The template should stay on the napplet side of that line.

## Napplet Owns

- UI state and rendering.
- Controller snapshots through Kehto's injected GAMEPAD API (the SDK wrapper is pending; see package-surfaces.md).
- User gestures inside the iframe.
- Calls into runtime-injected `window.napplet` through `@napplet/sdk`.
- Feature detection with injected domain property presence.
- Subscription cleanup for outbox, relay-local escape hatches, identity, config,
  keys, media, notify, and INC listeners.
- Graceful fallback when a shell does not implement a requested NAP.

## Shell Owns

- The single native controller reader, input focus, neutralization, and frame device denial.
- Relay pool access.
- Signing and encryption.
- User identity and signer state.
- Storage persistence and quota.
- External byte fetching through NAP-RESOURCE.
- Settings UI for NAP-CONFIG.

(NAP-CONNECT direct-network grants and NAP-CLASS security-class assignment are
currently deferred on the NAPs track — not part of the active surface.)

## Forbidden In Napplet Code

- Direct signer access or NIP-07 assumptions.
- Direct host DOM access.
- `localStorage` or `sessionStorage` for durable user data.
- Service worker registration.
- Cookie access.
- Unchecked direct network access.
- Shell policy decisions such as ACL, resource allowlists, or consent
  persistence.

## Allowed Patterns

- `import { outbox, storage, identity } from '@napplet/sdk';` for named helpers.
- `if (window.napplet?.resource) { ... }` before using optional domains.
- `relay.subscribe(..., { relay: groupRelay })` only when the feature requires
  explicit relay-local semantics that OUTBOX cannot express.
- `storage.setItem()` for durable key-value app state.
- `resource.bytes()` for external read-only bytes.
