---
"@kehto/runtime": patch
"@kehto/shell": patch
"@kehto/paja": minor
---

Forward optional signer caller context through the policy-neutral runtime and
shell hooks. Add Paja's signer-, napplet-, and target-scoped remembered signing
choices: one event, one event kind, or warned napplet trust, with explicit
revocation. Relay publication and host-internal signing confirmations remain
independent.
