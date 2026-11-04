---
phase: quick-261101-pfc
plan: "01"
subsystem: e2e
tags: [e2e, paja, relay, storage, acl, identity, cvm]
status: complete
completed: 2026-11-01
requires: [quick-261101-ojp]
provides:
  - "Paja e2e for relay publish/publishEncrypted/subscribe and live relay:write revoke"
  - "Paja e2e for storage persistence, instance isolation and live state:write revoke"
  - "Paja e2e for signer-driven identity and NIP-07 reconnect on reload"
  - "Paja e2e for CVM discovery and a gift-wrapped tools/call"
affects: [e2e, paja, docs]
key-decisions:
  - "Drive only the injected window.napplet.* API so specs survive the NIP-5D port-bound transport change."
  - "Assert both ends: napplet result and in-test relay wire traffic."
  - "Record, not fix, the NAP-IDENTITY gap (Paja re-initializes the napplet on signer change instead of pushing identity.changed) via test.fixme; a Paja behavior change is out of scope for a test migration."
  - "No changeset: test and docs only."
plan_head_before: 41247129
---

# Quick 261101-pfc summary

Commits: 08bbf248 (specs, helpers, selector), 59bb9b72 (docs).

Verification: pnpm build, pnpm type-check, pnpm test:unit (165 files / 2264
tests), pnpm docs:check, Playwright: all paja-* specs pass (new: 10 passed,
1 fixme skipped). Local e2e used a config without the harness webServer
because an unrelated project held :4173. aislop 95/100: 0 errors, the same 5
warnings as main, all in untouched files.
