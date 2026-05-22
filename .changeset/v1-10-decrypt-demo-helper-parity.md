---
'@kehto/playground': patch
---

**DECRYPT-DEMO-01/02/03 (v1.10 Phase 51/52)** — move decrypt-demo onto the `@napplet/nub@0.3.0` `identityDecrypt` helper and retire its old `0.2.1` shim/vite-plugin graph.

The demo now calls `identityDecrypt(event)` from `@napplet/nub/identity/sdk` instead of constructing local request IDs, pending response maps, and raw `window.parent.postMessage({ type: 'identity.decrypt', ... })` envelopes. The Playwright-covered DOM sentinels for NIP-04, NIP-44, NIP-17, and class-2 forbidden behavior remain unchanged.
