---
'@kehto/shell': patch
'@kehto/services': patch
'@kehto/paja': patch
---

Stop assuming `crypto.randomUUID()` exists outside the shell's own call sites. Browsers omit it on non-localhost plain HTTP while still exposing `crypto.getRandomValues()`.

- `@kehto/shell` exports `randomUUID`, the secure host UUID helper: native `crypto.randomUUID()` when present, otherwise a UUID v4 from 16 `crypto.getRandomValues()` bytes, and an explicit error when neither exists.
- `@kehto/services` uses the same policy for default upload ids, browser media resource-read ids, and CVM registry JSON-RPC ids. The uncaught `crypto.randomUUID is not a function` is gone.
- `@kehto/paja` uses the shell helper for frame-admission `instanceId`, intent-launcher window ids and correlations, and NIP-46 request ids.

No wire change. `crypto.subtle` is still unavailable on non-localhost HTTP, so upload, CVM, and other digest paths do not start working there.
