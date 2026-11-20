---
'@kehto/paja': patch
---

An admitted frame Paja retires (revoked grant, tightened rule, closed tab, launch superseded by a reload) now goes through `ShellBridge.revokeNapplet(windowId, 'host')` instead of only unregistering its origin. The bridge drops the port binding, cached shell environment and nested-context lock for that window along with the runtime session, services get `onWindowDestroyed`, and the retire is logged as `paja.napplet.retired` so `paja.napplet.revoked` keeps meaning a revoke the shell found NIP-5D evidence for.
