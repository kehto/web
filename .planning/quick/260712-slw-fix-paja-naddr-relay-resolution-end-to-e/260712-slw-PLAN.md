---
quick_id: 260712-slw
status: in_progress
description: Fix Paja naddr relay resolution end-to-end
created: 2026-07-12
spec_refs:
  nip19_nip65: 8f8444d05a8842c40211ded5d10af3521541f865
  nip5d_pr_2303: 78efc118278e3ed42201eba9b60530b65835d7ed
  nap_registry: 5fd99465892fbead3888d7146e1737f77b0ed0b4
must_haves:
  truths:
    - Pointer relay hints remain first and configured live relays are normalized and deduplicated behind them.
    - Relay-disabled simulation contributes no configured fallback relays.
    - One deadline bounds relay fanout and errors distinguish timeout/query failure from EOSE no-match.
    - Manifest signature, aggregate, blob hash, and srcdoc verification remain fail-closed.
    - Supplied Good Morning Protocol naddr resolves through built resolver and served Paja UI while external event and blob remain available.
  artifacts:
    - packages/paja/src/runtime-resolver.ts
    - packages/paja/src/runtime-resolver.test.ts
    - packages/paja/src/browser-host.ts
    - packages/paja/src/browser-host.test.ts
    - docs/packages/paja.md
    - .changeset/paja-pointer-relay-fallback.md
  key_links:
    - browser-host passes getPajaRelayUrls(current simulation) into resolvePajaPointer
    - runtime resolver performs one ordered deduplicated relay query under one deadline
    - existing @kehto/nip/5d resolveNapplet remains the only artifact verification path
---

# Quick Task 260712-slw: Fix Paja naddr relay resolution end-to-end

## Task 1: Relay selection and diagnostics

**Files:** `packages/paja/src/runtime-resolver.ts`, `packages/paja/src/browser-host.ts`, focused tests.

**Action:** Merge pointer hints before effective configured live relays, reuse Paja relay URL selection so disabled mode returns no fallbacks, keep one overall deadline, and emit separate timeout/query-failure/no-match diagnostics without adding a relay abstraction or dependency.

**Verify:** Focused Paja resolver tests prove ordering, deduplication, disabled-mode wiring, deadline behavior, distinct failures, and successful configured-relay fallback.

**Done:** Runtime resolver reaches a matching configured live relay after a dead embedded hint while preserving fail-closed NIP-5D validation.

## Task 2: Live browser proof and documentation

**Files:** Paja browser/runtime tests, `docs/packages/paja.md`, `.changeset/paja-pointer-relay-fallback.md`, `.planning/debug/paja-naddr-resolution.md`.

**Action:** Document hint/fallback/deadline/error semantics, add patch changeset, preserve diagnosis, and exercise the supplied naddr through built resolver plus served Paja UI to verified `Good Morning Protocol` HTML.

**Verify:** Browser state reports resolved target title/content and `about:srcdoc`; resolver returns signed event, aggregate, and verified HTML. Record external relay caveat.

**Done:** Live evidence proves full verified artifact resolution, not event discovery alone.

## Task 3: Ship and prove

**Files:** All task-owned source, tests, docs, changeset, and GSD artifacts.

**Action:** Run every requested local gate, restore AI-slop to 100/100, commit atomically with Lore trailers, push, open PR with exact spec refs/evidence, and repair CI until green.

**Verify:** Local commands pass; PR head equals local HEAD; all required GitHub checks green.

**Done:** Open green PR contains complete implementation and proof.
