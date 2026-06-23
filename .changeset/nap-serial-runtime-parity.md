---
"@kehto/paja": patch
"@kehto/runtime": patch
"@kehto/services": patch
"@kehto/shell": patch
---

Add NAP-SERIAL runtime parity.

The runtime now dispatches the `serial` domain, `@kehto/services` exports a reference service for shell-mediated serial open/write/close sessions, shell capabilities can advertise NAP-SERIAL, and Paja/playground hosts register deterministic serial support.
