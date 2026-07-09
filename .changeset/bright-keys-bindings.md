---
"@kehto/services": patch
---

Push complete `keys.bindings` lists from `createKeysService` after bound action registrations and unregisters, and dispatch `keys.action` for matching forwarded registered chords unless the chord is shell-reserved.
