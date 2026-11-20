---
"@kehto/nip": patch
---

Refuse legacy aggregate manifests whose `path` entries collide (including `/` and `index.html` aliases of `/index.html`) instead of running one of them, and name the hash mismatch when a Blossom server returns other bytes for a blob (kehto/web#525).
