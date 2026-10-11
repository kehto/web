---
phase: 107
slug: paja-intent-deep-links
status: verified
threats_open: 0
asvs_level: 1
created: 2026-10-10
---

# Phase 107 — Security

The GSD security auditor verified the nine planned threat controls at ASVS L1.
The plans supplied descriptive threat blocks; audit assigned high severity to
T1–T8 and medium to T9. Every disposition is mitigate; all are closed.

## Trust Boundaries

| Boundary | Data crossing | Control |
| --- | --- | --- |
| External URL → host review | Untrusted URI, JSON, target hints | Strict bounded parsing, explicit Launch, no caller identity |
| Relay/Blossom → catalog and frame | Signed manifest, artifact bytes | Signature/hash verification, exact contract/coordinate, ordinary network policy |
| Source iframe → service | Intent request | Registered MessageEvent.source and authenticated window lookup |
| Host → selected target | Opaque payload and attested sender | Current verified target generation, authenticated readiness, one target-only delivery |

## Threat Register

| Threat | Category | Severity | Disposition | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| T1 source spoofing | Spoofing | high | mitigate | intent-service.ts:56,117 rejects unknown fields and derives sender; browser-host.ts:715 binds actual sources | closed |
| T2 publisher/kind collisions | Spoofing | high | mitigate | nip/src/5d/catalog-id.ts:28; manifest-intent-catalog.ts:67 uses verified opaque IDs | closed |
| T3 mismatch/payload routing | Tampering | high | mitigate | catalog-intent-resolver.ts:107,169 exact convention selection before payload delivery; browser-intent-builder.ts:93 selected advertised contract | closed |
| T4 encoding/prototype confusion | Tampering | high | mitigate | intent-uri.ts:26,164; intent-link.ts:40,110 strict decoding, duplicates, null-prototype query fields, JSON separation, 16 KiB cap | closed |
| T5 recommendations/defaults | Elevation of privilege | high | mitigate | catalog-intent-resolver.ts:118 fail-closed explicit target; browser-intent-launcher-host.ts:124 verified named coordinate and install consent | closed |
| T6 source and byte provenance | Spoofing | high | mitigate | intent-launcher.ts:41 signature/hash verification; browser-host.ts:715 source binding; shared target preparation keeps bootstrap outside verified bytes | closed |
| T7 consent/replay | Tampering | high | mitigate | browser-intent-links.ts:94,147 explicit Launch and generation cancellation; browser-intent-controller.ts:71 retained delivery; browser no-replay and delayed-cancel regressions | closed |
| T8 delivery retention/leakage | Information disclosure | high | mitigate | intent-types.ts:50 excludes payload/window internals from result; browser-intent-host.ts:149,210 exact current target-only delivery | closed |
| T9 shipping scope/claims | Tampering | medium | mitigate | Scoped feature branch, explicit path staging, four-package changeset; policy pins authority and defers native external source semantics; no release/workflow changes | closed |

Paths refer to the relevant package `src` directory. Evidence is backed by the
Phase 107 requirement/test matrix in `107-VERIFICATION.md`. This L1 review verifies
the planned mitigations; it is not an independent penetration test.

## Accepted Risks Log

No accepted risks. Native external-origin sender support is deferred scope, not
a bypass; the implemented route uses a verified signed launcher.

## Security Audit Trail

| Date | Threats | Closed | Open | Run by |
| --- | --- | --- | --- | --- |
| 2026-10-10 | 9 | 9 | 0 | gsd-security-auditor; parent recorded evidence |

## Sign-Off

- [x] Every threat has a disposition and implementation evidence.
- [x] No accepted-risk waiver was used.
- [x] `threats_open: 0` confirmed.
- [x] Status verified.
