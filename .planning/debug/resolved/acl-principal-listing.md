---
status: resolved
trigger: "Issue #300: Runtime ACL listing omits the principal required by keyed policy methods"
---

## Evidence and protocol check

Main `fcf0a387` discards each ACL map key during enumeration. AclEntryExternal has
no dTag/hash fields, so callers cannot identify the principal to mutate.
Checked NIP-5D PR #2303 at `dskvr/nips@020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7`
and napplet/naps master `3fdba1accd508ab54939b277d426127c5af8faf8`.
Principal enumeration is a host API with no owning NAP wire message. Preserve the
existing dTag/artifact-hash policy identity and serialized format; add identity
fields to results. This is host policy outside the wire contract.

## Current focus

Return dTag and aggregateHash from getEntry/getAllEntries. Recover listing keys
at the final separator so identifiers containing colons round-trip. Test distinct
principals with identical grants, persistence/reload, keyed mutation from listing,
lookup/list consistency, and return-value isolation. GSD debug runs inline.

## Verification

Build/type/docs, all 2,158 unit tests and AI-slop 100/100 pass. Two new regression
cases cover principal round-tripping and detached results. Browser tests are not
required for these additive host API fields: no browser consumer calls this
runtime enumeration API, and shell wiring/messages are unchanged. The shared
CVM fake-clock validation prerequisite from #309 is carried as a test-only commit.
