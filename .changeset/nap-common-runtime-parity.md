---
"@kehto/paja": patch
"@kehto/runtime": patch
"@kehto/services": patch
"@kehto/shell": patch
---

Add NAP-COMMON runtime parity for the current `@napplet/nap` contract.

The runtime now dispatches the `common` domain, `@kehto/services` exports a reference service for public NIP-19 helpers and shell-mediated common social actions, shell capabilities can advertise NAP-COMMON, and Paja/playground hosts register deterministic common support.
