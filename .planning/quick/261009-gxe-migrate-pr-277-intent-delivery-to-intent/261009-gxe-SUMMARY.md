---
quick_id: 261009-gxe
status: complete
---
# PR #277 intent delivery and compatibility

Implemented review 5473114400 on the existing PR branch, preserving the merged
main changes (016e9cf3). Commit 05d3e013 sends one intent.deliver from each host,
adds protected parent-bound buffering/onDelivery, admits handlers based on intent
availability without INC, and migrates the profile demo. Its local INC adapter
warns once per iframe, prefers canonical listeners, and never replays to both.
Legacy manifest resolution warns once per module lifetime after verification.

The compatibility register records warning IDs, owners, regressions, removal
criteria and pre-existing diagnostic/test debt. It explicitly distinguishes
unobservable field/type compatibility from observable fallback use. The user's
latest instruction is honored: AGENTS.md is unchanged here; the policy is in
independent PR #284 (docs/compatibility-policy from main e312f3c3).

Authority: naps/NAP-INTENT.md at napplet/naps@25b29ee49e5bff8ebfe031f4b76dce98705c8b7e
(delivery change 389c1c2aa2c8b70610f9f53f2c0dd097e313dcea), NIP-5D at
020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7. Delivery aligned. The missing packaged
@napplet/nap 0.32.0 delivery API is bridged and tracked as INTENT_BINDING.
URI invocation, accepted-result lifecycle, catalog identifiers/naddr and broader
upstream NAP migration are intentionally deferred. No full current-NAP conformance
claim. Legacy INC delivery is a bounded Kehto transition policy.

## Verification

- Build: 32/32 tasks. Type-check: 17/17 tasks.
- Unit: 1,884/1,884 across 153 files.
- E2E: full 90-scenario run had 89 passes and one stale profile manifest expectation
  (INC versus intent). Corrected it; gateway-artifact-parity recheck passed 2/2.
  Strengthened Paja canonical case with INC disabled and no compatibility warning;
  final paja-runtime-pointer recheck passed 4/4. All 90 scenarios are accounted for.
- Docs: strict TypeDoc, VitePress, audit of all 9 public packages pass. Corrected
  stale parameter docs and TypeDoc-copied Markdown links encountered by the gate.
- Pinned aislop 0.12.0 passes, 99/100. Sole existing finding is 1201-line
  packages/services/src/cvm-nostr-transport.ts. No rule/config changes.
- git diff --check passes. Primary package.json workspace WIP preserved.

Logs: /private/tmp/pr277-delivery-{build,type,unit,e2e,e2e-recheck,paja-final,docs}.log
and /private/tmp/pr277-delivery-slop.json.
