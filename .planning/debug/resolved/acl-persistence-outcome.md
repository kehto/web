---
status: resolved
trigger: "Issue #302: Runtime ACL persistence silently loses failed revocations after reload"
---

## Evidence

On main `fcf0a387`, `persist()` and `clear()` suppress backend exceptions and
return void. The observer documentation incorrectly claims successful persistence
even though mutations and notifications are synchronous in-memory operations.

## Specification check

Checked NAP-RELAY draft PR #2 at
`9f30b3505335a52c574ff570576687d6467021ff`, `naps/NAP-RELAY.md`, and the
napplet/naps master tree at `3fdba1accd508ab54939b277d426127c5af8faf8`.
ACL enforcement is host policy. No NAP specifies the host ACL persistence API or
durability result. This is an explicit host API policy decision outside the wire
contract: return true on backend success and false on failure, retain immediate
live mutations, and never silently undo revocation after a failed save.

## Current focus

Reproduce throwing-backend failure through the public container. Add boolean
outcomes to persist/clear, document live versus durable state and observer order,
test failure/retry/reload and quiet canonical use, then ship a PR for #302.
GSD debug runs inline in an isolated worktree.

## Verification progress

Three new regression cases fail before the fix and pass afterward, covering
revoke, block, and clear failures; durable retry/reload; live policy; and observer
ordering. Public return types are asserted as boolean. The compatibility register
documents the erased old-use boundary, quiet canonical behavior, and host error UI
guidance. A minor 0.x changeset covers custom container implementations that must
now return boolean rather than void.

The test-only CVM fake-clock prerequisite from PR #309 is carried as its own
commit. No CVM runtime change. Its checked timeout authority is NAP-CVM PR #31
`28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f`.

## Final verification

Build, type-check, docs:check, 2,159 unit tests, all 123 browser tests and
AI-slop 100/100 pass. Browser validation used a temporary IPv6 preview config
to avoid an unrelated IPv4 listener. A TypeDoc media-copy dead link was fixed
by linking the compatibility register through its public repository URL.
