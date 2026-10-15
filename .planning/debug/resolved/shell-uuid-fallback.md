---
status: resolved
trigger: "Issue #237: shell UUID generation throws on insecure HTTP origins"
---

## Evidence and authority

The crypto adapter, cache adapter, and source-session registration call
`crypto.randomUUID()` directly. Chromium exposes `getRandomValues()` on plain
HTTP but not `randomUUID()`. All three host paths need the same secure random
UUID implementation. Preserve the native method when present.

Checked NIP-5D PR #2303 at `020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7`
and NAP-SHELL on `napplet/naps` master at
`19de5ce1cea40cd4c76089cdd8126e9f87648049` (unchanged from the prior checked
NAP-SHELL text). UUID generation is host implementation policy; identity stays
bound to the registered source independently of optional shell readiness.

## Current focus

GSD debug runs inline. Add RFC 9562 UUID v4 generation from 16 Web Crypto bytes,
cover native/fallback/error paths and actual event/session/cache use, then prove
the browser reproduction on a non-localhost HTTP origin. No weak randomness.


## Resolution and verification

One internal helper preserves native UUID generation and otherwise consumes
16 cryptographically random bytes, setting UUID v4 version/variant bits. Event
injection, cache query IDs, and source-session IDs use it. Explicit errors cover
missing entropy support; neither path is a deprecated caller API.

Build (32 tasks), type-check (17 tasks), 2,162 unit tests / 170 files, docs audit
(9 packages), 125 Playwright tests, and AI-slop 100/100 pass. Browser tests prove
actual HTTP crypto capability restrictions and HTTPS native availability without
mocking those APIs. A pre-existing Paja resolver elapsed-time assertion failed
once under concurrent build load (183 ms versus 150 ms); the full unit rerun
passed unchanged with two workers.

Spec result: host implementation policy; no change to protocol wire shape,
source identity trust, or optional shell readiness. Conformant within that scope.
