---
status: in-progress
created_at: 2026-07-02T03:44:57.926Z
issue: https://github.com/kehto/web/issues/127
---

# Implement NAP-COUNT count domain

## Scope

- Add a runtime-mediated `count` domain for `count.query` requests.
- Advertise `count` through shell capability discovery only when the handler is wired.
- Expose the NIP-5D web binding so consumers can call `window.napplet.count`.
- Cover exact success, invalid filters, unsupported/too-expensive refusal, and no event payloads.
- Document approximation/refusal semantics and relay/index/cache support dependency.

## Verification

- `pnpm build`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm docs:check` if documentation/public API docs change
