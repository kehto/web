# Phase 12: Shell Conformance & Seven-Nub Coverage - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Close every canonical NIP-5D spec violation in @kehto/shell, cover every message type for the seven non-theme nubs (identity, ifc, keys, media, notify, relay, storage), and extend ACL capability mapping to the full 8-domain surface (including theme — theme's runtime/service wiring lands in Phase 13).

Explicit deliverables:

1. **Shell conformance (SH-C01/02/03):**
   - Hard-delete `window.nostr = { ... }` block and its `_shellRequest('signer.*')` helpers from @kehto/shell
   - Rename sandbox permission lookups in `shell.supports()` from bare names to `perm:<permission>` namespace
   - Remove `'signer'` from shell capability advertisement (v1.1 artifact)
   - Confirm signing/encryption are reachable only via `relay.publish` / `relay.publishEncrypted` (shell-internal)

2. **Seven-nub dispatch + services (NUB-03..09):**
   - Runtime dispatch for each of identity, ifc, keys, media, notify, relay, storage message surfaces
   - Reference services: split `signer-service.ts` into deletion + new `identity-service.ts`; create stub-level `keys-service.ts`, `media-service.ts`, `notify-service.ts` (dispatch + ACL + echo `.result`, no real backends)
   - Existing relay-service / storage equivalents retrofitted to @napplet/nub-* types

3. **ACL coverage (NUB-10):**
   - `resolveCapabilitiesNub` in @kehto/acl covers every `<domain>.<action>` for all 8 domains (theme included)
   - `ALL_CAPABILITIES` extended with new capability constants per new domain
   - Signer branch in resolve.ts is DELETED (with DRIFT-ACL-05..08 annotations removed)

4. **Drift audit closure (SPEC-03):**
   - Every DRIFT row in `docs/v1.2-NIP-5D-AUDIT.md` tagged Target Phase 12 is resolved. Phase 10 audit doc is updated with closure markers (status column or checkbox).

No behavior changes to theme (Phase 13) or dispatch refactor (Phase 14). DRIFT-CORE-06 (core-compat.ts shim from Phase 11) is NOT closed here — it remains until napplet/core re-exports the symbols or Phase 14 removes the need.

</domain>

<decisions>
## Implementation Decisions

### Implementation Strategy

- **Signer fate**: Split + delete. `getPublicKey`/`getRelays` migrate to a new `packages/services/src/identity-service.ts`. `signEvent` / `nip04.*` / `nip44.*` helpers are deleted outright — they have no upstream home; signing/encryption now flow through `relay.publish` / `relay.publishEncrypted` which the shell handles internally (no napplet-visible API surface for signing).
- **New domain services (keys, media, notify, identity)**: Stub-level handlers. Each service:
  - Subscribes to its domain's dispatch
  - Applies ACL gate
  - Responds with typed `.result` envelope (empty/default values acceptable)
  - Does NOT implement a real backend (no real keyboard listener, no real Notification API call, no real MediaSession). Host apps plug actual backends via `runtime.registerService(<domain>, realHandler)`.
  - Identity-service IS populated with real logic for `getPublicKey`/`getRelays` (those are read-only nostr info that maps to existing shell state).
- **`window.nostr` removal**: Hard delete. Zero back-compat. Remove the `window.nostr = { ... }` block, the internal `_shellRequest('signer.*')` helpers it calls, and the `'signer'` entry in the capability-advertisement array. Update or delete every test that asserts `window.nostr` presence (most are in the skipped `shell-runtime-integration.test.ts` already).
- **Execution ordering (3 waves):**
  - Wave 1: Shell conformance (SH-C01/02/03) — small, independent, unblocks ACL cap renames
  - Wave 2: Per-nub dispatch + service implementation in parallel (NUB-03/04/05/06/07/08/09) — seven plans, one per nub
  - Wave 3: ACL extension + drift audit closure (NUB-10, SPEC-03) — consolidated after all nubs land

### ACL & Testing Scope

- **New capability constants** per new domain added to `@kehto/acl`:
  - `identity:read` — getPublicKey, getRelays, getProfile, getFollows, getList, getZaps, getMutes, getBlocked, getBadges
  - `keys:bind` — keys.register, keys.unregister
  - `keys:forward` — keys.forward, keys.action
  - `media:control` — all media.session.*, media.command, media.controls, media.state, media.capabilities
  - `notify:send` — notify.send, notify.dismiss, notify.badge
  - `notify:channel` — notify.channel.register, notify.permission.request
  - `theme:read` — theme.get (already exists conceptually; confirmed in Phase 13)
  - relay/storage/ifc keep existing cap mapping (retrofit message types only)
- **Shell adapter API unchanged**: `runtime.registerService('<domain>', handler)` remains the public API; new services conform to the existing `ServiceHandler` interface.
- **Test depth**: Minimal per-nub dispatch test — one unit test per service confirming:
  1. `<domain>.<action>` request produces `<domain>.<action>.result` envelope
  2. Ungranted capability produces `.error` envelope with expected denial shape
  - No backend behavior tests. Acceptance for Phase 12 is dispatch correctness.
- **Migration doc**: Inline JSDoc header at `identity-service.ts` (one paragraph listing signer→identity mapping) + one note in `REQUIREMENTS.md` DEPS-03 reminding Phase 15 to enumerate in changelog. No dedicated migration document.

### DRIFT marker removal

Every DRIFT-<ID> marker added in Phase 11 (Phase 12-targeted) is DELETED as part of the code change it annotated. No DRIFT markers for Phase 12 targets remain after phase completion. Phase 15 verification greps `packages/*/src/` for orphan markers as a release-gate check.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docs/v1.2-NIP-5D-AUDIT.md` — 40 DRIFT rows; 26 targeted at Phase 12. Planner extracts those rows as the concrete work list.
- `packages/services/src/signer-service.ts` — structure to mirror for new identity-service.ts (read JSDoc pattern, `createSignerService` function, handleMessage switch)
- `packages/services/src/relay-pool-service.ts`, `coordinated-relay.ts`, `cache-service.ts`, `audio-service.ts`, `notification-service.ts` — existing reference services, already on NappletMessage format from v1.1
- `packages/runtime/src/runtime.ts` — existing dispatch switch (currently 4-way: relay/signer/storage/ifc). Phase 12 expands to 8-way. Phase 14 replaces switch with createDispatch().
- `packages/acl/src/resolve.ts` — existing resolveCapabilitiesNub. Signer case deleted; 4 new domain cases added. Zero-runtime-dep constraint preserved (types-only imports).
- `packages/acl/src/capabilities.ts` — ALL_CAPABILITIES constant. New entries appended; signer caps (`sign:event`, `sign:nip04`, `sign:nip44`) deleted.

### Established Patterns
- All service files follow: JSDoc header, `createXxxService(runtime, options)` factory returning a `ServiceHandler`, handleMessage(envelope) switch on `msg.type`, typed `.result`/`.error` envelope responses.
- Tests: `*-service.test.ts` next to source; vitest; envelope-format assertions.
- v1.1 pattern for envelope responses: `{ type: '<domain>.<action>.result', payload: { ... }, windowId, id }` or `.error` with `reason` field.

### Integration Points
- Runtime dispatch switch (runtime.ts:745-748 approximately) extends from 4 domains → 8 domains. Phase 14 replaces entirely.
- Services register via `runtime.registerService(<domain>, handler)` at shell init time.
- Shell init (`shell-init.ts`) currently registers signer with 'signer' — rename/adjust capability advertisement to not include 'signer'.
- Test skips in `tests/unit/shell-runtime-integration.test.ts` — once signer is fully removed and identity is wired, revisit the file: some tests can be un-skipped and migrated; others may stay skipped or get deleted.

</code_context>

<specifics>
## Specific Ideas

- New service files follow existing naming: `identity-service.ts`, `keys-service.ts`, `media-service.ts`, `notify-service.ts`. One test file per service.
- Consolidate cap constants in one place (`packages/acl/src/capabilities.ts` — existing) rather than spreading across modules.
- At phase end, `grep -rE "DRIFT-.*Phase 12" packages/*/src/` returns zero matches (every Phase 12 marker is deleted as part of its closure).
- `docs/v1.2-NIP-5D-AUDIT.md` gets a "Resolved in Phase 12" annotation or checkbox per closed row.

</specifics>

<deferred>
## Deferred Ideas

- Full backend implementations for keys/media/notify services — Phase 13+ (or separate milestone). Stubs suffice for Phase 12.
- Theme runtime+service+shell wiring — Phase 13 owns this. Phase 12 only adds theme's ACL capability.
- Dispatch refactor to `createDispatch()` — Phase 14 explicitly. Phase 12 keeps the hand-rolled switch, just widens it to 8 domains.
- Unskipping the 19 deferred tests in `shell-runtime-integration.test.ts` — decided case-by-case during Phase 15 test triage. Some tests are fundamentally about removed `BusKind` semantics and will be deleted, not migrated.
- Removing the `core-compat.ts` shim (DRIFT-CORE-06) — deferred until Phase 14 dispatch refactor or @napplet/core restores the removed constants.
- Separate migration doc — a paragraph in `identity-service.ts` JSDoc + a note in REQUIREMENTS.md DEPS-03 suffice for v1.2 release. Phase 15 changelog rollup captures the full story.

</deferred>
