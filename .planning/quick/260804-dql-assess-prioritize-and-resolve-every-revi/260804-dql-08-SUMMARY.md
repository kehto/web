---
phase: quick-260804-dql
plan: 08
status: complete
completed: 2026-08-04
---

# Plan 08 Summary — General-review follow-up

Assessed C22–C26 from the general PR comment against the exact NAP-FS,
NAP-DM, and NAP-CONFIG draft heads and current source. C22 was already fixed;
the added concurrency regression proves pending watches reserve all 16 slots.
C23 is the NAP-DM-required exclusive error shape and is now explicit in the
changeset. C24 was not reproducible because canonical mapped literals are
already rejected by the earlier no-dot host guard; a regression preserves that
policy. C25 was valid and now honors explicit catch-all values plus the nested
JSON Schema default while retaining NAP-CONFIG's closed top-level default. C26's
dead assignment was removed.

Commits `a44d555`, `8349d74`, and `62580e1` were pushed. The itemized evidence
reply is https://github.com/kehto/web/pull/234#issuecomment-5178362244.
Source head `62580e11fbf8d6e486ba59a85f3ea859d9a1bb12` passed CI run
https://github.com/kehto/web/actions/runs/30904927876 and Changeset Guard run
https://github.com/kehto/web/actions/runs/30904927931. The final live audit found
16 total review threads, 0 unresolved, and no later general comments. The formal
`CHANGES_REQUESTED` state remains pending reviewer reapproval; it is not an
unresolved technical comment.

Local verification passed 47 focused tests, build, type-check, 1,678 unit tests,
81 Playwright tests, docs, CSP, AI-slop 100/100, and diff hygiene.
