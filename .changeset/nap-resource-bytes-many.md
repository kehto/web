---
"@kehto/acl": minor
"@kehto/services": minor
"@kehto/shell": minor
---

Add draft NAP-RESOURCE `resource.bytesMany` support. The resource service now accepts bulk byte requests, returns ordered per-URL result items, keeps per-URL failures local, and emits current `id`/`blob`/`mime` fields while preserving legacy single-fetch compatibility fields.
