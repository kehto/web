---
status: verifying
trigger: "Resolve kehto/web#435 with a draft PR"
created: 2026-11-12
updated: 2026-11-12
---

# Napplet-directed relay destinations

## Scope and authority

- Issue #435 reports relay hints reaching host transport in runtime 0.28.1
  and asks whether current operation approval covers the exact destination.
- Base: origin/main 1dfbf610. Primary checkout's package.json and shell skills
  are unrelated WIP; preserved. Isolated worktree under ~/.worktrees/kehto.
- NAP-RELAY draft napplet/naps#2, exact head
  9f30b3505335a52c574ff570576687d6467021ff, naps/NAP-RELAY.md:
  subscribe's relay field is canonical and remains subject to host policy.
  query has no canonical relay field; Kehto's existing extension stays bounded.
- NAP-OUTBOX draft napplet/naps#32, exact head
  8865f73d52a4864afee145f28d26520476273927, naps/NAP-OUTBOX.md:
  options.relays never bypasses ACLs; shell validates every candidate and
  prevents napplet-forced private/disallowed destinations.
- Neither spec requires granting arbitrary hints. Requiring operation authority
  for napplet-directed targets is a conformant, bounded host policy.

## Evidence

- Current runtime plans relay query/subscribe destinations before approval and
  includes their origins in network permission requirements.
- authorizeRelay executes immediately when RuntimeAdapter.permissions is absent;
  caller hints remain effective in that legacy mode.
- relayRequirements uses an origin regex, not URL parsing. It accepts malformed
  authorities and credentials and does not canonicalize equivalent origins.
- Query copies the envelope and destination plan. Subscribe does not copy its
  envelope or a custom registered service's mutable plan while approval waits.
- Reference relay services consume the supplied plan during execution. OUTBOX
  captures plans and checks origin permissions when attached to a permission
  runtime, but standalone legacy operations still accept explicit options.relays.
- OUTBOX's default relay validator only tests a ws(s) prefix, accepting private
  destinations. Paja has a stronger explicit host relay policy.
- Host pool NIP-42 auto-auth is not an authority this runtime can grant. Inspect
  built-in consumers, prove no signer is invoked for denied hint work, and
  document the external pool's independent authentication policy.

## Plan / acceptance

1. Add behavioral regressions for direct and registered relay hints: exact target
   in approval, deny before I/O/signing, no unapproved hint execution without a
   permission adapter, immutable approval inputs, and source/revocation cleanup.
2. Close those boundaries with URL validation and detached subscription plans,
   preserving canonical scoped subscribe support and planned exact execution.
3. Cover OUTBOX hinted reads/publishes and its reference router's default URL
   policy. Preserve documented unhinted legacy calls with existing diagnostics;
   deny explicit hints without operation authority.
4. Update all affected consumers, docs, compatibility inventory, package changesets
   and conformance guards. Record any actual spec gap rather than changing wire.
5. Run build, type-check, full unit/docs/quality gates and relevant full browser
   gate. Commit by checkpoint, push, and open a draft PR closing #435. Recheck
   exact draft heads and audit acceptance before completing the goal.

GSD debug executes inline per its spawn restriction. Graph candidates come from
the primary checkout's index; current worktree source is authoritative.

## Green checkpoint

- Reproduced absent-authority hints, mutable subscription inputs/plans and
  malformed relay acceptance through all three runtime transport surfaces.
  Detached envelopes/plans, canonical URL-origin validation and hint authority
  checks now cover fallback plus both reference services.
- OUTBOX standalone explicit hints are denied before router entry. Its default
  router rejects obvious private/local addresses and malformed credentials;
  explicit host fallback configuration retains development relay support.
- Paja trailing-dot private-host bypass fixed. Its ordinary pool is anonymous:
  the new browser test sends both AUTH and auth-required CLOSED while a signer
  is connected, proving no AUTH event or signature is produced for the hint.
  Arbitrary third-party pool auth hooks remain the host's responsibility.
- Unhinted legacy runtime networking has a bounded actionable diagnostic and
  compatibility entry. Standalone OUTBOX retains its existing warning only for
  unhinted operations. Local-only mocks continue without network authority.
- Build and type-check PASS. Unit gate PASS: 272 files / 3492 tests. Docs gate
  PASS. Pinned quality 100/100 with the existing Paja function-length warning.
  Focused Paja relay browser gate PASS 5/5, including new NIP-42 fixture.
- Remaining: audit compatibility of the pre-existing query hint extension,
  full browser gate, protocol-head recheck, draft PR and requirement audit.

## Final audit fixes

- Authorized use of the existing noncanonical query hint now emits
  KEHTO_COMPAT_RELAY_QUERY_HINT once per runtime, with scoped subscribe as its
  replacement. Canonical and denied paths remain quiet; compatibility tests
  cover actual execution and warning lifetime.
- The first full browser gate passed 133 tests with one existing skip. A later
  audit reproduced OUTBOX transport starting after revocation during signing.
  publishWithPlan now receives the operation signal and checks it again after
  signing. Both Paja decorators forward the exact signal, proven by runtime tests.
- The authorized OUTBOX publish path also omitted required inbox fanout from
  its plan. Reused the full own-outbox/inbox/hint target resolver before signing,
  preserved existing standalone missing-own-list behavior, and kept the existing
  planned own-list fallback. Host-only requiredRelays metadata is copied/frozen;
  incomplete required-fanout plans are denied before authorization or signing.
  Optional hint success cannot mask failed required relay publication.
- Added real signed vectors for required fanout, explicit toOutbox false,
  missing/denied inboxes, pre-sign cancellation and held-signing revocation.
  Trusted two-argument host publish calls remain covered; compatibility documents
  the diagnostic limits of optional cancellation and required-target metadata.
- Tightened empty-fragment and IPv4-compatible/site-local IPv6 validation.
- Build/type-check PASS; all 273 unit files / 3508 tests PASS; docs PASS;
  pinned quality 100/100 with no new findings. Both protocol draft heads were
  rechecked unchanged. Final full browser gate remains before draft PR creation.
