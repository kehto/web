---
"@kehto/runtime": minor
---

Include dTag and aggregateHash in ACL listing and lookup results so hosts can
identify and mutate listed principals after reload. Custom AclEntryExternal
producers must supply these required identity fields. Serialized keys are unchanged.
