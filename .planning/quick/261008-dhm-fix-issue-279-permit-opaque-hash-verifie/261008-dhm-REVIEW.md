---
phase: quick-261008-dhm
reviewed: 2026-10-08T15:18:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - packages/paja/src/browser-resource.ts
  - packages/paja/src/browser-resource.test.ts
  - packages/paja/README.md
  - docs/packages/paja.md
  - docs/policies/SHELL-RESOURCE-POLICY.md
  - .changeset/paja-opaque-blossom-resources.md
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: passed
---

# Quick Task 261008-dhm: Code Review Report

**Depth:** standard
**Scope:** `bbbca649..49bb1281`, branch `feat/paja-opaque-blossom-resources`.
**Verdict:** PASS — both reported blockers resolved. Historical findings below retain their original reproduction evidence.

## Final Orchestrator Review

The final subagent call was interrupted; GPT-6.1 Sol completed the closeout directly. Commit `49bb1281` removes the 1024-byte cutoff entirely: the selected UTF-16 decoder reads the complete size-capped buffer before the existing blocked-prefix check. There is no partial-token boundary left in this inspection path. Regression vectors cover both endiannesses, 507–511, 600 and 4096 leading spaces, all existing blocked markers, and actual adapter bulk sibling isolation. UTF-16 nonmarkup remains opaque and exact-byte delivery is asserted.

Independently reran the focused Paja/service suite after inspection: **93 tests passed** (74 Paja, 19 services). CR-01 and CR-02 are closed; no additional in-scope blocking finding was identified. This is a bounded review of the implemented prefix policy, not a universal markup-parser or sandbox-security certification. NAP-RESOURCE PR #80 head was rechecked and remains `fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1`.

## Summary

The original short BOM-prefixed UTF-16LE/BE SVG repros now fail with `decode-failed`. However, the new bounded encoding guard admits the same prohibited raw format when its opening tag straddles the inspection boundary. Original finding CR-01 is resolved for its exact vectors; CR-02 below is a independently reproduced remaining encoding-boundary failure.

Authority remains NAP-RESOURCE PR #80 at `fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1`, independently read in the initial review: raw SVG must not be delivered. Existing wire, developer HTTP, DNS, rasterization drift and pre-existing narrow-parser limitations remain excluded. This finding needs only a bounded prefix-truncation correction, not a universal parser redesign.

## Narrative Findings (AI reviewer)

## Historical Critical Issues (Resolved)

### CR-02: BLOCKER — truncated UTF-16 opening tags bypass the new guard

**File:** `packages/paja/src/browser-resource.ts:460-462`; fallback at `:206-211`

**Issue:** Only the first 1024 bytes are decoded. A truncated prefix is rejected if whitespace-only, but not when it ends partway through a blocked opening tag. With a UTF-16 BOM, the window contains 511 characters. A valid SVG preceded by 508, 509 or 510 spaces therefore leaves only `<sv`, `<s` or `<` in the inspection text. None matches the complete blocked prefix and none is whitespace-only. The document is classified opaque and delivered intact as `application/octet-stream`. These bytes were rejected by the original baseline and still constitute raw SVG under the pinned spec. The long-whitespace tests at `packages/paja/src/browser-resource.test.ts:289-299` use 600 spaces and only cover the whitespace-only case, not the partial-token boundary.

**Independent reproduction:** In-memory bundle of the actual HEAD export, injected response bytes with their actual SHA-256: BOM + UTF-16 encoding of `" ".repeat(n) + "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>"`. Both endiannesses produce:

```text
spaces   UTF-16LE                    UTF-16BE
507      decode-failed               decode-failed
508      application/octet-stream    application/octet-stream
509      application/octet-stream    application/octet-stream
510      application/octet-stream    application/octet-stream
511      decode-failed               decode-failed
600      decode-failed               decode-failed
```

Every successful boundary case returned the exact original raw SVG bytes. No script execution or sandbox escape is asserted; the demonstrated violation is delivery of the prohibited format.

**Fix:** Treat a truncated inspection result that could still complete a blocked prefix as inconclusive and block it, or extend bounded inspection far enough to decide the token after leading whitespace. For example, after normalization, if bytes remain beyond the inspection window, reject both an empty prefix and a prefix that is itself a prefix of any blocked marker (`<svg`, `<?xml`, `<!doctype html`, `<html`, `<script`). Add LE/BE matching-hash vectors with 508–510 spaces and analogous partial XML/HTML markers. Include a boundary SVG error in adapter bulk tests and retain opaque nonmarkup sibling byte/MIME fidelity. Keep original bytes, hash/caps, scheme isolation, and recognized binary precedence unchanged.

## Resolved Prior Findings

**CR-01 — original classification: BLOCKER; exact original vectors RESOLVED.** `hasBlockedEncodedMarkup` at `packages/paja/src/browser-resource.ts:442-462` now identifies UTF-16LE/BE BOMs and initial alternating `<` bytes, and conservatively rejects identifiable UTF-32 signatures. Independently reran both original BOM-prefixed XML/SVG vectors containing the explicit `encoding="UTF-16"` declaration: both return `decode-failed`. Nonmarkup UTF-16 still returns exact bytes as octet-stream. CR-02 prevents closing the overall raw-SVG safety concern.

## Verification Evidence

- Independently reran `pnpm test:unit packages/paja/src/browser-resource.test.ts packages/services/src/resource-service.test.ts`: **81 tests passed** (62 Paja, 19 services). Passing tests omit the partial-opening-tag boundary reproduced above.
- Reviewed the entire current production module and test module plus all corrective doc diffs. Docs accurately describe a bounded encoding guard; no unrelated parser redesign is demanded.
- Independently reproduced original short SVG rejection, 600-space SVG rejection, nonmarkup exact-byte delivery, and partial-token bypass through the actual exported fetch boundary, using esbuild `write: false`.
- No source/test/doc modifications or commits; only this REVIEW artifact was updated. Full shipping gates were not rerun by this reviewer.

---

_Reviewer: gsd-code-reviewer_
_Depth: standard_
