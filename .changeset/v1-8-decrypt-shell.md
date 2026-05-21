---
'@kehto/shell': minor
---

Phase 45/46 (DECRYPT-02/07/09/10 + E2E-28 / v1.8): playground shell host wires the identity service with event verification and a deterministic demo decrypt bridge, exposes fixture/call-count hooks for the decrypt demo, and persists/displays the `identity:decrypt` ACL capability. The bridge is fixture-only; downstream shells should inject their own key or backend implementation.
