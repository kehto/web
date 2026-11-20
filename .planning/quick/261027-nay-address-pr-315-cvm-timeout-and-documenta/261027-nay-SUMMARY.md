---
status: complete
commit: bab52862
---
# PR #315 review addressed

Used existing worktree `~/.worktrees/kehto/cvm-transport-followups` and branch
`fix/cvm-transport-followups`. The primary checkout's unrelated package.json edit
was preserved. Merged origin/main (9fdb521e) in bbcfc1b8 without rewriting history;
the UPLOAD and CVM documentation both remain.

Commit bab52862 validates integer durations 1..300000 before transport session or
relay acquisition/publication. One monotonic admission deadline spans initialize,
shared-init waits, initialized-notification publication and the final response.
Timeout errors remain `relay timeout`; late initialization cannot continue expired
operations, and late response/progress cannot beat delayed timeout callbacks.
The request deadline owns buffer cleanup, replacing the unreachable independent
CEP-22 expiry timer. Corrected documentation, dead JSDoc/spacing, indentation,
120-second test wording, brittle random-byte spy and prerequisite attribution to
PR #314. The services minor changeset is preserved and updated.

Authority rechecked: NAP-CVM draft #31 at napplet/naps@
28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f and CEP-41 at
contextvm/contextvm-docs@3b4f9dc9f9012a418abd9faec6a70db774754862.
Transport timeout/reassembly/close policy is conformant within this scope.
No lower timeout policy maximum is configured. Full session/registry/payment
conformance remains outside scope. Per-napplet concurrency admission is specified
SHOULD debt, tracked separately in https://github.com/kehto/web/issues/355.

Validation of final source:
- pnpm build: 32/32 tasks passed (also run by type-check).
- pnpm type-check: 17/17 tasks passed.
- pnpm test:unit: 2304/2304 tests in 178 files passed; focused transport: 57/57.
- pnpm docs:check: TypeDoc strict, VitePress and nine-package docs audit passed.
- pnpm test:e2e: 147/150 initially passed. Three unchanged Paja manifest Share
  clipboard status tests failed; targeted rerun passed two, second rerun passed
  the remaining one. All 150 scenarios have passing evidence. The CVM bridge
  scenario passed again against final source.
- AI-slop 0.12.0: 95/100, zero errors, five inherited file/function size warnings
  in Paja, shell intent URI and the existing large transport module. No rule or
  config changes; gate passes. These warnings predate this review fix.
- git diff --check passed.

Dependency refresh used pnpm install --frozen-lockfile after merging main.
The first build/unit attempt used stale pre-merge dependencies. Concurrent build
commands also caused one declaration-output race; serialized final checks passed.
A playground relay activity wait failed under parallel build load; the final full
unit suite passed with build tasks finished. No unrelated source was modified.

Delivery: update existing PR https://github.com/kehto/web/pull/315 with the commits,
review corrections, checked authorities, verification and remaining limits.
