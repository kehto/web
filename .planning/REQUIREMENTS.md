# Requirements: Kehto Runtime — v1.21 NIP-5D (#2303) + NAP-SHELL/INTENT Conformance

**Defined:** 2026-06-17
**Core Value:** Modular, framework-agnostic runtime for hosting napplet applications — any Nostr client can embed sandboxed mini-apps by integrating @kehto/shell.
**Authoritative sources:** `nostr-protocol/nips` PR **#2303** (`5D.md`) + the `napplet/naps` registry — **NAP-SHELL** (mandatory handshake) and **NAP-INTENT** (archetype dispatch), plus `projections/web.md`.
**Audit:** `.planning/NIP-5D-2303-DELTA-AUDIT.md` (gaps G1–G8).

## v1 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase.

### Phase A — NAP-SHELL Handshake Correctness

- [x] **SHELL-01**: The runtime sends `shell.init` **exactly once** per napplet lifecycle — a duplicate `shell.ready` from the same window is idempotent (no second session established, no `shell.init` resend). A regression test asserts exactly one `shell.init` postMessage across two `shell.ready` deliveries from one window. (G1)
- [x] **SHELL-02**: The `class` field carried in `shell.init` conforms to the NAP-SHELL contract `number | null` — an opaque integer class code (or `null` for the permissive default), with the internal class-posture label mapped to that wire value. A test asserts the emitted `class` is `number | null`. (G2)

### Phase B — NAAT Archetype Axis (NIP-5D manifest + NAP-INTENT)

- [ ] **ARCH-01**: `@kehto/nip/5d` parses the `["archetype","<slug>","<NAP-N>"]` manifest tag(s) into a structured `archetypes` field on `NappletManifest`, and parses the optional `source` tag. Unit tests cover single, multiple, and absent archetype tags. (G3, G4)
- [ ] **ARCH-02**: A NIP-5A-manifest → `IntentCatalogEntry` adapter derives a napplet's archetype catalog entry (slug → actions/protocols) from its resolved signed manifest, so NAP-INTENT `available()` / `handlers()` are sourced from signed manifests rather than host-injected catalog data. Unit tests cover the adapter. (G3)
- [ ] **ARCH-03**: The playground catalog is populated from resolved manifests via the adapter, and at least one playground napplet declares an `archetype` tag. (G3)
- [ ] **ARCH-04**: An e2e (or integration) test exercises NAP-INTENT dispatch end-to-end against the archetype-tagged napplet — `intent.available` reports the candidate and `intent.invoke` resolves to it. (G3)

### Phase C — Terminology & Playground Modern-Path Alignment

- [ ] **TERM-01**: `nap:` is the primary, documented, and tested capability prefix in `shell.supports()` resolution; `nub:` is accepted only as back-compat. `specs/NIP-5D.md` and `packages/shell/tests/perm-namespace.test.ts` use `nap:` (with `nub:` retained as an accepted-alias assertion). (G5)
- [x] **TERM-02**: The 4 legacy playground napplets (bot, chat, feed, profile-viewer) declare `requires` and call `supports()` using `inc` (not `ifc`). (G6)
- [x] **TERM-03**: The playground bootstrap (`shared-vite-config.ts`) and `getMissingRequiredNaps` (`demo-hooks.ts`) resolve capabilities from `capabilities.naps`, falling back to `nubs` only for the installed 0.5.0 shim. (G6)
- [ ] **TERM-04**: An e2e asserts the modern `naps`-only path answers `supports('inc')` true and `supports('inc','NAP-01')` true for an `inc`-capable napplet, proving the path the real shim uses is exercised. (G6)
- [x] **TERM-05**: `naps`+`nubs` dual-emit is preserved (installed shim is 0.5.0); existing `shell-init` / `no-window-nostr` capability-payload assertions stay green. CLEANUP-01 is NOT performed. (G6 constraint)

### Phase D — Spec / Doc Refresh & Conformance Sweep

- [ ] **DOCS-01**: `specs/NIP-5D.md` cites `nostr-protocol/nips#2303` as the authority (and the current NIP-5A PR), uses NAP terminology throughout (not NUB), and documents the `archetype` and `source` manifest tags. (G7)
- [ ] **DOCS-02**: Local mirrors of NAP-SHELL and NAP-INTENT are added under `specs/` and referenced from `specs/NIP-5D.md`. (G7)
- [ ] **DOCS-03**: `RUNTIME-SPEC.md` is refreshed to the #2303 / NAP model; stale NUB/AUTH/REGISTER comments in shell/services/runtime source are swept (the `@napplet/nub` import specifier is preserved — it is the real published package name). (G7)
- [ ] **DOCS-04**: Unknown-`type` handling is verified uniform — truly unrecognized message types are silently ignored across known domains, except where a NAP spec sanctions structured errors (NAP-INTENT permits `.result`/`.error`). Any divergence is normalized or documented. (G8)

### Verification

- [ ] **VERIFY-01**: `pnpm build`, `pnpm type-check`, the unit suite, and the Playwright e2e suite are all green; changesets are added for every `@kehto/*` package whose public surface or behavior changed.

## v2 / Future Requirements

- CLEANUP-01: remove `naps`+`nubs` / `inc`+`ifc` dual-emit once the installed shim is upgraded past 0.5.0 (deferred — would break the current playground shim).
- Implement remaining registry NAP domains not yet covered (`pow`, `value`) if/when their specs merge.

## Out of Scope

- Upgrading `@napplet/shim` beyond 0.5.0 or removing back-compat dual-emit (would break the playground; tracked as CLEANUP-01).
- Re-verifying v1.20 content-addressed loading internals (manifest kinds, identity-from-bytes, srcdoc, signature/blob/aggregate verification) — already aligned; regression-guard only.
- `@napplet/*` SDK/shim/vite-plugin changes (this repo is runtime-only).
- NIP-5D instancing and any non-web NAP projection.

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| SHELL-01 | 86 | Complete |
| SHELL-02 | 86 | Complete |
| ARCH-01 | 87 | Pending |
| ARCH-02 | 87 | Pending |
| ARCH-03 | 87 | Pending |
| ARCH-04 | 87 | Pending |
| TERM-01 | 88 | Pending |
| TERM-02 | 88 | Complete |
| TERM-03 | 88 | Complete |
| TERM-04 | 88 | Pending |
| TERM-05 | 88 | Complete |
| DOCS-01 | 89 | Pending |
| DOCS-02 | 89 | Pending |
| DOCS-03 | 89 | Pending |
| DOCS-04 | 89 | Pending |
| VERIFY-01 | 86–89 | Pending |
