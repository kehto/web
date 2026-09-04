---
"@kehto/shell": patch
---

Keep resource byte requests pending until the runtime returns a terminal result
or error instead of applying the namespace's ordinary request deadline. Callers
can cancel pending transfers with the canonical `AbortSignal` option.
