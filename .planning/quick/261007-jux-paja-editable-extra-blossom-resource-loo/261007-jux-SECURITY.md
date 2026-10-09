---
phase: quick-261007-jux
status: verified
threats_open: 0
asvs_level: 1
created: 2026-10-07
---

# Extra Blossom Resource Servers — Security

Plan-authored threat register reviewed at ASVS level 1, blocking threshold high.
Review scope: implementation diff `d6584812..ecdc9f6e`, settings tests and existing resource fetch boundary.

## Trust Boundaries

- Textarea and localStorage are untrusted inputs to host-owned lookup candidates.
- Napplet requests remain source-bound; candidate bodies retain existing resource verification and browser policy.

## Threat Register

| Threat | Severity | Disposition | Evidence | Status |
| --- | --- | --- | --- | --- |
| T-jux-01: origin tampering | high | mitigate | `browser-resource-settings.ts:5–17,25–32,41–48` constrains shorthand, delegates to the public HTTPS validator, revalidates storage, and rejects an entire invalid draft before mutation. Table-driven tests cover private literals, malformed origins and mixed drafts. | closed |
| T-jux-02: UI injection | high | mitigate | `browser-resource-settings.ts:68–75` uses `value`, `textContent` and `setAttribute`, never HTML insertion. Errors use line numbers, not rejected markup. DOM regression exercises markup input. | closed |
| T-jux-03: network disclosure | medium | mitigate | `browser-resource.ts:177–184,200–210` retains omitted credentials, no referrer, redirect refusal and SHA verification. Adapter change only appends a live getter; no upload, pointer or CSP mutation. Integration and browser tests verify these exclusions. | closed |
| T-jux-04: candidate amplification | medium | mitigate | Existing resolver/fetch combined eight-origin cap and response caps/cancellation unchanged. Integration test verifies eight attempts despite ten configured extras. Save performs no network fetch. | closed |
| T-jux-05: misleading persistence | medium | mitigate | `browser-resource-settings.ts:49–57` activates valid session settings but explicitly warns on failed writes/removes and possible stale-list restoration. Tests cover access/read/write/remove failure. | closed |
| T-jux-06: DNS private resolution | medium | accept | Existing browser-only limitation; public-origin syntactic checks cannot pin DNS-resolved addresses. Documented in package docs and summary; no new bypass or claim of full NAP network conformance. | closed — accepted |

## Accepted Risks

T-jux-06 retains the existing browser DNS-resolution limitation within this bounded host-settings change. Production DNS-time enforcement is not implemented or claimed here. The separate pre-existing whole-host throwing-localStorage-getter startup bug remains documented in `deferred-items.md` and is not represented as fixed.

## Specification Review

Checked `napplet/naps/naps/NAP-RESOURCE.md` at pinned `9511232f69313aa7953d110e35d32cc28d506f66` and PR #80 head `fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1`. Host lookup configuration is compatible with the runtime-owned fetch policy. Existing hint/bulk wire drift is recorded, not migrated.

## Audit Trail

2026-10-07 — GPT-6.1 Sol: all six plan threats resolved by implementation evidence or existing bounded accepted risk; zero open blocking threats. Focused unit, integration and 89 full-suite Playwright tests passed. No rules disabled.
