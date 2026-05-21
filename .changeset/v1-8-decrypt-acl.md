---
'@kehto/acl': minor
---

Phase 45 (DECRYPT-06 / v1.8): add the `identity:decrypt` capability and map `identity.decrypt` to it. This keeps decrypt class gating explicit and separate from the read-only `identity:read` surface.
