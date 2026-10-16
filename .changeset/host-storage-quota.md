---
"@kehto/runtime": minor
---

Add setStateQuota to the runtime ACL container so hosts can configure a
principal's enforced storage quota without rewriting serialized state. Validate
safe integer byte bounds and preserve grants, block status, and existing data.
