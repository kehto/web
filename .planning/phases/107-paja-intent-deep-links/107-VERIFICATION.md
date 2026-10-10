---
phase: 107-paja-intent-deep-links
status: passed
verified: 2026-10-10
requirements_verified: [LINK-01, LINK-02, LINK-03, LINK-04, LINK-05, LINK-06, LINK-07, LINK-08, LINK-09, LINK-10, LINK-11, LINK-12]
pr: 289
---

# Phase 107 Verification

Implementation acceptance and PR shipping passed. No merge or release is
authorized by this closeout.

## Requirement evidence

| Requirement | Implemented behavior | Behavioral evidence |
| --- | --- | --- |
| LINK-01 | Complete outer intent URI, two independent decode layers, literal plus, 16 KiB cap, strict duplicate/conflict rejection; pointer-only compatibility | `packages/paja/src/intent-link.test.ts`; `packages/shell/src/napplet-namespace.test.ts` URI normalization/rejection suites |
| LINK-02 | Exact authorized pointers fail closed; defaults precede named recommendations; explicit chooser bypasses defaults | `packages/services/src/catalog-intent-resolver.test.ts`; `tests/e2e/paja-intent-links.spec.ts` saved-default, recommendation accept/decline, mismatch/change-routing cases |
| LINK-03 | Separate outer JSON preserves null, primitive, array and object data; URI query conflict rejected | `intent-link.test.ts`; browser copied-JSON roundtrip; builder JSON mode test |
| LINK-04 | Share builder reads verified ordered params; omitted/empty/custom values remain distinct; no inferred types; empty params allow JSON | `browser-intent-builder.test.ts`; browser text parameter and empty-contract JSON cases |
| LINK-05 | Default/recommend/exact routing, preview, Copy and explicit Test; ordinary app share remains | Builder unit tests, `browser-runtime-tabs.test.ts`, browser mouse/keyboard Share→Create paths and copied URL navigation |
| LINK-06 | Review/edit/Launch, compatible chooser, explicit save/clear default, cancel/retry/choose-another | Browser saved-default/chooser policy case, delayed Escape cancellation, exact mismatch recovery; review controller behavioral test |
| LINK-07 | Synchronous retained acceptance, current authenticated readiness, one target-only delivery, no restore replay or source-teardown cancellation | `browser-intent-controller.test.ts`, service resolver tests, browser delayed-target-after-launcher-teardown and warm no-replay cases |
| LINK-08 | Same-role z/i contracts retain ordered params; opaque named/root/snapshot IDs; host consumers use shared canonical contracts | NIP current-manifest/catalog-ID tests; manifest-intent-catalog, installed catalog and playground catalog/controller tests; existing Paja and playground browser regressions |
| LINK-09 | Verified signed launcher provides source identity; external fields cannot impersonate sender; source is registered before srcdoc | `intent-launcher.test.ts`, forged-sender service test, protected namespace tests, browser signed-launcher provenance/forged-message/delayed-readiness case; security T1/T6/T8 |
| LINK-10 | Active README/package/how-to/migration/policy docs agree; four-package minor changeset; parsers separate from UI | `pnpm docs:check`; stale-string sweep; `.changeset/paja-intent-links.md`; compatibility warning tests |
| LINK-11 | Repository gates and real browser regressions pass | Gate table below; `107-SECURITY.md` closes all 9 planned threats |
| LINK-12 | Atomic feature commits, isolated checkout, explicit staging; PR is the shipping boundary | [PR #289](https://github.com/kehto/web/pull/289), open from the verified feature branch |

Paths without prefixes above refer to `packages/paja/src`. Tests use signed
manifest/artifact fixtures and actual opaque-origin iframe handshakes; browser
Share checks wait for modal focus ownership without retry or fixed-delay masking.

## Gate evidence

| Command | Result |
| --- | --- |
| `pnpm build` | PASS |
| `pnpm type-check` | PASS |
| `pnpm test:unit` | PASS — 2,085 tests in 163 files |
| `pnpm test:e2e` | PASS — 120 tests, 2.6 minutes |
| `pnpm docs:check` | PASS — strict TypeDoc, docs build and package-doc audit |
| `aislop@0.12.0 scan -d` | PASS — 95/100, zero errors, five size warnings |
| `git diff --check` | PASS |
| GSD security audit | PASS — 9 closed, 0 open, ASVS L1 |

The pinned AI-slop configuration is unchanged. Remaining warnings are long
host/builder/parser functions and host/CVM file size; no suppressions were added.
The unrelated CVM extraction attempted during cleanup was removed from the final
change so its original API documentation and behavior remain intact.

One early full-unit run hit a CVM real-timer timeout under concurrent work;
subsequent final full runs passed without weakening those tests. A concurrent
docs/browser build briefly removed generated declarations; the sequential docs
rerun passes. Browser verification fixed a real Share focus loss when a loading
sandbox iframe stole modal focus.

## Protocol authority and scope

Both upstream heads were rechecked with `git ls-remote` before shipping:

- NAP-INTENT PR #106: `napplet/naps@fc121fc264615482143eda86125863d2e1f741a2/naps/NAP-INTENT.md`.
- NIP-5D PR #2303: `dskvr/nips@020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7/5D.md`.

Result: conformant to the pinned working contracts through the verified launcher
path. Native external-origin sender semantics remain intentionally deferred as
an upstream spec gap. Published `@napplet/nap@0.32.0` lacks the updated contracts;
local service types are a bounded documented exception pending upstream exports.
Legacy object invokes and INC listener adaptation each have a stable bounded
warning and documented removal condition.

## Shipping record

[PR #289](https://github.com/kehto/web/pull/289) is open from
`feat/paja-intent-links` to `main`. Atomic commits and this closeout record are
pushed. The primary checkout's unrelated `package.json` work remains untouched.
GitHub CI is allowed to complete on the PR; no merge or release was performed.
