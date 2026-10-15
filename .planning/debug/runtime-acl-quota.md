---
status: investigating
trigger: "Issue #301: Expose a supported runtime ACL state-quota mutation API"
---

## Evidence and spec check

Main `fcf0a387` exposes getStateQuota but no setter. The owned ACL state can only
be replaced through private serialized state. Checked NAP-STORAGE draft PR #3
at `4f4cf0ca7ecbd24c284a5d63bcd85e3de6af37ca`, `naps/NAP-STORAGE.md`: runtimes
must enforce per-napplet quotas in UTF-8 bytes, with a recommended 512KB default.
Quota administration is host policy; the wire gains no setter.

## Current focus

Add a principal-scoped setStateQuota method. Accept safe integer byte counts
from zero through Number.MAX_SAFE_INTEGER; reject malformed values before any
mutation. Preserve grants/block status, use the existing storage enforcement
state, and retain explicit persistence. Cover readback, isolation, reload,
malformed inputs, and runtime storage at/over the configured limit. GSD debug
runs inline. The primary checkout's unrelated changes remain untouched.
