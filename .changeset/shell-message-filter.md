---
'@kehto/shell': minor
---

Hosts can now decide what happens to port traffic before dispatch. `ShellAdapter.filterNappletMessage(windowId, message)` returns `'dispatch'`, `'drop'` or `'defer'`, and `ShellBridge.releaseDeferred(windowId)` dispatches what was deferred, in arrival order. `shell.ready` skips the filter, because NAP-SHELL requires its first `shell.init` reply. A window holding more than `MAX_DEFERRED_MESSAGES` is revoked with the new `deferred-overflow` reason, so exhaustive switches on `NappletRevocationReason` need one more case. Hosts without a filter see no change.
