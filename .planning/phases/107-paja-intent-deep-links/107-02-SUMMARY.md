---
phase: 107-paja-intent-deep-links
plan: 02
subsystem: intent-uri-binding
tags: [nap-intent, uri, paja, nip-5d]
requires:
  - phase: 106-active-surface-conformance-and-release
    provides: buffered injected intent delivery surface
provides:
  - Canonical URI normalization shared by host and injected intent bindings
  - Strict Paja intent link parsing and creation without automatic invocation
affects: [paja-host-integration, intent-resolver, compatibility-docs]
tech-stack:
  added: []
  patterns: [self-contained injected parser source, separate outer and inner URL encoding]
key-files:
  created: [packages/shell/src/intent-uri.ts, packages/paja/src/intent-link.ts]
  modified: [packages/shell/src/napplet-namespace.ts, packages/shell/src/index.ts]
key-decisions:
  - "Serialize normalizeIntentUri itself into the NIP-5D prelude so host and injected bindings have one authoritative parser."
  - "Treat pointer-only Paja URLs as opaque existing startup input before applying intent-link validation."
requirements-completed: [LINK-01, LINK-03, LINK-07, LINK-10]
coverage:
  - id: D1
    description: Canonical intent URI normalization and injected invocation binding
    requirement: LINK-01
    verification:
      - kind: unit
        ref: packages/shell/src/napplet-namespace.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Paja intent-link codec with two-layer encoding and size checks
    requirement: LINK-03
    verification:
      - kind: unit
        ref: packages/paja/src/intent-link.test.ts
        status: pass
    human_judgment: false
completed: 2026-10-10
status: complete
---

# Phase 107 Plan 02: URI Binding and Link Codec Summary

Canonical NAP-INTENT URI requests now normalize before wire invocation, while Paja intent URLs retain the existing pointer-only startup path.

## Accomplishments

- Added `normalizeIntentUri(uri, options?)`, including literal-plus query preservation, decoded-name uniqueness, strict option validation, `35129` naddr recommendations, and `open` action enforcement.
- Serialized the same self-contained normalizer into `window.napplet.intent`, preserving buffered `onDelivery` and parent-source trust while retaining a once-per-napplet legacy object-call warning.
- Added Paja create/parse helpers with independent outer/inner URL encoding, JSON primitive/null support, UTF-8 16 KiB limit, pointer/recommendation conflict rejection, and no implicit invocation.
- Kept pointer-only URLs opaque, including hashes, multiple historical pointer aliases, and unrelated query parameters.

## Verification

- `pnpm exec vitest run packages/shell/src/*namespace*.test.ts packages/paja/src/intent-link.test.ts` — passed (45 tests).
- `git diff --check` on assigned files — passed.
- Package type-check remains blocked outside this task by unbuilt workspace dependency resolution; no diagnostics remain for `intent-uri` or `napplet-namespace`.

## Compatibility Note

The retained object-form invocation warning is `[KEHTO_COMPAT_INTENT_OBJECT_INVOKE]`. It is rate-limited once per napplet, names `intent.invoke(uri, options)` / `intent.open(uri, options)`, and has a runtime regression test. The integration owner must add the corresponding parent-owned `docs/compatibility.md` record.

## Task Commits

No commit was created. This is a shared execution branch; the parent integration executor owns staging and commits.

## Files Created/Modified

- `packages/shell/src/intent-uri.ts` — reusable, self-contained canonical normalizer.
- `packages/shell/src/napplet-namespace.ts` — canonical URI binding plus bounded legacy compatibility path.
- `packages/shell/src/napplet-namespace.test.ts` — URI, sender, duplicate, and warning coverage.
- `packages/shell/src/index.ts` — public shell normalizer export.
- `packages/paja/src/intent-link.ts` — isolated strict Paja link codec.
- `packages/paja/src/intent-link.test.ts` — link codec regression matrix.

## Deviations from Plan

None. Integration requested targeted correctness corrections before staging: pointer-only URL preservation, decoded outer field names, opaque JSON keys, lowercase URI slugs, and empty-query payload exclusion.

## Next Phase Readiness

The parser and codec are ready for host UI wiring and public Paja export by the integration owner. No UI behavior was added here.
