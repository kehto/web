---
"@kehto/shell": patch
---

Discard a retired source's cached environment even when its runtime session was explicitly unregistered. A replacement registration uses its supplied snapshot or current host defaults, so old private domains and services cannot leak into its shell.init or dispatch policy.
