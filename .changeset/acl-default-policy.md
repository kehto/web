---
'@kehto/runtime': minor
'@kehto/shell': minor
---

Hosts can now choose the ACL default policy with `aclDefaultPolicy: 'permissive' | 'restrictive'` on `RuntimeAdapter` and `ShellAdapter`. With `'restrictive'`, identities with no stored entry start with nothing granted. A policy set this way replaces the one stored in persisted ACL state on load, and stored entries are kept. Leaving it out keeps today's behaviour.
