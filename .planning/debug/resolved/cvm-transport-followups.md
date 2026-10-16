---
status: resolved
trigger: "Issue #271: CVM transport follow-ups from PR #265"
---

## Evaluation and authority

All five observations still apply to main `fcf0a387`. Checked NAP-CVM draft #31
at `28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f` and ContextVM CEP-41 at docs
commit `3b4f9dc9f9012a418abd9faec6a70db774754862`,
`src/content/docs/reference/ceps/cep-41.md`.

CEP-41 permits bounded grace or immediate failure when gaps remain at close.
Choose immediate failure for a boundless close with unresolved buffered gaps;
contiguous runs already drain when their missing predecessor arrives. Never
silently report successful closure while discarding buffered chunks.

Raise the reassembly ceiling to 300 seconds, but current NAP-CVM forbids progress
from resetting request deadlines. Remove that older behavior in the same change
and verify shorter request timeouts still win. Document outbound oversized-request
limits and host concurrency ownership. Replace per-ID keypair derivation with
random bytes. These choices update the older report toward current authority.

## Current focus

Implement and test the five follow-ups, with explicit transport-scope conformance
and no claim that this patch supplies every newer NAP-CVM session/payment field.
GSD debug runs inline. The shared fake-clock test prerequisite from #309 is
carried before these transport changes.


## Resolution and verification

The transport fails close-with-gaps immediately, allows reassembly through
300 seconds, and keeps the original request deadline despite progress. Random
correlation/nonce suffixes now use four random bytes without deriving keys.
Outbound CEP-22 request chunking and per-napplet concurrency ownership are
explicitly documented. This is scoped conformance to the checked NAP-CVM
lifetime rule and CEP-41 reassembly contract, not a claim that all newer
NAP-CVM session/payment semantics are implemented.

Validation passed: 38 focused CVM tests, 2,160 unit tests / 169 files, build
(32 tasks), type-check (17 tasks), docs audit (9 packages), 123 Playwright tests,
and AI-slop 100/100. Existing CEP-41 timing probes now use the fake clock so
crypto/signing load does not consume their deadline during test preparation.
