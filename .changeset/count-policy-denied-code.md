---
'@kehto/services': patch
---

`createCountService` now reports a refused or withdrawn approval as `error: "policy-denied"`, the code NAP-COUNT lists, instead of `"policy denied"`. The runtime's own COUNT denial already used the hyphenated code, so napplets now see one code for both paths.
