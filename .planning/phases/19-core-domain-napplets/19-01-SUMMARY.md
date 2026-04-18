---
phase: 19-core-domain-napplets
plan: 01
subsystem: napplets
tags: [napplet, relay, relay-publish, nip-44, vite, sdk, shim, composer]

# Dependency graph
requires:
  - phase: 18-napplet-sdk-migration
    provides: bot/chat SDK migration patterns, D-04 init pattern, anti-term conventions
provides:
  - "@kehto/demo-composer workspace package with buildable napplet exercising relay.publish + relay.publishEncrypted"
  - "D-02 DOM contract: 6 IDs (composer-status, composer-input, composer-encrypted-toggle, composer-recipient, composer-publish-btn, composer-log)"
  - "NAP-03 closed at source level: composer napplet exists and builds"
affects:
  - 19-04-core-domain-napplets (DEMO_NAPPLETS registration)
  - 19-05-core-domain-napplets (relay-publish spec)
  - 19-06-core-domain-napplets (relay-publish-encrypted + acl-revoke spec)
  - 19-07-core-domain-napplets (iteration gate)

# Tech tracking
tech-stack:
  added: ["@kehto/demo-composer (new workspace package)"]
  patterns:
    - "D-04 init pattern: storage.getItem probe to gate on shim AUTH, then status -> 'authenticated'"
    - "Composer DOM contract: #composer-status sentinels for spec gating (connecting -> authenticated -> published/denied)"
    - "Encrypted recipient placeholder: 0000...0001 hex fallback for spec-drivable encrypted publish"

key-files:
  created:
    - apps/demo/napplets/composer/package.json
    - apps/demo/napplets/composer/tsconfig.json
    - apps/demo/napplets/composer/vite.config.ts
    - apps/demo/napplets/composer/index.html
    - apps/demo/napplets/composer/src/main.ts
  modified:
    - pnpm-lock.yaml (auto-updated by pnpm install for new workspace package)

key-decisions:
  - "JSDoc anti-feature comments must use neutral phrasing to avoid false-positive anti-term grep matches (extends Phase 18 decision)"
  - "Encrypted publish uses deterministic fallback pubkey (0000...0001) when recipient field is empty — allows spec-driven encrypted publish without real NIP-46 key exchange"
  - "D-04 probe uses storage.getItem (not relay) so state:read denial does not block auth sentinel"

patterns-established:
  - "Composer status sentinel: 'connecting...' -> 'authenticated' -> 'published: <id-prefix>' or 'denied: <reason>' — Layer-B specs assert each transition"
  - "Relay publish: EventTemplate with kind:1, tags [['t', 'demo-composer']], created_at as unix seconds"

requirements-completed: [NAP-03]

# Metrics
duration: 3min
completed: 2026-04-18
---

# Phase 19 Plan 01: Composer Napplet Summary

**@kehto/demo-composer napplet skeleton and SDK-wired main.ts exercising relay.publish + relay.publishEncrypted (NIP-44) with deterministic D-02 DOM contract**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-18T01:21:29Z
- **Completed:** 2026-04-18T01:23:37Z
- **Tasks:** 2
- **Files modified:** 6 (5 created + pnpm-lock.yaml)

## Accomplishments

- Created full `@kehto/demo-composer` workspace package (package.json, tsconfig.json, vite.config.ts, index.html, src/main.ts) mirroring bot/chat structure
- Implemented relay.publish (plain kind:1) and relay.publishEncrypted (NIP-44) via @napplet/sdk with D-04 init pattern
- Verified build: `pnpm --filter @kehto/demo-composer build` exits 0; dist/index.html contains napplet-aggregate-hash meta tag
- All 6 D-02 DOM contract IDs present in index.html and referenced in src/main.ts
- Anti-term grep clean: no message listener, no NIP-01 arrays, no legacy bus enums, no global nostr accessor

## Task Commits

1. **Task 1: Scaffold @kehto/demo-composer workspace skeleton** — `b95758a` (feat)
2. **Task 2: Implement composer src/main.ts** — `7dd5cb8` (feat)

**Plan metadata:** (upcoming docs commit)

## Files Created/Modified

- `apps/demo/napplets/composer/package.json` — Workspace package definition; name @kehto/demo-composer; links @napplet/shim, @napplet/sdk, @napplet/vite-plugin
- `apps/demo/napplets/composer/tsconfig.json` — Verbatim copy of bot tsconfig (ES2022, ESNext, bundler, strict)
- `apps/demo/napplets/composer/vite.config.ts` — Vite config with nip5aManifest({ nappletType: 'demo-composer' })
- `apps/demo/napplets/composer/index.html` — Composer HTML with dark monospace theme and all 6 D-02 DOM contract IDs
- `apps/demo/napplets/composer/src/main.ts` — SDK-wired entry: shim import, relay.publish + relay.publishEncrypted, D-04 init, formatError + log helpers
- `pnpm-lock.yaml` — Updated by pnpm install for new workspace package

## Decisions Made

- JSDoc anti-feature comments must use neutral phrasing (e.g. "no legacy bus enums" not "no BusKind") to avoid false-positive grep matches — extends Phase 18 decision.
- Encrypted publish uses deterministic fallback pubkey (64-char hex `0000...0001`) when `#composer-recipient` is empty, enabling spec-driven encrypted publish without a real NIP-46 key exchange.
- D-04 probe via `storage.getItem` (not `relay.publish`) so `state:read` denial does not affect the authenticated status sentinel — denial still signals AUTH completed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] JSDoc comment phrasing triggered anti-term grep false positive**
- **Found during:** Task 2 verification
- **Issue:** JSDoc `* Anti-features (per v1.3 milestone): no raw window message protocol listener, no NIP-01 arrays, no BusKind, no global nostr, no signer-service` matched both `BusKind` and `signer-service` in the anti-term grep pattern
- **Fix:** Replaced "no BusKind" with "no legacy bus enums" and removed "no signer-service" from JSDoc (redundant — already covered by "no global nostr accessor")
- **Files modified:** apps/demo/napplets/composer/src/main.ts
- **Verification:** `grep -E "BusKind|window\.nostr|signer-service|kind === 2900[12]"` returns zero matches
- **Committed in:** 7dd5cb8 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - phrasing fix)
**Impact on plan:** Minor comment rewording only. No functional changes. No scope creep.

## Issues Encountered

None beyond the JSDoc phrasing fix documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- NAP-03 closed: composer napplet is buildable and provides the D-02 DOM contract
- Plan 19-04 can register `@kehto/demo-composer` in DEMO_NAPPLETS without further changes to composer source
- Plans 19-05 and 19-06 can assert against the DOM contract sentinels (#composer-status transitions)
- Plan 19-07 iteration loop can assert composer-aggregate-hash is non-empty (or empty-but-consistent per Phase 18 decision)
- Known: `VITE_DEV_PRIVKEY_HEX` not set — aggregate-hash is empty string (consistent with bot/chat; ACL keys on dTag:'' consistently)

---
*Phase: 19-core-domain-napplets*
*Completed: 2026-04-18*
