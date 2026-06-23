---
"@kehto/paja": patch
"@kehto/runtime": patch
"@kehto/services": patch
"@kehto/shell": patch
---

Add NAP-LISTS runtime parity for the current `@napplet/nap` contract.

The runtime now dispatches the `lists` domain, `@kehto/services` exports a reference service for supported list metadata and shell-mediated add/remove mutations, shell capabilities can advertise NAP-LISTS, and Paja/playground hosts register deterministic list support.
