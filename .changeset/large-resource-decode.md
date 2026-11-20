---
"@kehto/shell": patch
---

The napplet prelude decodes `resource.bytes` results of several megabytes. Its canonical-base64 check was a backtracking pattern that exhausted the stack on payloads larger than about 2–4 MB, so an applet's asset pack failed with `RangeError: Maximum call stack size exceeded`. The check is now linear, and every malformed result is still refused with the same `TypeError`.
