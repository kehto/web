---
status: investigating
trigger: "Issue #304: ACL revoke/block leaves ordinary relay subscriptions delivering to denied principals"
---

## Symptoms

Both direct relay adapters and registered relay services continue delivering after
`relay:read` revocation or principal blocking. New subscriptions are denied.

## Evidence and protocol authority

- Base: `origin/main` at `fcf0a387`.
- NAP-RELAY draft PR napplet/naps#2 checked at
  `9f30b3505335a52c574ff570576687d6467021ff`, `naps/NAP-RELAY.md`.
  It allows ACL enforcement and policy termination with `relay.closed`.
  Synchronous ACL revocation is a host policy, consistent with that contract.
- Runtime ACL mutation observer only revokes INC windows. Ordinary subscription
  callbacks check key presence, so they survive revocation and can revive when
  a later subscription reuses that key.
- Graph discovery returned no relevant runtime definitions; source inspection used.
- GSD debug runs inline. The primary checkout's package.json work is unrelated.

## Current focus

Reproduce issue through both public paths, retire subscriptions for exact matching
principals, invalidate queued callbacks across regrant/reuse, and verify unrelated
principals and non-read capability revocation remain unaffected. Ship a PR for #304.

## Verification progress

- Commit `5b177626` fixes #304. Eight regressions pass, including revocation during
  synchronous backend delivery. The original four reported paths failed before
  the fix. Build and type checks pass.
- The full unit gate exposed pre-existing unhandled rejections in six CVM negative
  probes with 100–120ms real deadlines. Use their existing fake-clock helper and
  observe rejection before frame preparation; all 34 transport tests now pass.
  No CVM runtime behavior or expected error changes. Checked NAP-CVM PR #31 at
  `28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f`: timeout expiry remains `relay timeout`.
- The first docs run raced declaration builds; rerun after build completion.
- Browser validation uses a temporary IPv6 preview configuration because another
  project owns IPv4 port 4173. No other process was stopped or reused.
