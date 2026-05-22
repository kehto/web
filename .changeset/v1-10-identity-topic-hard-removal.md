---
'@kehto/shell': minor
---

**RENAME-HARD-01/02 (v1.10 Phase 50)** — remove the v1.8 soft-rename compatibility branch from `ShellBridge.injectEvent()`.

`bridge.injectEvent('identity:changed', payload)` now forwards exactly one `identity:changed` event. The deprecated `auth:identity-changed` topic no longer fans out to the canonical topic; if callers still pass it, the bridge forwards that literal topic once like any other custom event topic.

Host integrations should emit and subscribe to `identity:changed`. The compatibility window announced in the v1.8 changeset is closed in v1.10.
