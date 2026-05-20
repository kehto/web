---
'@kehto/shell': minor
---

**RENAME-02 (v1.8 Phase 42)** — the shell-bridge `bridge.injectEvent` topic `'auth:identity-changed'` is renamed to `'identity:changed'` (matches NIP-5D `identity` NUB domain naming).

**Soft-rename window.** For the v1.8 release, both `'auth:identity-changed'` and `'identity:changed'` trigger dual-emit so subscribers of either topic continue to receive events. Callers may pass either topic name — the wrapper always emits OLD first, then NEW, regardless of which input topic was supplied. Hard-removal of the legacy `'auth:identity-changed'` topic is scheduled for v1.9.

**Migration.** Subscribers (host shells subscribing to shell-injected `ifc.event` topics) should migrate to `'identity:changed'` before v1.9. After v1.9 the dual-emit branch is removed and `bridge.injectEvent('auth:identity-changed', …)` will forward the literal string — at which point any remaining subscribers of the old topic will silently stop receiving events. See PROJECT.md Known Tech Debt entry; the v1.9 deletion sweep can locate the branch by grepping for `remove this branch in v1.9` in `packages/shell/src/shell-bridge.ts`.
