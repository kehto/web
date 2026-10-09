---
phase: quick-261007-md2
status: verified
asvs_level: 1
threats_open: 0
created: 2026-10-07
---

# Sidebar Presentation — Security

Reviewed diff `a0a81e34..a27b55b8`: only form placement, helper text and markup assertions change. Existing origin validation, safe text rendering, source scoping, persistence and fetch policy remain unchanged. No new trust boundary or open blocking threat. Prior threat audit is in quick task 261007-jux.

User subsequently requested public HTTP Blossom servers. Rechecked the exact pinned `napplet/naps@9511232f69313aa7953d110e35d32cc28d506f66/naps/NAP-RESOURCE.md`: “Each server entry MUST be an HTTPS public origin.” Public HTTP acceptance is not implemented because it conflicts with that contract. Existing latest-draft wire drift at PR80 `fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1` remains recorded, not migrated.
