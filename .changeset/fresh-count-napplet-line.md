---
"@kehto/acl": patch
"@kehto/cli": patch
"@kehto/firewall": patch
"@kehto/paja": patch
"@kehto/runtime": patch
"@kehto/services": patch
"@kehto/shell": patch
---

Accept the released NAP-COUNT-capable `@napplet/core` and `@napplet/nap`
`0.25.x` line in published package metadata.

The NAP-COUNT implementation was versioned before the matching napplet package
release landed, so this patch updates peer/dev ranges and local package graph
guards without changing Kehto runtime behavior.
