---
"@kehto/services": patch
---

Scope keys action registrations and bridge unsubscribe handles to their owning
runtime window. Multiple windows may use the same app-local action ID without
replacing or unregistering each other's bindings. Preserve same-window rebinding,
original wire action IDs, and independent window destruction/reload in both
document and hostBridge backends.
