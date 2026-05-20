---
phase: 40-nub-resource-demo-policy
validated_at: 2026-05-20
validator: gsd-nyquist-auditor (retroactive — v1.8 Phase 43)
status: passed
score: 5/5
---

# Phase 40: NUB-RESOURCE Reference Service + Demo Napplets + Policy Docs — Retroactive Validation

## Validation Source
Validated against `.planning/milestones/v1.7-ROADMAP.md` Phase 40 Success Criteria (canonical) plus shipped evidence in the working tree and per-plan SUMMARY.md files under `.planning/milestones/v1.7-phases/40-nub-resource-demo-policy/`.

## Per-Criterion Verdicts

### Criterion 1: `createResourceService` factory throws on construction if `getConnectGrants` is missing (the dependency is required, not optional).
- **Verdict:** PASS
- **Evidence:** `packages/services/src/resource-service.ts:172-186` declares the H-03 construction guard that throws with `/H-03/` message if any of the 4 required options is absent. `packages/services/src/resource-service.test.ts` covers H-03 fire on empty options (test a) and partial options (test b). Behavioral spot-check in `40-VERIFICATION.md` confirms guard fires from built dist via `node --input-type=module` import.

### Criterion 2: resource-demo napplet successfully fetches from a granted origin and receives a `denied` response for an ungranted origin (asserted by `nub-resource.spec.ts`, two tests).
- **Verdict:** PASS
- **Evidence:** `apps/demo/napplets/resource-demo/src/main.ts` dispatches two `resource.bytes` envelopes (`GRANTED_URL='http://localhost:4174/demo-data.json'`, `DENIED_URL='https://untrusted.example/'`) and populates `#resource-demo-granted` (decoded JSON `"kehto demo"`) and `#resource-demo-denied` (`code=denied`). `tests/e2e/nub-resource.spec.ts` (68 lines, 2 tests) asserts both sentinels via `frameLocator('#resource-demo-frame-container iframe')`. Auto-grant block in `apps/demo/src/main.ts:670-701` calls `grantFn('resource-demo', '', 'http://localhost:4174')` before `DEMO_NAPPLETS.map(loadNapplet)`. Recorded GREEN in `40-ITERATION-LOG.md` 71/0/0 close.

### Criterion 3: `resource.cancel` correctly correlates to the corresponding `resource.bytes` request and emits `resource.bytes.error` with `canceled` typed-error code.
- **Verdict:** PASS
- **Evidence:** `packages/services/src/resource-service.ts` maintains `inFlight: Map<requestId, { controller, windowId }>` and `perWindow` secondary map; `resource.cancel` handler invokes `inFlight.get(requestId).controller.abort()`. `resource-service.test.ts` test (f) asserts cancel-correlation emits `canceled` error; test (i) covers `onWindowDestroyed` cleanup path. Cross-verified `40-VERIFICATION.md` Observable Truth #3.

### Criterion 4: `DEMO_NAPPLETS` is 12 entries; `CLASS_BY_DTAG` has a corresponding entry for every napplet; `CANONICAL_NUB_DOMAINS` is extended to include `config` and `resource`.
- **Verdict:** PASS
- **Evidence:** `apps/demo/src/shell-host.ts` `DEMO_NAPPLETS` count = 12 (behavioral spot-check); `CLASS_BY_DTAG` at line 278 includes `['resource-demo', null]` as 12th entry (plus all prior 11). `packages/shell/src/shell-init.ts:24-26` defines `CANONICAL_NUB_DOMAINS` including `'config', 'resource'` (10 domains total). CLASS_BY_DTAG module-load assertion `[CLASS-04 / H-05]` would fire at build if any `DEMO_NAPPLETS` d-tag lacked a CLASS_BY_DTAG entry — build passed, assertion held.

### Criterion 5: `docs/policies/` directory exists with SHELL-CLASS-POLICY.md, SHELL-CONNECT-POLICY.md, and SHELL-RESOURCE-POLICY.md — each with a canonical source header (napplet repo path + commit SHA + copy date).
- **Verdict:** PASS
- **Evidence:** All 3 files confirmed present on disk: `docs/policies/SHELL-CLASS-POLICY.md`, `docs/policies/SHELL-CONNECT-POLICY.md`, `docs/policies/SHELL-RESOURCE-POLICY.md`. `ls docs/policies/*.md | wc -l` = 3. Each opens with HTML `<!--` comment block containing `Source:` + GitHub URL + commit SHA (SHELL-RESOURCE-POLICY.md: SHA `27e1624`, copy date 2026-04-24, 246 lines). `README.md` lines 65-67 reference all 3 policy files. Cross-verified `40-VERIFICATION.md` Required Artifacts table.

## Summary
- Total criteria: 5
- PASS: 5
- FAIL: 0
- N/A: 0
- Overall: **passed** — H-03 factory guard prevents missing-dependency footgun, resource-demo round-trip green for both granted + denied paths, cancel correlation correct, demo napplet roster + class map + canonical domain list all consistent at 12/12/10, and full policy-doc set complete with canonical headers. E2E baseline 67 → 71 (+4 = 2 resource + 2 class-invariant extension).

## Notes
One cosmetic anti-pattern noted in `40-VERIFICATION.md` and `v1.7-MILESTONE-AUDIT.md` tech debt: `apps/demo/napplets/resource-demo/index.html:61` h2 label still reads "granted fetch (localhost:5174)" while `GRANTED_URL` correctly uses :4174. Zero functional impact (E2E asserts sentinel content, not h2). Tagged for v1.8 polish.
