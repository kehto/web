---
phase: quick-261101-ojp
plan: "01"
subsystem: playground
tags: [deprecation, retirement, pages, e2e, docs]
status: complete
completed: 2026-11-01
requires: []
provides:
  - "@kehto/playground removed from workspace, build, CI, Playwright and docs"
  - "Tracked /web/playground/ redirect to Paja (KEHTO_PLAYGROUND_RETIRED)"
affects: [playground, pages, e2e, docs]
key-decisions:
  - "Retire outright instead of freezing: frozen workspace code would still need to build and pass e2e."
  - "Keep the public URL as a warned, audited, tested redirect; register it in docs/compatibility.md."
  - "Keep shared-package assertions by decoupling them; port NAP-THEME e2e to the harness fixture."
  - "No changeset: the app was private; published packages change only in README prose and one comment."
plan_head_before: c0f7cbe0
---

# Quick 261101-ojp summary

Commits: bb9817a2 (retire app + wiring + tests), 2f30b170 (docs).

Verification: pnpm build, pnpm type-check, pnpm test:unit (165 files / 2263
tests), VITEPRESS_BASE=/web/docs/ pnpm docs:check, pnpm build:pages +
pnpm audit:pages, pnpm audit:csp (12 fixture artifacts), Playwright full suite
(94 specs; nap-theme fix re-run 3x). Local e2e used a temporary harness port
because an unrelated project held :4173. aislop 95/100: 0 errors and 5 warnings,
the same warnings as main, all in untouched files.

Coverage removed with the app: playground-hosted e2e for relay publish/
subscribe, storage persistence, ACL revoke, identity/signer flows, CVM, and the
gateway-artifact parity audit. Harness (nap-relay/storage/notify/inc/theme) and
Paja specs remain; runtime/services unit tests are unchanged.
