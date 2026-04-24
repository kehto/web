---
'@kehto/services': patch
---

Add `HostCacheBridge` as an additive type alias for `CacheServiceOptions` (kehto#1 naming parity with `HostKeysBridge` / `HostMediaBridge`). Pure alias — no runtime change, no breaking change. The existing `CacheServiceOptions` export remains the primary name; new consumers may prefer `HostCacheBridge` for cross-package consistency (M-02 prevention: do not rename or delete `CacheServiceOptions`).
