---
'@kehto/runtime': minor
---

Phase 45 (DECRYPT-01/06 / v1.8): route `identity.decrypt` through the NUB enforcement gate and return typed decrypt errors for ACL denial. Class-forbidden decrypt attempts now emit `identity.decrypt.error` with `error: 'class-forbidden'` before any identity service handler runs.
