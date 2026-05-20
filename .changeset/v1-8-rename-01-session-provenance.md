---
'@kehto/shell': minor
'@kehto/runtime': minor
---

**RENAME-01 (v1.8 Phase 42)** — `SessionEntry.identitySource: 'auth' | 'source'` is renamed to `SessionEntry.provenance: 'nip-5d' | 'legacy-auth'` across both `@kehto/shell` and `@kehto/runtime`. The new field name and variant values name the actual provenance (canonical NIP-5D origin registration vs legacy AUTH handshake) instead of the obsolete `'auth'`/`'source'` shorthand.

**Migration:** Downstream consumers reading `entry.identitySource === 'source'` must rewrite to `entry.provenance === 'nip-5d'`. Consumers reading `entry.identitySource === 'auth'` must rewrite to `entry.provenance === 'legacy-auth'`. The old field is hard-removed; no compatibility shim ships.

RENAME-02 (the `'auth:identity-changed'` topic rename in this same milestone) ships as a soft-rename with dual-emit — see its changeset for that migration window.

Pre-1.0 minor bump is breaking per kehto's convention. The v1.6 carryover note flagged this rename as low-risk because the field is internal-leaning and the test surface is the primary live producer in this repo. Additional consumers updated in the same pass: `apps/playground/src/shell-host.ts` and `tests/e2e/harness/harness.ts`.
