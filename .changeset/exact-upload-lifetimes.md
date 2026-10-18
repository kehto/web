---
"@kehto/services": patch
---

Scope upload teardown to the exact requesting window and invalidate callbacks
before cancellation. Suppress late progress, results, and errors after window
destruction or service removal, including when window/upload IDs are reused.
