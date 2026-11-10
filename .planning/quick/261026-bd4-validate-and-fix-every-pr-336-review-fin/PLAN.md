# PR 336 review follow-up

Scope: assess every item in review PRR_kwDOR8P3P88AAAABTz-qsw at d59fdaf8;
fix valid findings, document rebuttals, push to the existing PR, comment, and
request another review. Preserve unrelated primary-checkout work.

1. Check protocol authority at exact refs recorded in firewall-approvals.md;
   recheck relevant upstream heads. Resolve main conflicts preserving both
   Firewall admission and current Paja behavior.
2. Runtime lane: relay.query approval/rate/cancellation, principal-scoped
   persistent revocation, and dispatch budgets for uncoordinated domains.
3. Service lane: outbox.getEvent and legacy router enforcement, relay publish
   destination binding, theme/identity terminal denial responses.
4. Host/docs lane: compatibility diagnostics/tests, whitespace, policy nav,
   CSP upgrade contract/browser proof, Paja canonical origin, playground
   expired approval handling, and breaking-change changesets.
5. Keep existing behavior regressions, add adversarial cases before fixes;
   avoid unnecessary abstractions. Classify optional planning split on its
   merits rather than dropping the implementation record.
6. Run build, type-check, unit, lint, docs, full relevant Chromium suite,
   pinned AI-slop, changeset and whitespace gates. Review final changes.
7. Commit bounded changes with Lore trailers. Verify live PR head before push;
   push, post response covering all rejected claims, rerequest nrahulpub, then
   verify those remote actions.

Evidence: GitHub API review; graph kehto-pr336-review indexed 2026-10-26;
NAP-RELAY PR2 9f30b350, OUTBOX PR32 8865f73d, RESOURCE PR80 ae5b9c64,
THEME/IDENTITY/SHELL master 19de5ce1. Exact downloaded specs are read before
changing the corresponding surface; record any bounded gaps in the summary.
