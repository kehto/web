---
"@kehto/acl": minor
"@kehto/runtime": minor
"@kehto/services": minor
"@kehto/shell": minor
---

Add NAP-CVM (ContextVM bridge): napplets can call ContextVM / MCP-over-Nostr
servers through the shell.

- `@kehto/acl`: new `cvm:call` capability and `cvm` domain resolution.
- `@kehto/services`: `createCvmService` (pure NIP-5D envelope router over an
  injected `CvmTransport`) plus `createNostrCvmTransport` — a concrete
  ContextVM transport (CEP-4 gift-wrapped kind-25910, kind-11316/11317
  discovery, JSON-RPC id correlation) shipped on the nostr-isolated subpath
  `@kehto/services/cvm-nostr-transport`.
- `@kehto/runtime`: routes the `cvm` domain to the registered CVM service.
- `@kehto/shell`: advertises `cvm` so `shell.supports("cvm")` is true.
