---
phase: 104-nap-intent-and-manifest-contract-parity
plan: 01
subsystem: protocol-binding
tags: [nap-intent, convention-uri, nip-5d, browser-binding, typescript]
requires:
  - phase: 102-nap-inc-event-channel-parity
    provides: shared convention URI projection and protected namespace pattern
provides:
  - exact carrier-neutral NAP-INTENT value types
  - URI-authoritative invoke and open binding
  - trusted FIFO target-delivery retention
affects: [104-02, 104-03, 104-04, 104-05, 105]
tech-stack:
  added: []
  patterns: [explicit option allowlist, parent-authenticated push buffer, protected singleton binding]
key-files:
  created:
    - packages/services/src/intent-types.test.ts
  modified:
    - packages/services/src/intent-types.ts
    - packages/services/src/index.ts
    - packages/shell/src/napplet-namespace.ts
    - packages/shell/src/napplet-namespace.test.ts
key-decisions:
  - "Convention URI fields are derived once; caller sender and conflicting derived fields reject before transport while legacy/unknown options are discarded."
  - "The intent binding accepts only canonical parent-authenticated deliveries and retains them losslessly across namespace replacement."
patterns-established:
  - "Intent request construction copies only payload, string handler, and boolean focus/reuse behavior after URI normalization."
  - "Target pushes are canonical-field copies; carrier metadata never reaches application callbacks."
requirements-completed: [BASE-01, BASE-02, INTENT-01, INTENT-03, INTENT-10]
coverage:
  - id: D1
    description: Exact local NAP-INTENT value model and public exports contain no protocol, lifecycle, or carrier fields.
    requirement: INTENT-03
    verification:
      - kind: unit
        ref: packages/services/src/intent-types.test.ts#canonical NAP-INTENT value types
        status: pass
    human_judgment: false
  - id: D2
    description: Injected invoke and open derive exact normalized routing and sanitize every caller option before postMessage.
    requirement: INTENT-01
    verification:
      - kind: unit
        ref: packages/shell/src/napplet-namespace.test.ts#derives intent requests from one authoritative convention URI and sanitizes options
        status: pass
      - kind: unit
        ref: packages/shell/src/napplet-namespace.test.ts#rejects invalid or conflicting intent input before posting a message
        status: pass
    human_judgment: false
  - id: D3
    description: Parent-authenticated target deliveries are sanitized, retained FIFO, and survive intent or namespace replacement.
    requirement: INTENT-10
    verification:
      - kind: unit
        ref: packages/shell/src/napplet-namespace.test.ts#retains only canonical trusted intent deliveries and drains them FIFO
        status: pass
      - kind: unit
        ref: packages/shell/src/napplet-namespace.test.ts#protects one intent binding and its pending delivery state across namespace attacks
        status: pass
    human_judgment: false
duration: 7min
completed: 2026-07-26
status: complete
---

# Phase 104 Plan 01: Exact Intent Types and Protected Binding Summary

**Kehto now exposes the exact convention-URI intent contract through a protected browser binding with sanitized invocation and lossless trusted target delivery.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-26T15:07:47+01:00
- **Completed:** 2026-07-26T15:14:50+01:00
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Replaced compatibility-shaped local types with the exact published intent options, required normalized request, manifest contract, candidate, discriminated result, and delivery shapes.
- Made `invoke` and `open` share the Phase 102 convention normalizer, preserve query text exactly, reject invalid/conflicting inputs before transport, and copy only sanctioned options.
- Added a frozen protected intent singleton that accepts only canonical parent messages, strips carrier extras, buffers early deliveries FIFO, and preserves state through namespace attacks.

## Task Commits

1. **Task 1: Replace compatibility-shaped intent types with the exact canonical model** — `8f63636`
2. **Task 2: Make invoke and open use one authoritative sanitized URI boundary** — `32db695`
3. **Task 3: Protect and validate target delivery retention** — `4b0b877`

## Files Created/Modified

- `packages/services/src/intent-types.ts` — Exact temporary mirror of the published convention-capable intent values.
- `packages/services/src/intent-types.test.ts` — Accepted, narrowed, missing-field, and forbidden-field fixtures.
- `packages/services/src/index.ts` — Public exports for every canonical intent value.
- `packages/shell/src/napplet-namespace.ts` — URI-authoritative protected intent binding and delivery buffer.
- `packages/shell/src/napplet-namespace.test.ts` — Normalization, forgery, sanitization, FIFO, and replacement regressions.

## Authority Check

Checked `napplet/naps` draft PR #91 at
`a718915ddefa2f03a0126579601f59d8bd86f7c4`, merged web projection
`5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`, and
`napplet/web@dd7b3a728eb9c838b7218fcec7bb7bb00e7cc88b` before implementation.
The binding and local value model conform to those exact sources.

## Decisions Made

- Treat an own `sender` option as an immediate spoofing attempt; allow matching URI-derived fields only as redundant typed input and never copy them.
- Discard noncanonical top-level and behavior options rather than letting object spread establish a wire extension.
- Keep lossless early-delivery retention as required by the draft; runtime admission policy, not the child binding, owns resource limits.

## Deviations from Plan

### Deferred Cross-Wave Verification

The exact type cut intentionally makes the pre-existing protocol-shaped resolver
and service fixtures fail the package-wide `@kehto/services` type-check. Those
files are owned by Plan 104-03, which rewrites the resolver around required
conventions and retained delivery. The focused type fixture itself has no TypeScript
diagnostics, all 29 Plan 104-01 tests pass, and `@kehto/shell` type-checks. The
full services type-check must be rerun and recorded after Plan 104-03; execution
will not pause while this deliberate cross-wave transition exists.

## Verification

- `pnpm exec vitest run packages/services/src/intent-types.test.ts packages/shell/src/napplet-namespace.test.ts` — 29 passed.
- `pnpm --filter @kehto/shell type-check` — passed.
- `pnpm --filter @kehto/services type-check` — deferred to Plan 104-03; its diagnostics are confined to explicitly owned legacy resolver/service consumers.
- `git diff --check` — passed.
- Package and lockfile diff check — no changes.
- AI-slop gate — unavailable; the workspace contains no configured script or installed executable.

## User Setup Required

None.

## Next Phase Readiness

Plan 104-02 can consume exact contracts and normalized convention identity.
Plan 104-03 must close the intentionally visible services type-check transition.

## Self-Check: PASSED

- All five declared files exist and task commits `8f63636`, `32db695`, and `4b0b877` are present.
- No package manifest, lockfile, dependency, resolver, runtime lifecycle, or live host flow changed.
- The explicit cross-wave services type-check obligation remains recorded above
  and will be closed by Plan 104-03 before Phase 104 verification.
