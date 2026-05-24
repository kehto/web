---
"@kehto/acl": patch
"@kehto/nip66": patch
"@kehto/runtime": patch
"@kehto/services": patch
"@kehto/shell": patch
"@kehto/wm": patch
---

v1.16 structural cleanup and anti-slop pass.

This release removes the remaining local `aislop` structural warnings through behavior-preserving refactors and comment/import cleanup. The affected public packages keep their existing runtime contracts; the bump is patch-level because the changes are internal decomposition, code-quality cleanup, and packaging hygiene rather than new public API.

Highlights:

- Runtime relay, identity, IFC, and fallback domain handling were split into focused helpers.
- Shell and playground-facing helpers were decomposed without changing public package exports.
- Service factories and adapter builders were split into smaller private helpers.
- Public package source now passes the local `aislop` gate with the existing scanner thresholds.

