# NIP-5D (PR #2303) + NAP Registry — Consolidated Delta Audit

Date: 2026-06-17
Author: alignment audit (4 parallel surface audits synthesized)

## Authoritative sources (current)

- **NIP-5D**: `nostr-protocol/nips` PR **#2303** (`5D.md`, OPEN). This is newer than the
  repo's pinned `specs/NIP-5D.md` mirror and newer than the `napplet/naps` `SPEC.md` mirror.
  Where they differ, **PR #2303 wins**.
- **NAP registry**: `napplet/naps` (master). Merged authoritative NAP specs today:
  - **NAP-SHELL** (domain `shell`) — the ONLY mandatory NAP; bootstrap handshake.
  - **NAP-INTENT** (domain `intent`) — archetype intent dispatcher.
  - **web projection** (`projections/web.md`) — iframe + postMessage binding.
  - All other domains (relay, storage, identity, inc, theme, keys, media, notify, resource,
    config, upload, value, outbox, cvm, pow) exist only as OPEN PRs in the registry.

## What changed since the 2026-05-22 audit (`NIP-5D-DELTA-AUDIT.md`)

1. **Terminology**: NUB → NAP; capability prefix `nub:` → `nap:`; domain `ifc` → `inc`.
2. **NAP-SHELL is now a formal mandatory spec** with a precise 2-message handshake
   (`shell.ready` / `shell.init`) and a `window.napplet.shell` API
   (`supports(domain, protocol?)`, `services`, `class`, `ready()`, `onReady()`).
3. **NAP-INTENT is now a formal spec** with `intent.*` wire types and archetype dispatch.
4. **NAAT archetypes**: manifest tag `["archetype", "<slug>", "<NAP-N>"]`; NAP-INTENT resolves
   against it from the signed-manifest catalog.
5. **Manifest kinds** moved to `5129` / `15129` / `35129` (already landed in v1.20).
6. **Identity = runtime computes from bytes; runtime is the gateway** (already landed in v1.20
   via srcdoc content-addressed loading).

## Conformance status — what is ALREADY aligned (v1.20 work)

These are verified aligned and require **no change** (regression-guard only):

- Manifest kinds `5129/15129/35129` defined + gated (`packages/nip/src/5d/index.ts:30-51`).
- Identity computed from verified bytes; gateway NOT in trust path
  (`packages/nip/src/5d/index.ts:275-306`, `apps/playground/src/napplet-resolver.ts`,
  `shell-host.ts:408-491`).
- Aggregate-hash recompute + `x`-tag match; manifest signature + per-blob sha256 verify before
  iframe (`5d/index.ts:159-292`).
- `srcdoc` injection, `sandbox="allow-scripts"` with no `allow-same-origin`
  (`shell-host.ts:428,512`).
- `MessageEvent.source` → identity map; silent-drop unmapped (`shell-bridge.ts:230-247`).
- `requires` load-time check (throws on missing NAP) (`shell-host.ts:415-420`).
- NAP-INTENT wire types, IntentRequest/Result/Availability/Candidate shapes, default-handler,
  chooser, error strings (`packages/services/src/intent-*.ts`, `catalog-intent-resolver.ts`).
- `supports()` payload sufficiency: capability object internal shape is **non-normative** per
  NAP-SHELL ("only that it can answer supports(domain, protocol?)"). Kehto's
  `{naps, nubs, sandbox}` shape is therefore conformant; the spec's `{domains, protocols}` is
  only an example. **No payload-shape change required.**

## GAPS — actionable deltas (this is the work)

### G1 — NAP-SHELL: `shell.init` resent on duplicate `shell.ready` (MUST violation)
- **Spec**: shell MUST send `shell.init` **exactly once** per napplet lifecycle; a duplicate
  `shell.ready` MUST be idempotent (no second session, **no resend**).
- **Current**: session registration is guarded, but `handleShellReady` calls `postShellInit`
  **unconditionally** on every `shell.ready` (`packages/shell/src/shell-ready.ts:15-24`). No
  `initSent` guard exists.
- **Fix**: track per-windowId "init already sent" (Set in bridge closure or flag on session
  entry); skip `postShellInit` on subsequent `shell.ready`. Add regression test asserting
  exactly one `shell.init` postMessage across two `shell.ready` deliveries.
- **Severity**: HIGH (real protocol bug).

### G2 — NAP-SHELL: `class` wire type is `string | null`, spec says `number | null`
- **Spec**: `class: number | null` — an opaque integer the runtime assigns.
- **Current**: `NappletClass = string | null` (`packages/runtime/src/types.ts:20`); emitted in
  `shell.init` (`shell-ready.ts:104-113`).
- **Decision needed**: either (a) map the resolved class to a numeric code on the wire while
  keeping the internal string label, or (b) treat kehto's string label as an implementation
  extension and document the deviation. Recommend (a) for spec parity (opaque integer), with
  `null` preserved for the permissive default.
- **Severity**: MEDIUM (wire-type drift; affects `NappletShell.class: number | null` contract).

### G3 — NAAT archetypes not parsed or wired (NIP-5D + NAP-INTENT)
- **Spec**: manifest carries `["archetype", "<slug>", "<NAP-N>"]`; NAP-INTENT MUST source
  `available()`/`handlers()` from the signed-manifest catalog keyed by archetype.
- **Current**: `parseNappletManifest` does NOT parse `archetype` tags
  (`packages/nip/src/5d/index.ts:128-151`); `NappletManifest` has no `archetypes` field. The
  intent resolver consumes a **pre-derived** `IntentCatalogEntry.archetypes` map assumed
  supplied by the host — nothing builds it from manifests
  (`packages/services/src/catalog-intent-resolver.ts:49-56`).
- **Fix**: (1) parse `archetype` tags in `@kehto/nip/5d` → add `archetypes: {slug, nap}[]` to
  `NappletManifest`; (2) add a NIP-5A-manifest → `IntentCatalogEntry` adapter; (3) wire the
  playground catalog to derive archetypes from resolved manifests; (4) add at least one
  playground napplet with an `archetype` tag + an intent dispatch e2e.
- **Severity**: HIGH (entire archetype axis is missing; NAP-INTENT "source from signed
  manifests" satisfied only by convention).

### G4 — NIP-5D manifest: `source` tag not parsed
- **Spec**: optional `source` adopted from NIP-5A.
- **Current**: not parsed; no `source` field on `NappletManifest`.
- **Fix**: parse optional `source`; add to type. **Severity**: LOW.

### G5 — `nap:` vs `nub:` capability prefix split
- **Spec**: bare/`nap:` for capabilities, `perm:` for permissions.
- **Current**: shim 0.9.0 conformance logic normalizes `nap:`
  (`packages/shell/src/shell-supports-conformance.test.ts:38`), but `specs/NIP-5D.md:124` and
  `packages/shell/tests/perm-namespace.test.ts:120` use `nub:`. The playground bootstrap
  (`apps/playground/napplets/shared-vite-config.ts:36-53`) accepts BOTH `nap:` and `nub:`.
- **Fix**: make `nap:` the documented/tested primary prefix; keep `nub:` accepted only as
  back-compat. Update `specs/NIP-5D.md` + `perm-namespace.test.ts`. **Severity**: MEDIUM.

### G6 — Playground exercises legacy `nubs`/`ifc` path, not modern `naps`/`inc`
- **Observation**: installed shim is **0.5.0** (reads `capabilities.nubs`); dual-emit MUST stay.
  But the playground bootstrap + `getMissingRequiredNaps` read `nubs`
  (`shared-vite-config.ts:48`, `apps/playground/src/demo-hooks.ts:303-307`), and 4 napplets
  (bot, chat, feed, profile-viewer) still `require`/`supports` bare `ifc` instead of `inc`. The
  modern `naps`-only path the real shim uses is therefore **not exercised** by any test.
- **Fix**: migrate the 4 napplets' `requires`/`supports` from `ifc` → `inc`; make the
  playground bootstrap + requires-check read `naps` (falling back to `nubs` for the 0.5.0 shim
  window); add a conformance e2e that asserts the `naps`-only path answers `supports('inc')` /
  `supports('inc','NAP-01')`. Keep dual-emit (do NOT execute CLEANUP-01 while shim is 0.5.0).
- **Severity**: MEDIUM (latent break risk; modern path untested).

### G7 — Stale spec/docs/comments: NUB terminology + wrong authority citation
- **`specs/NIP-5D.md`**: cites `dskvr/nips#3` / NIP-5A `#2287`; should cite
  `nostr-protocol/nips#2303`. Uses "NUB" throughout. Missing `archetype`/`source` manifest tags.
- **`RUNTIME-SPEC.md`**: review for AUTH/REGISTER/NUB stale wording vs current identity-at-
  creation + NAP model.
- **READMEs / service JSDoc**: heavy `NUB`/`NUB-NN`/`ifc` vocabulary (shell, services, acl,
  playground READMEs; config/resource/keys service JSDoc).
- **Fix**: refresh `specs/NIP-5D.md` (authority, NAP terminology, archetype/source); add local
  mirrors of NAP-SHELL + NAP-INTENT under `specs/`; sweep stale comments. Keep `@napplet/nub`
  *import specifier* as-is (real published package name). **Severity**: LOW–MEDIUM (docs).

### G8 — Unknown-action handling not uniform across known domains (carryover S-010)
- **Spec**: messages with unrecognized `type` MUST be silently ignored.
- **Current**: some known-domain unknown actions emit `.error`, others silently ignore.
  NAP-INTENT explicitly DOES allow `.result`/`.error` with structured errors, so intent is fine.
- **Fix**: confirm per-NAP whether `.error` is spec-sanctioned (NAP-INTENT yes); normalize the
  rest to silent-ignore for truly unrecognized `type`. **Severity**: LOW (verify, mostly OK).

## Proposed milestone / phase chunking for GSD

**Milestone v1.21 — NIP-5D #2303 + NAP-SHELL/INTENT conformance**

- **Phase A — NAP-SHELL correctness** (G1, G2): `shell.init` exactly-once guard; `class`
  number|null reconciliation. Pure runtime/shell + unit tests. Highest severity, smallest blast
  radius. Do first.
- **Phase B — NAAT archetype axis** (G3, G4): parse `archetype`+`source` in `@kehto/nip/5d`;
  manifest→IntentCatalogEntry adapter; playground catalog wiring; archetype-tagged napplet +
  intent e2e. Largest functional gap.
- **Phase C — Terminology & playground modern-path alignment** (G5, G6): `nap:` primary prefix;
  migrate 4 napplets `ifc`→`inc`; playground reads `naps` (nubs fallback); naps-path conformance
  e2e. Keep dual-emit.
- **Phase D — Spec/doc refresh** (G7, G8): `specs/NIP-5D.md` authority+NAP terminology+archetype;
  local NAP-SHELL/NAP-INTENT mirrors; `RUNTIME-SPEC.md` refresh; comment sweep; verify
  unknown-action uniformity.

Hard constraints carried from memory/state:
- Installed shim is **0.5.0** → KEEP `naps`+`nubs` dual-emit; do not run CLEANUP-01.
- CI e2e runs `workers:1`; reload-heavy specs need `test.setTimeout(120s)`.
- `turbo.json globalDependencies` must include shared-vite-config for napplet rebuilds.
- Playground `DEMO_CAPABILITIES` count asserted by multiple e2e specs — update counts in lockstep.
- Resolution sim must stay crash-proof; NIP-5A vector is pinned.
- Direct `main` push blocked — branch + PR.

## Stop condition mapping

kehto aligns with NIP-5D (#2303) + NAP-SHELL + NAP-INTENT (G1–G8 resolved) → tests
updated/added & green → packages build + type-check → pushed → PR opened.
