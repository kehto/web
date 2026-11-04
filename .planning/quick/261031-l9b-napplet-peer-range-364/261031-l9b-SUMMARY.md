---
quick_id: 261031-l9b
status: complete
issue: https://github.com/kehto/web/issues/364
commits: [2977db05, a64e488d]
---

# Summary: 261031-l9b — @napplet peer ranges admit the llm line (#364)

- Peers in acl, cli, firewall, paja, runtime, services, shell: `@napplet/core` `>=0.32.0 <0.37.0`,
  `@napplet/nap` `>=0.32.0 <0.36.0`. Dev pins stay on the 0.32.0 baseline.
- Verified against core 0.36.0 + nap 0.35.1 via a temporary (reverted) pnpm override: build and
  type-check green; unit suite green except the three guards that reject the override itself.
- Type-level check: the services llm mirror and `@napplet/nap@0.35.1` `llm/types` are mutually
  assignable (models, requests, generations, deltas, failures, usage, inbound/outbound unions,
  error-code tuple), with a negative control confirming the check runs.
- npm repro with packed acl/firewall/runtime tarballs: no ERESOLVE/invalid peers against
  core/nap 0.35.0/0.35.0 or 0.36.0/0.35.1.
- Guards: per-name peer ranges; new docs guard requires each docs package page to list
  the published peer rows (caught the missing cli table and stale `<0.33.0` rows).
- Gates: build, type-check, test:unit (2453 passed), docs:check, aislop 95 (baseline, five
  pre-existing complexity rows in untouched files).
- Out of scope: JSR import maps stay `^0.32.0` (guarded); the mirror-to-upstream swap waits for the dev baseline to move to 0.35.
