---
"@kehto/runtime": patch
"@kehto/services": patch
"@kehto/shell": minor
---

Align NAP-KEYS forwarding and action bindings with the active `napplet/naps` draft: `keys.forward` remains napplet-to-shell only, bound keys are delivered through `keys.bindings` for local suppression, registration errors use `keys.registerAction.result`, reserved/default bindings are left unbound, and the non-conforming shell host-keydown forwarder export is removed.
