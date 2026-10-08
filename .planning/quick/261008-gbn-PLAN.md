---
phase: quick-261008-gbn
plan: "01"
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [QUICK-261008-gbn]
files_modified:
  - packages/paja/src/browser-blossom-uri.ts
  - packages/paja/src/browser-resource.ts
  - packages/paja/src/browser-resource.test.ts
  - packages/paja/src/browser-blossom-events.ts
  - packages/paja/src/browser-blossom-events.test.ts
  - packages/paja/src/browser-blossom-integration.test.ts
  - packages/paja/README.md
  - docs/packages/paja.md
  - .changeset/paja-blossom-prefix-compat.md
estimate:
  tokens: 24000
  raw_tokens: 24000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - Both Blossom prefixes accept optional safe extensions and discovery queries while extensionless reads remain compatible.
    - The requested extension reaches GET /hash.ext, but SHA-256 and local byte sniffing exclusively establish integrity and MIME.
    - Request xs/as hints participate in bounded discovery without cross-window event-context leakage or speculative prefetch.
    - Malformed URLs and sizes fail before discovery; supplied sz must match downloaded bytes before delivery.
    - Public HTTPS hints, configured loopback HTTP, cancellation, byte caps, and existing resource cache lifecycle remain intact.
  artifacts:
    - path: packages/paja/src/browser-blossom-uri.ts
      provides: Internal shared parsing contract without a public package export
    - path: packages/paja/src/browser-blossom-integration.test.ts
      provides: Real resource service to resolver to verified fetch regression
    - path: .changeset/paja-blossom-prefix-compat.md
      provides: Existing single Paja patch changeset updated for full URI support
  key_links:
    - from: packages/paja/src/browser-resource.ts
      to: packages/paja/src/browser-blossom-uri.ts
      via: Shared strict parser before any discovery or fetch
    - from: packages/paja/src/browser-blossom-events.ts
      to: packages/paja/src/browser-blossom-uri.ts
      via: Same parsed hash key plus request discovery hints
    - from: packages/paja/src/browser-adapter.ts
      to: packages/paja/src/browser-blossom-events.ts
      via: Existing window-bound getBlossomServers and clearWindow wiring, unchanged
---

<objective>
Complete Paja resource acceptance of BUD-10 Blossom URIs including the optional local-compatible file extension, repeated xs/as discovery, and exact sz verification. Continue feat/paja-blossom-prefix-compat and existing PR #282; no new branch, worktree, dependency, public export, or runtime-package modification.
Purpose: Valid shared blob references must resolve through the same verified host-owned resource path instead of failing at the bare-hash parser.
Output: Shared internal parser, verified fetch/discovery regressions, synchronized two Paja docs, and the existing patch changeset extended in place.
</objective>

<execution_context>
@/home/robert/.config/opencode/gsd-core/workflows/execute-plan.md
@/home/robert/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@.planning/STATE.md
@.planning/quick/261008-fr1-SUMMARY.md
@packages/paja/src/browser-resource.ts
@packages/paja/src/browser-blossom-events.ts
@packages/paja/src/browser-blossom-integration.test.ts
@packages/paja/src/browser-resource.test.ts
@packages/paja/src/browser-blossom-events.test.ts
@packages/paja/src/browser-adapter.ts
@packages/paja/README.md
@docs/packages/paja.md
@.changeset/paja-blossom-prefix-compat.md

Authority checked live during planning, 2026-10-08:
- https://raw.githubusercontent.com/hzrd149/blossom/master/buds/10.md — draft BUD-10 requires blossom:lowercase-sha256.ext, default bin for unknown extensions, repeated xs and as, optional positive-integer sz, extension-bearing GET, and size checks.
- https://raw.githubusercontent.com/napplet/naps/fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1/naps/NAP-RESOURCE.md — exact existing reference checked for runtime-owned fetch, SHA-256, MIME sniffing, identity cache scope, terminal errors, cancellation. Its sha256 form is not used to block the previously authorized local dual-prefix compatibility. Paja is not claiming full draft conformance (browser DNS enforcement and developer HTTP policy remain documented exceptions).

Locked quick-task decisions (local IDs for traceability):
D-01: Accept both prefixes and optional extensions; retain extensionless and mixed-case hash compatibility, normalize hash lowercase.
D-02: Include extension in transport only; keep byte-based MIME classification and hash verification.
D-03: Consume repeated request xs/as with existing BUD-03 lookup; validate and verify sz.
D-04: Reject fragments/path injection/bad size, bound discovery, preserve public-HTTPS hint/configured-loopback policy and window privacy/cache lifecycle.
D-05: No new dependencies/public exports/runtime packages; update same changeset and two docs; targeted regressions and all gates including Paja Chromium-override e2e, same branch/PR.

Discovery: Existing patterns inspected; reuse baseRouter.query, existing verified NIP-65-aware lookup, TTL, single-flight and incomplete-miss behavior. Applesauce skill overview was reviewed for lookup lifecycle only; do not introduce a new framework or relay path. Calibration: factor 1, sample_count 0, confidence low.
</context>

<tasks>
<task type="tracer" tdd="true">
  <name>1. Resolve one extension-bearing URI end-to-end through Paja resource service</name>
  <files>packages/paja/src/browser-blossom-uri.ts, packages/paja/src/browser-resource.ts, packages/paja/src/browser-resource.test.ts, packages/paja/src/browser-blossom-integration.test.ts</files>
  <behavior>
    - A resource.bytes URL blossom:hash.gbc?xs=cdn.example&amp;sz=N with the real fixture digest returns one correlated result with the fixture bytes and sniffed MIME; GET uses /hash.gbc.
    - Both prefixes, extensionless inputs, and mixed-case hashes remain accepted; extensions do not dictate MIME.
    - Invalid size or fragment/path syntax invokes neither discovery nor network; declared and actual size mismatches never deliver bytes.
  </behavior>
  <action>
Start with a failing integration assertion through createPajaAdapter/services.resource.handleMessage using the existing real-byte digest helpers, then implement per D-01, D-02, D-03, D-04. Add an independent internal browser-blossom-uri module (not package index/export map) with parsePajaBlossomUri returning normalized hash, canonical hash-only event-context key blossom:sha256:hash, optional extension, ordered repeated raw xs values, validated/deduplicated 64-hex authors, and optional expectedSize. Share this grammar with discovery in Task 2; keep module free of resource/resolver imports to avoid cycles. Use an anchored case-insensitive dual-prefix grammar with one optional nonempty ASCII-alphanumeric extension (same existing event extension policy); reject fragments, extra dots, slashes/backslashes, encoded path delimiters, bad hash length, unsupported algorithm labels and control/whitespace input. Bound URI length at 8192 characters, retained xs and authors each at eight unique entries. Ignore unknown query keys for forward compatibility; reject malformed percent escapes and all malformed as values before any I/O. For sz accept one decimal-digits positive safe integer only, reject empty, zero, signs, decimals, exponent syntax, overflow and repeated sz as invalid-request; valid sizes above PAJA_RESOURCE_MAX_BYTES fail too-large before discovery. Preserve mixed-case hash normalization as local compatibility, not a BUD-10 emission claim.
Replace bare-hash regex use in fetchBlossomResource. Normalize scheme-less xs to public HTTPS origins with the existing hint guard, preserve explicit scheme validation, and merge URI xs after existing explicit request servers and before resolver/configured candidates, deduplicating under the existing eight-server cap. No public HTTP fallback for URI hints. Preserve original full URI/windowId passed to getBlossomServers, and build network path from validated hash and optional extension only; never forward query hints or fragments to blob servers. Compare a present valid Content-Length against sz before reading, cancel the response body on mismatch and continue fallback; absent header is allowed, actual byte length must still equal sz. Retain capped streaming, SHA-256 verification and byte sniffing, omitted credentials/referrer, no-store, redirect refusal, and abort propagation. Treat size mismatch as decode-failed if no valid candidate succeeds, with the same integrity-error precedence as hash mismatch. Missing/non-numeric Content-Length is not a substitute for validating actual bytes; do not weaken existing declared/streamed too-large behavior. Do not alter service cache keys or trust identity. Update obsolete tests that currently classify legitimate extension/query forms as malformed; retain all other security expectations and static-guard test-name markers.
  </action>
  <verify><automated>pnpm test:unit packages/paja/src/browser-resource.test.ts packages/paja/src/browser-blossom-integration.test.ts packages/paja/src/browser-blossom-events.test.ts</automated></verify>
  <done>The full resource-service happy path delivers verified bytes from an extension-bearing xs URI; malformed URLs/sz fail before hooks, size mismatches cannot deliver, both prefixes and extensionless reads still pass.</done>
</task>

<task type="auto" tdd="true">
  <name>2. Consume URI author hints through bounded existing resolver discovery</name>
  <files>packages/paja/src/browser-blossom-events.ts, packages/paja/src/browser-blossom-events.test.ts, packages/paja/src/browser-blossom-integration.test.ts, packages/paja/src/browser-resource.test.ts</files>
  <behavior>
    - Without an observed OUTBOX event, repeated request xs and as still resolve via public hints and authors' kind-10063 server lists.
    - Request URI hints precede event hints; URI authors precede event hinted authors, publisher, default user, pointer and runtime fallback tiers.
    - Equivalent hash spellings/extensions find only the requesting window's observed context; request hints are not retained for a later hintless request or another window.
    - Repeated/excess authors produce bounded deduplicated queries; successful TTL cache and concurrent single-flight reuse persist, incomplete misses retry, clearWindow removes event/pointer state.
  </behavior>
  <action>
Per D-03 and D-04 replace the resolver-local BLOSSOM_REFERENCE grammar/parser with the shared internal parser, adapting its return into existing EventResourceLocation and normalizeEventServer. Keep event context canonical by hash for location discovery only: never transfer an observed event's extension or sz onto a different requested URL or canonicalize the service's byte-equal response cache key. getServers must consume the current request's parsed xs/as, not just its canonical key. Invalid parser input returns no candidates and performs no lookup. Append request xs before the same-window event servers; assemble author priority from current request as, event authors, event publishers and default users. Bound the complete unique author list at eight before Promise.all (do not use the existing unlimited append for this list), preserve priority when appending lookup results, and cap output at PAJA_RESOURCE_MAX_SERVERS. Continue using the existing verified baseRouter.query kind-10063 per-author path; no speculative lookup during observe, and no new relay connection, signer interaction or OUTBOX decorator recursion. Retain lazy discovery, five-minute TTL, pending lookup deduplication and incomplete/error retry policy. Do not persist request hints into windows; keep clearWindow event/pointer cleanup and shared public author-list cache semantics unchanged.
Extend resolver and adapter integration regressions for a full URI with no prior event, multiple xs/as in order, exhausted first candidate then author success, and fallback through all existing tiers. Add negative/edge vectors in fetch tests for unsafe extensions and encoded separators, fragments, invalid sizes including duplicate sz, size above cap with no I/O, header mismatch cancellation, body mismatch with missing header, successful fallback after mismatch, misleading extension/Content-Type, bad hash and unsafe SVG. Use real computed hashes for downloaded vectors. Assert private/HTTP/credentials/path/query-bearing xs cannot become trusted configured loopback; explicit host-configured loopback still works. Test URI/author caps, duplicate hint normalization, TTL and concurrent lookup reuse, incomplete retry and window teardown/isolation. Keep existing integration test names used by nip5d-conformance-guard and close relay pools/un-stub globals.
  </action>
  <verify><automated>pnpm test:unit packages/paja/src/browser-resource.test.ts packages/paja/src/browser-blossom-integration.test.ts packages/paja/src/browser-blossom-events.test.ts</automated></verify>
  <done>Full request discovery works without observed events, bounded author queries reuse existing lookup/cache machinery, and tests prove no request-hint persistence or cross-window event leakage.</done>
</task>

<task type="auto">
  <name>3. Synchronize existing release note and docs; verify the same PR followup</name>
  <files>packages/paja/README.md, docs/packages/paja.md, .changeset/paja-blossom-prefix-compat.md</files>
  <action>
Per D-05 update both active resource sections to show blossom:hash.ext?xs=...&amp;as=...&amp;sz=... and the sha256 alias with optional extension. Explain BUD-10's required extension/default bin for emitted references versus the user's explicitly retained local extensionless and mixed-case-hash compatibility; no strict upstream-conformance claim. Document ext transport preservation without MIME trust, exact positive sz and byte verification, repeated hint/author discovery and bounds, lazy source-window context/cache behavior, eight candidate/author bounds and errors. Link the live BUD-10 authority and retain the exact NAP-RESOURCE reference; describe the deliberate stronger public-HTTPS hint restriction instead of the BUD's suggested HTTP retry and preserve host-configured loopback development policy. Remove the stale characterization of BUD-10 discovery hints as legacy; distinguish request-URI hints from event hints. Amend the existing .changeset/paja-blossom-prefix-compat.md prose without changing its single @kehto/paja patch entry, creating a second changeset, bumping versions or modifying generated changelogs. Keep upload URI-generation limitations intact: this work changes reads, not upload descriptors.
Run the focused suite then every gate in verification, recheck after any repair, and preserve the pinned slop config. Record exact spec/ref checked, local compatibility/policy choices and results in .planning/quick/261008-gbn-SUMMARY.md. Make atomic explicit-path commits with the agent coauthor trailer on feat/paja-blossom-prefix-compat. Parent/orchestrator owns quick STATE recording and pushing/updating existing PR #282; do not open a second PR or publish packages.
  </action>
  <verify><automated>pnpm docs:check &amp;&amp; git diff --check</automated></verify>
  <done>Both docs and the existing changeset accurately describe completed URI support; all full/local browser gates pass and evidence is ready for the parent to update PR #282.</done>
</task>
</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|---|---|
| Napplet URI to discovery | Untrusted syntax, author queries and server hints cross into host-owned fetch policy. |
| Remote bytes to resource result | Server metadata/bytes cannot supply trusted MIME, hash or size. |
| Source window to retained event context | Observed metadata must remain scoped to its authenticated window. |

## STRIDE Threat Register
| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|---|---|---|---|---|---|
| T-gbn-01 | Tampering | URI/fetch path | high | mitigate | Task 1 anchored grammar, safe extension, no fragment/query propagation, hash plus sz verification. |
| T-gbn-02 | Information Disclosure | xs/as discovery | high | mitigate | Tasks 1–2 public HTTPS guard, credential/referrer omission, no speculative reads, current-window event context only. |
| T-gbn-03 | Denial of Service | URI and author/server fanout | medium | mitigate | Tasks 1–2 URI length, eight unique authors/candidates, byte caps and existing request cancellation. |
| T-gbn-04 | Tampering | MIME result | high | mitigate | Task 1 classifies actual bytes; extensions/headers never grant safe-media status. |
| T-gbn-05 | Information Disclosure | Browser DNS resolution | medium | accept | Existing browser-only inability to pin DNS is unchanged, documented in Task 3; no server-side resolver claim. |
</threat_model>

<verification>
Commands grounded in prior successful 261008-fr1 verification (no new installs):
- pnpm test:unit packages/paja/src/browser-resource.test.ts packages/paja/src/browser-blossom-integration.test.ts packages/paja/src/browser-blossom-events.test.ts
- pnpm build
- pnpm type-check
- pnpm test:unit
- pnpm docs:check
- PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/home/robert/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome pnpm test:e2e tests/e2e/paja-single-window.spec.ts tests/e2e/paja-runtime-pointer.spec.ts
- pnpm dlx aislop@0.12.0 scan --changes --base origin/main --json
- git diff --check
The installed Chromium override was executable at planning time; if unavailable at execution, report the environment blocker instead of skipping browser proof. Use installed/pinned slop tooling as before; no application dependency installs. Confirm shipped diff has only the listed Paja sources/tests/docs and existing changeset, without package versions, lockfile, runtime packages or public export-map changes.
</verification>

<success_criteria>
Every requested URI behavior is accepted through the real Paja resource service with verified bytes, unsafe forms fail closed, discovery remains bounded/private, all gates pass, and one updated changeset accompanies synchronized docs on the same concern branch.
</success_criteria>

## Multi-source coverage audit
Quick task has no assigned ROADMAP phase/phase_req_ids or separate CONTEXT/RESEARCH artifacts; user request and live authorities supply these sources, not unrelated milestone requirements.
| Source | ID | Item | Task | Status |
|---|---|---|---|---|
| GOAL | quick user goal | Correctly accept BUD-10 URIs with optional extension | 1–3 | COVERED |
| REQ | QUICK-261008-gbn | Same-PR complete read support with regressions/gates | 1–3 | COVERED |
| RESEARCH | BUD-10 live | Hash/ext, repeated xs/as, exact positive sz, extension GET | 1–2 | COVERED |
| RESEARCH | existing NAP reference | Runtime integrity/MIME, cancellation and cache scope; deliberate local policy exceptions | 1–3 | COVERED |
| CONTEXT | D-01 | Both prefixes, extensionless/mixed-case compatibility | 1 | COVERED |
| CONTEXT | D-02 | Transport extension without MIME trust | 1–2 | COVERED |
| CONTEXT | D-03 | Request discovery and size validation/verification | 1–2 | COVERED |
| CONTEXT | D-04 | Strict syntax, bounded discovery, policy and window lifecycle | 1–3 | COVERED |
| CONTEXT | D-05 | Same branch/PR, no new dependency/public surface, same changeset/two docs/all gates | 3 | COVERED |

<output>
Create .planning/quick/261008-gbn-SUMMARY.md with implementation commits, spec sources, full verification results, policy decisions and parent handoff. Planning changes only; parent owns planning-artifact commit and PR followup.
</output>
