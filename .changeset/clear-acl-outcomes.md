---
"@kehto/runtime": minor
---

Return a boolean success result from ACL persist and clear operations so hosts
can detect backend failures without rolling back live policy. Clarify that
revoke/block observers run synchronously before explicit persistence.

Custom AclStateContainer implementations must return boolean outcomes instead of void.
