---
status: complete
---

# Runtime-first narrative

Updated landing title, metadata, hero, README, and docs introduction to lead with
building runtimes for sandboxed apps. Nostr remains in supporting implementation
copy as the underlying protocol. Package names and protocol behavior are unchanged.
Existing responsive browser assertions now protect this positioning.

Validation: build and type checks pass; all 2,096 unit tests pass with
`--maxWorkers=2`; strict docs and full Pages build/audit pass; all seven landing
browser tests pass; changed-file AI-slop score is 100/100; diff whitespace check
passes. The initial default-concurrency unit run encountered local relay timeouts
under machine load; the complete lower-concurrency rerun passed without code changes.
The existing runtime browser suite was not rerun for this copy-only correction.

Continues PR #296 on feat/kernl-rebrand. The unrelated package.json workspace edit
is excluded.
