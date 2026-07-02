---
"@kehto/acl": minor
"@kehto/runtime": minor
"@kehto/shell": minor
"@kehto/services": minor
"@kehto/paja": minor
---

Add NAP-COUNT support for the draft `count.query` domain.

Kehto now routes `count.query` through a registered runtime count service,
advertises `window.napplet.count` only when that service is wired, exposes a
reference `createCountService()` helper, and lets Paja answer exact counts from
its memory relay fixture store without returning event payloads.
