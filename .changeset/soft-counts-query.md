---
"@kehto/acl": minor
"@kehto/firewall": patch
"@kehto/runtime": minor
"@kehto/shell": minor
"@kehto/services": minor
"@kehto/paja": minor
"@kehto/cli": patch
---

Add NAP-COUNT support for the draft `count.query` domain.

Kehto now routes `count.query` through a registered runtime count service,
advertises `window.napplet.count` only when that service is wired, exposes a
reference `createCountService()` helper, and lets Paja answer exact counts from
its memory relay fixture store without returning event payloads.

The published package metadata now accepts the NAP-COUNT-capable
`@napplet/core` and `@napplet/nap` `0.25.x` line, and the local playground
napplets/fixtures use the matching `@napplet/nap`, `@napplet/sdk`, and
`@napplet/shim` releases.
