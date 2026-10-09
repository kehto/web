---
status: passed
date: 2026-09-30
---

# Verification

| Requirement | Evidence | Result |
| --- | --- | --- |
| Host-customizable shared policy | Public exports, directive replacement/grant tests, real successful HTTP fetch under an explicit grant | Passed |
| Shell enforces CSP SHOULDs | No opt-out in prepareNappletSrcdoc; malformed/script/comment insertion cases tested in Chromium | Passed |
| WASM without broad JS evaluation | Public package browser test and both Paja policy cases instantiate real WASM and block Function | Passed |
| Reference host wiring | Both frame loaders use prepareNappletSrcdoc; parity guards and full host browser suite pass | Passed |
| Verification and identity provenance | Existing signature/hash/aggregate rejection tests and gateway/source/sandbox guards pass | Passed |
| Existing policies and host restrictions | Authored policy intersection and host WASM-disable browser tests pass | Passed |
| NAP-SHELL lifecycle preserved | Full unit/browser suites include receiver, source trust, readiness, capabilities and reload regressions | Passed |
| Docs and release metadata | Strict docs gate, normative/default mapping, shell/Paja minor Changesets | Passed |
| Unrelated work excluded | Only the prior package.json edit remains dirty after source commit | Passed |

Inline code review checked directive/attribute injection (including percent-decoded
host delimiters), prototype keys, policy intersection, prelude suppression,
canonical origin handling, and preparation before frame rebinding. No unresolved
findings. No policy-rule disables were added.

This verifies the implemented CSP boundary, not a claim that a string-preparation
helper performs artifact resolution or replaces the browser sandbox.
