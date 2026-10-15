---
status: resolved
trigger: "Issue #280: Blossom read aliases and internal canonical form disagree"
---

## Evaluation and authority

PR #282 (`abb9004d`) already fixes plain-prefix, extension and query-hint reads.
109 current resource/resolver integration tests pass. The issue is partially
resolved: the parser and generated event references still normalize to the
sha256-prefixed alias. Finish the requested plain internal form in a focused PR.

Checked NAP-RESOURCE draft PR #80 at
`ae5b9c64ab8a4d8909f288829a01e99d6bd713bc`, `naps/NAP-RESOURCE.md`.
Its Blossom scheme uses BUD-10 and verifies SHA-256; its URL/cache section
explicitly does not require canonicalization. This remaining normalization is
host policy, not a protocol violation. Keep napplet-supplied resource cache keys
unchanged and keep extension/hint handling, hash checks, and limits intact.

## Current focus

Normalize internal references to blossom:<hash>, retain accepted sha256 input,
warn once per module on actual alias resource/server-resolution requests, and
record compatibility limits and retirement prerequisites. Keep parsing pure.
GSD debug runs inline on an isolated branch.

## Resolution and verification

Internal references now use the plain prefix. Alias reads remain supported with
a bounded host diagnostic; pure parsing and original resource cache keys stay
unchanged. Compatibility guidance and a Paja patch changeset ship together.

Build (32 tasks), type-check (17 tasks), unit suite (2,160 tests / 170 files),
docs audit (9 packages), and Playwright (123 tests) passed. The final focused
Blossom regression suite also passes after replacing a Node-only test import
with Web Crypto. The changes-only AI-slop gate scores 100/100.

Spec result: conformant within the resource fetching scope; internal
normalization is an explicit host policy, not a NAP cache-key requirement.
