---
phase: quick-261007-jux
status: passed
verified: 2026-10-07
---

# Extra Blossom Resource Servers — Verification

Goal met: both Paja target modes expose a newline textarea and Save; bare domains normalize to HTTPS, validated extras persist independently and feed subsequent source-scoped Blossom reads without frame reload.

- Settings unit tests verify ordered canonicalization, atomic invalid saves, storage revalidation, immutable snapshots, safe feedback and session-only failures.
- Real adapter/resource-service integration verifies returned SHA-checked Blob bytes, live replace/clear across two windows, unchanged defaults, eight-server cap and direct HTTPS independence.
- Browser tests verify keyboard Save, reload restoration, invalid-save atomicity, clearing, storage failure, actual running-frame resource reads and unchanged frame identity/srcdoc/CSP. Desktop and narrow layout checks pass.
- Docs and separate patch changeset match behavior; prior local-file changeset retained.

## Final Gates

| Gate | Result |
| --- | --- |
| build | 32/32 tasks passed |
| type-check | 17/17 tasks passed |
| unit | 154 files / 1,863 tests passed |
| docs | passed |
| full e2e | 89 tests passed; `/tmp/opencode/jux-full-test-e2e-complete.log` |
| aislop | 100/100, zero errors; `/tmp/opencode/jux-full-slop.log` |
| diff checks | clean |
| security | verified, zero blocking open threats |

Executor gate evidence is recorded in `261007-jux-SUMMARY.md`; orchestrator inspected implementation/test diff and final browser/slop logs. The pre-existing whole-host throwing-storage-getter issue and browser DNS policy limitation are explicitly deferred, not claimed as fixed. NAP refs checked: `9511232f69313aa7953d110e35d32cc28d506f66` and PR80 `fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1`; no wire migration.
