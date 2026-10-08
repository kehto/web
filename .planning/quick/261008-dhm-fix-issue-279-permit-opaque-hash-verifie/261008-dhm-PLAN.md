---
phase: quick-261008-dhm
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/paja/src/browser-resource.ts
  - packages/paja/src/browser-resource.test.ts
  - packages/paja/README.md
  - docs/packages/paja.md
  - docs/policies/SHELL-RESOURCE-POLICY.md
  - .changeset/paja-opaque-blossom-resources.md
autonomous: true
requirements: [ISSUE-279]
estimate:
  tokens: 18000
  raw_tokens: 18000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - Capped hash-verified opaque Blossom bytes reach single and bulk resource callers unchanged as application/octet-stream.
    - Recognized MIME including GB ROM remains byte-sniffed; upstream type cannot determine delivery MIME.
    - Matching-hash SVG, HTML, XML and script markup remain blocked.
    - HTTP(S)/data policies, wire/API, limits, ordering and sibling isolation remain unchanged.
  artifacts:
    - path: packages/paja/src/browser-resource.ts
      provides: Internal recognized/opaque/blocked classification with Blossom-only fallback
    - path: packages/paja/src/browser-resource.test.ts
      provides: Boundary and adapter-service regression coverage
    - path: .changeset/paja-opaque-blossom-resources.md
      provides: Paja patch release entry
  key_links:
    - from: fetchBlossomResource
      to: readCappedResponse and verifyBlobHash
      via: Both checks precede opaque delivery
    - from: createPajaAdapter resource service
      to: createPajaResourceFetch
      via: Existing single and bulk request paths
---

<objective>
Resolve issue #279 by permitting unknown opaque bytes only from capped SHA-256-verified Blossom resources, without treating blocked markup as unknown or broadening other schemes or public contracts.
</objective>

<execution_context>
@/home/robert/.config/opencode/gsd-core/workflows/execute-plan.md
@/home/robert/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@.planning/STATE.md
@packages/paja/src/browser-resource.ts
@packages/paja/src/browser-resource.test.ts
@packages/paja/src/browser-adapter.ts
@packages/services/src/resource-service.test.ts
@packages/paja/README.md
@docs/packages/paja.md
@docs/policies/SHELL-RESOURCE-POLICY.md

Existing branch: feat/paja-opaque-blossom-resources, main baseline bbbca649. Quick workflow already initialized. Planning makes no source edits or commits.

Specification rechecked before planning on 2026-10-08: napplet/naps PR #80 nub-resource, head fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1, naps/NAP-RESOURCE.md:
https://raw.githubusercontent.com/napplet/naps/fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1/naps/NAP-RESOURCE.md
It requires byte sniffing, scheme-appropriate allowlists, verified Blossom hashes, complete Blobs, ordered independent bulk items, and forbids raw SVG. This fallback is a bounded Kehto scheme policy, never permission to bypass SVG prohibition. Existing server-hint wire draft drift, HTTP developer-policy exceptions, DNS enforcement differences and SVG rasterization implementation are outside scope; do not claim full draft compliance or alter those contracts.

Approved decisions: D-01 recognized/opaque/blocked classification; D-02 capped verified Blossom-only fallback; D-03 preserve recognized MIME, ignore upstream type, unchanged HTTP(S)/data and wire/API; D-04 fetch/adapter single and mixed bulk regressions; D-05 three docs, patch changeset, full shipping gates.
Discovery Level 0: existing internal patterns and dependencies suffice. Calibration factor 1, sample count 0, confidence low. No new packages.
</context>

<tasks>
<task type="tracer" tdd="true">
  <name>Wire one opaque Blossom path through fetch and real adapter delivery</name>
  <files>packages/paja/src/browser-resource.ts, packages/paja/src/browser-resource.test.ts</files>
  <behavior>
    - A deterministic invalid-UTF-8 binary vector with its actual SHA-256 returns exact bytes and application/octet-stream at the fetch boundary.
    - Existing createPajaAdapter resource.bytes handling returns one correlated result with identical Blob bytes, blob.type and mime equal to application/octet-stream.
    - Recognized MIME and matching-hash SVG rejection remain green.
  </behavior>
  <action>Write failing fetch and adapter regressions first using sha256Hex and existing service setup/cleanup. Per D-01, replace internal nullable MIME classification with a discriminated recognized-MIME/opaque/blocked result; keep it internal without changing exports. Preserve all signature and text/JSON recognition, including GB header/checksum. Per D-02, only fetchBlossomResource selects application/octet-stream for opaque results, after readCappedResponse and successful verifyBlobHash. Blocked results still throw decode-failed. Per D-03, HTTP(S)/data accept recognized results only; upstream Content-Type remains ignored. Keep abort behavior, server selection, error precedence, redirects, credentials/referrer controls, caps and resource.info unchanged. Keep blocked markup detection distinct from invalid UTF-8/NUL opaque detection so fallback cannot reclassify blocked markup. Reuse existing adapter and service wiring; the adapter test is the end-to-end tracer, not a mocked classifier test.</action>
  <verify><automated>pnpm test:unit packages/paja/src/browser-resource.test.ts</automated></verify>
  <done>New fetch and real adapter tests fail before implementation and pass afterward with exact bytes and MIME; recognized types and raw SVG rejection remain intact.</done>
</task>

<task type="auto" tdd="true">
  <name>Expand scheme-isolation, integrity, limits and mixed-bulk regressions</name>
  <files>packages/paja/src/browser-resource.test.ts, packages/paja/src/browser-resource.ts</files>
  <behavior>
    - Invalid-UTF-8 and NUL-bearing unknown binary succeeds only for matching-hash Blossom, not data/HTTP/HTTPS.
    - Matching-hash SVG, XML-prefixed SVG, HTML, XML and script prefixes stay blocked, including whitespace/case and NUL-bearing markup cases.
    - Recognized binary signatures, checksum-valid GB ROM, JSON and plain UTF-8 retain MIME despite misleading headers.
    - Opaque hash mismatch produces decode-failed, never a successful Blob; later matching server fallback still works.
    - Declared oversize and actual streamed oversize without truthful Content-Length produce too-large; existing cancellation, server and bulk caps remain enforced.
    - Mixed adapter bytesMany retains input order/length despite different fetch completion order and isolates all sibling errors.
  </behavior>
  <action>Per D-04, add table-driven fetch cases and adapter resource.bytes/error and resource.bytesMany tests in the existing test file. Compute success hashes from actual vectors. Assert exact bytes, Blob.type and MIME for opaque and recognized successes. Mix opaque success, recognized success, matching-hash blocked markup, wrong hash and oversized content in one bulk request; vary completion order, await the terminal envelope reliably, and assert correlation, one terminal result, exact item URL order/length, canonical per-item errors, absent Blob for errors and intact successful siblings. Use the existing installed requests payload with per-resource server hints; changing known wire draft drift is outside D-03. Include maxUrls+1 rejection using PAJA_RESOURCE_MAX_URLS and preserve maxServers/cancellation guards. Test streamed over-cap bodies with absent or understated length in addition to declared oversize. Make necessary classifier corrections within the same files without broadening HTTP(S)/data. Restore fetch mocks and close adapter relay pools.</action>
  <verify><automated>pnpm test:unit packages/paja/src/browser-resource.test.ts packages/services/src/resource-service.test.ts</automated></verify>
  <done>Both single and mixed-bulk paths prove byte/MIME fidelity, hash and size enforcement, blocked-markup rejection, other-scheme isolation, ordering and independent sibling success.</done>
</task>

<task type="auto">
  <name>Sync policy docs, add patch changeset and verify shipping gates</name>
  <files>packages/paja/README.md, docs/packages/paja.md, docs/policies/SHELL-RESOURCE-POLICY.md, .changeset/paja-opaque-blossom-resources.md</files>
  <action>Per D-05, synchronize all three resource descriptions: capped verified canonical Blossom may deliver unknown opaque bytes as application/octet-stream; known formats retain sniffed MIME; headers never override classification; active markup remains rejected; HTTP(S)/data retain recognized-type policy. Correct blanket unknown-binary rejection claims only where they wrongly include Blossom. Record the exact PR #80 spec/ref and distinguish this bounded integrity/MIME/SVG result from pre-existing developer-policy and server-hint draft differences. Add a patch changeset for @kehto/paja describing issue #279; no direct version bumps or local publication. Run all full repository gates and the existing pinned change-scoped AI-slop command, requiring 100/100 and zero findings without weakening .aislop/config.yml. Re-run affected checks after fixes. Record evidence or genuine environment blockers in the quick SUMMARY. Execution/ship orchestrator owns commits, push and PR; include specification authority, bounded conformance result, verification and out-of-scope drift in the PR.</action>
  <verify><automated>pnpm build &amp;&amp; pnpm type-check &amp;&amp; pnpm test:unit &amp;&amp; pnpm docs:check &amp;&amp; pnpm test:e2e &amp;&amp; pnpm dlx aislop@0.12.0 scan --changes --base origin/main --json &amp;&amp; git diff --check</automated></verify>
  <done>Three docs match shipped behavior, Paja patch changeset exists, full build/type/unit/docs/e2e gates pass, AI-slop is 100/100, and summary records pinned authority and verification before ship.</done>
</task>
</tasks>

<threat_model>
Untrusted server bytes/headers cross into classification and verified responses, then existing identity-scoped service Blob delivery.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-279-01 | Tampering | Blossom response | high | mitigate | Capped read then actual SHA-256 verification before fallback; wrong-hash/fallback tests. |
| T-279-02 | Elevation of privilege | Classifier | high | mitigate | Explicit blocked state cannot select opaque MIME; matching-hash markup tests. |
| T-279-03 | Tampering | MIME headers | medium | mitigate | Byte-derived MIME only; assert Blob.type and mime against misleading headers. |
| T-279-04 | Denial of service | Reads/bulk | high | mitigate | Preserve streamed byte, URL and server caps; declared/actual oversize and cap tests. |
| T-279-05 | Information disclosure | Scheme dispatch | medium | mitigate | Blossom-only fallback, HTTP(S)/data negative tests, unchanged credentials/referrer controls. |
</threat_model>

<verification>
Execute sequentially because tasks 1 and 2 share source/tests. Focused real adapter tests prove the path before full shipping gates. Inspect AI-slop JSON for 100/100 and zero findings, not merely exit status.
</verification>

<success_criteria>
Issue #279 works through existing single/bulk resource paths without bypassing markup rejection, integrity verification, caps or other-scheme policy. Docs and patch metadata accompany the tested change.
</success_criteria>

## Multi-source coverage audit
| Source | Item | Coverage |
|--------|------|----------|
| GOAL | Approved issue #279 opaque Blossom outcome | COVERED tasks 1–2 |
| REQ | ISSUE-279 bytes/MIME fidelity and bounded fallback | COVERED tasks 1–3 |
| RESEARCH | Pinned spec byte sniffing, hash, SVG, complete Blob, independent ordered bulk | COVERED tasks 1–3 |
| CONTEXT | D-01 classification, D-02 fallback, D-03 preserved scheme/MIME/API | COVERED tasks 1–2 |
| CONTEXT | D-04 boundary and adapter regression matrix | COVERED task 2 |
| CONTEXT | D-05 docs, patch changeset and full gates | COVERED task 3 |

Quick-task source artifacts are the approved issue scope and rechecked pinned authority; no phase-specific ROADMAP/REQUIREMENTS/RESEARCH/CONTEXT artifact was supplied. Excluded: existing server-hint wire drift and broader DNS/rasterization policy work. No deferred feature is introduced.

<output>
Create .planning/quick/261008-dhm-fix-issue-279-permit-opaque-hash-verifie/261008-dhm-SUMMARY.md after execution.
</output>
