---
status: passed
date: 2026-10-28
---

# Verification

| Requirement | Evidence |
| --- | --- |
| Sign/publish version choice and persistence | browser-signer-consent.test.ts, browser-host-signer.test.ts, paja-version-consent.spec.ts |
| Account, publisher and artifact isolation | store vectors plus real signed manifest/Chromium account and version changes |
| Publication source authority, concurrency, forged claims | browser-operation-scope.test.ts; browser-relay-runtime.test.ts exercises scoped relay and signerless CVM with real transport signing |
| Revocation, stale windows/accounts, denial | controller/scope units, tab-close/account-switch/revoke browser cases; no denied publication retained |
| Legacy migration diagnostics | runtime store tests for warning identity/frequency, separate sign/publication grants and quiet canonical records; compatibility register |
| Link modal, Escape and activation | real NAP-LINK handler in Chromium; no open before approval, deny result, noopener/noreferrer and active click gesture, no native dialogs |
| Browser host coverage | full 159-case Chromium suite and all 2,319 units; docs/build/types pass |
| Responsive host modal | screenshot /tmp/paja-version-consent-modal.png inspected; four viewport checks prevent horizontal overflow |
| Quality | aislop 0.12.0 score95, unchanged five existing complexity warnings; pinned config untouched |

Live external radio service availability is not used as a test dependency. Its signerless CVM publication path is exercised deterministically against the real Paja service/transport with a controlled relay boundary.
