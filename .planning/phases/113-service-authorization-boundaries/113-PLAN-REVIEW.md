## ISSUES FOUND

**Phase:** 113 — Service authorization boundaries  
**Plans checked:** 8  
**Issues remaining:** 4 blocker(s), 1 warning

### Resource execution group — PASSED

Plans **113-01 and 113-02 are ready to execute as the single `resource-wire-migration` group.** Both now prohibit a standalone completed summary, canonical/green claim, downstream start, or non-WIP commit until the full producer/service/shell/Paja consumer migration passes its shared unit, build, type, docs, browser, and quality gates.

The corrected Plan 02 assertion now distinguishes the required terminal behavior: explicit `resource.cancel` is silent; revocation of a current live source emits exactly one canonical `blocked-by-policy` terminal; teardown/replacement suppresses stale output. The protected Paja endpoint remains correctly specified: non-leaked server-instance capability, exact trusted Origin and Host, POST/non-simple-content-type checks, no CORS, rejection before DNS/connection, DNS-time public-address validation, address pinning, redirect-by-redirect authorization, and direct bypass/CSRF regressions.

### Blockers (must fix before Phase 113 execution)

1. **[requirement_coverage] No plan covers several implemented service families or the shared integration closure.**
   - Plans: phase-level; absent from 01–08
   - SVC-04/SVC-05 require every implemented approval path and revocable long-lived work. `113-RESEARCH.md` identifies COMMON, LISTS, IDENTITY, KEYS, INTENT and other account-facing services; current services also include notification/audio paths. None has an executable migration task, lifecycle proof, or explicit local-only classification. There is also no closure task for service-dispatch/registered ingress, old temporal-gate migration, and a full consumer matrix.
   - Fix: add Plan 09+ for the remaining handlers and common ingress/legacy-temporal retirement or bounded compatibility, with tests and docs.

2. **[nyquist_compliance] VALIDATION.md is absent although Nyquist validation is enabled and applicable.**
   - Plan: phase-level
   - Fix: generate `113-VALIDATION.md`; map every task to automated evidence and validate wave sampling before execution.

3. **[research_resolution] `113-RESEARCH.md` retains unresolved open questions.**
   - Plan: phase-level
   - The resolver is now chosen in Plan 01, but research does not mark it resolved; retained service-family authority/coverage questions obscure the missing migration scope.
   - Fix: record the enforcing proxy decision and exact NAP authority plus plan ownership for every remaining family, then mark the section resolved.

4. **[scope_sanity] Plan 08 exceeds the safe plan/file budget.**
   - Plan: 113-08
   - It spans 15 files and three independent protocol families (CVM, DM, WebRTC), each with distinct authorities and terminal semantics.
   - Fix: split by protocol family with separate authority, lifecycle, and revocation proof.

### Warning

1. **[scope_sanity] Plan 02 remains broad, but its atomic execution group now bounds the risk.**
   - Plan: 113-02
   - The group-level completion gate is acceptable; preserve it when revising documentation or compatibility work.

### Structured Issues

```yaml
issues:
  - plan: null
    dimension: requirement_coverage
    severity: blocker
    description: "No executable coverage for remaining implemented common/account/notification service families or shared ingress/legacy-temporal closure required by SVC-04/SVC-05."
    fix_hint: "Add Plan 09+ consumer-matrix-driven migrations and closure regressions."
  - plan: null
    dimension: nyquist_compliance
    severity: blocker
    description: "No 113-VALIDATION.md exists while Nyquist validation is enabled and applicable."
    fix_hint: "Generate the validation artifact and map all plan tasks to automated feedback."
  - plan: null
    dimension: research_resolution
    severity: blocker
    description: "RESEARCH.md has unresolved open questions tied to resolver policy and remaining service authorities."
    fix_hint: "Resolve and mark the section resolved after completing the consumer matrix."
  - plan: "113-08"
    dimension: scope_sanity
    severity: blocker
    description: "15-file CVM/DM/WebRTC plan exceeds the blocking file budget."
    fix_hint: "Split by protocol family."
  - plan: "113-02"
    dimension: scope_sanity
    severity: warning
    description: "Shell, Paja, browser, conformance, and multi-package documentation work is broad, though now bounded by the atomic resource execution group."
    fix_hint: "Retain the combined completion gate."
```

### Recommendation

**Resource group ready.** Keep the remaining phase blockers open while the planner adds the missing service closure, validation artifact, research resolution, and Plan 08 split. Re-run full Phase 113 verification after those revisions.
