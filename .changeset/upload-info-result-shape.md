---
"@kehto/runtime": patch
"@kehto/services": patch
---

Failed `upload.info` replies now carry the `info` the NAP-UPLOAD wire table requires. The runtime's policy denial (ACL and legacy Firewall) and `createUploadService`'s info-provider failure send `info: { rails: [] }` beside `error`, the fully redacted disclosure the NAP allows (napplet/naps#33 @ f5cc981e). Failed `upload.status` replies still send only `error`: a lookup that failed has no honest rail, state or timestamp, so that is recorded as a bounded spec gap instead of inventing a status (kehto/web#518).
