---
'@kehto/shell': patch
---

Report browser ACL persistence failures to runtime callers so a failed save or
clear returns `false` instead of appearing durable.
