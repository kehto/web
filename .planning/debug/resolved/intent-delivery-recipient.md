---
status: resolved
trigger: "assess https://github.com/kehto/web/issues/415 and attempt to resolve."
created: 2026-11-11
updated: 2026-11-11
---

## Symptoms

expected: Registered, domain-enabled targets with intent:read receive intent.deliver through sendToEligibleNapplet.
actual: The ACL resolver returns no recipient capability; recipient-gated sends reject delivery.
errors: sendToEligibleNapplet returns false.
timeline: Reported against runtime 0.26.0 and reproduced by source inspection on current main e291825d.
reproduction: resolveCapabilitiesNap({ type: 'intent.deliver' }) returns null recipientCap.

## Current Focus

hypothesis: Confirmed: intentMap omitted the current runtime push action deliver.
test: Resolver and recipient-gated runtime regressions fail before the mapping and pass after it.
expecting: Eligible runtime-originated deliveries pass through the existing recipient gate.
next_action: Commit the verified fix and open a PR closing issue 415.

## Evidence

- Protocol authority: napplet/naps master 43cb3a4e855570ec4b90b9cc05f0c721e5ad0aab, naps/NAP-INTENT.md. Wire table defines intent.deliver with delivery, runtime -> napplet, no request/delivery id, and no dependency on NAP-INC.
- Graph Tier 2, project home-sandwich-Develop-kehto, generation 2026-11-11T15:42:03Z: intentMap omits deliver; sendToEligibleNapplet resolves recipientCap and denies missing mapping. Coverage for packages/acl/src/resolve.ts and packages/runtime/src/runtime.ts has no recorded gaps. Graph describes the primary checkout; confirm exact worktree source before edits.
- timestamp: 2026-11-11T18:51:45Z
  checked: Focused regressions before the source fix, via pnpm exec vitest run packages/acl/src/resolve.test.ts packages/runtime/src/intent-dispatch.test.ts.
  found: Exactly two expected failures: intent.deliver has null recipientCap, and an eligible target's send returns false. The other 163 tests pass.
- timestamp: 2026-11-11T18:52:07Z
  checked: Same focused command after adding deliver to intentMap.
  found: Both files pass, 165 tests total. Runtime tests use restrictive ACL policy and prove delivery without inc:read; missing/revoked intent:read, blocked identity, unavailable intent domain, unknown/request-only outbound types, missing/unregistered target, and a rebound identity are denied. Source-sent intent.deliver stays silently rejected. Exact sent-envelope equality proves the delivery wire shape and target isolation.
- timestamp: 2026-11-11T18:52:30Z
  checked: Coverage for resolver/runtime tests, fixture helpers, ACL state, session registry, and package docs.
  found: No recorded gaps for the evidence paths except legacy-test-utils.ts missing from primary-checkout metadata; its entire 14-line worktree source was read directly. Worktree source confirms the inherited fixture installs the existing historical firewall without altering createRuntime's recipient path.

## Prevention

why_not_caught: The existing recipient-gated intent regression exercised intent.changed only, while resolver tests omitted intent.deliver.
guard: Parameterized changed/deliver runtime regression and explicit resolver delivery assertion.

## Resolution

root_cause: intentMap lacked the current NAP-INTENT deliver action and still described the obsolete INC carrier; recipient-gated runtime sends correctly refused messages without recipient capability mappings.
fix: Add deliver to the existing runtime-push branch returning recipient intent:read; align comments and ACL package documentation; add an ACL patch changeset.
verification: Targeted red/green proof (2 expected failures before, 165 passed after); full build and type-check pass; 267 unit files / 3414 tests pass; strict TypeDoc and docs audit pass; final Playwright run passes 132 tests with one existing skipped test; CSP audit passes; AI-slop 0.12.0 scores 100/100 with zero errors and one existing browser-llm-panel function-length warning; git diff --check clean. pnpm lint exits successfully but defines no package lint tasks; the scanner supplies lint checks. Built ACL output independently passes the issue's resolver reproduction and rejects unknown intent actions.
files_changed: packages/acl/src/resolve.ts, packages/acl/src/resolve.test.ts, packages/runtime/src/intent-dispatch.test.ts, packages/acl/README.md, docs/packages/acl.md, .changeset/intent-delivery-recipient.md, this debug artifact.

## Verification notes

- Type-check caught a test assertion using inc:read, which is not a current Capability. The fixture instead proves INC independence through a restrictive ACL with only intent:read granted and only the intent domain exposed. All gates above ran after this correction.
- An initial docs run overlapped a build refreshing declaration outputs; rerunning after the build passed without a docs workaround.
- The first full browser run had one video-currentTime timing failure. That case passed alone, and the final full run passed all 132 active tests. No media code or tests changed.
- NAP-INTENT master was rechecked before shipping and remained 43cb3a4e855570ec4b90b9cc05f0c721e5ad0aab. This fix conforms to its delivery direction and INC independence; it does not claim full NAP-INTENT conformance or change delivery scheduling, retries, buffering, or host validation.
