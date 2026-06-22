---
"@kehto/acl": patch
"@kehto/cli": patch
"@kehto/firewall": patch
"@kehto/paja": patch
"@kehto/runtime": patch
"@kehto/services": patch
"@kehto/shell": patch
---

Add NAP-LINK runtime parity for the current `@napplet/nap` contract.

The runtime now dispatches the `link` domain, `@kehto/services` exports a reference `link.open` service, shell capabilities can advertise NAP-LINK, and Paja/playground hosts register link support. Package peer ranges now track the current `@napplet` 0.20 line.
