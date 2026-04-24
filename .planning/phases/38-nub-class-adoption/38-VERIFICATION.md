---
phase: 38-nub-class-adoption
verified: 2026-04-24T14:30:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 38: NUB-CLASS Adoption Verification Report

**Phase Goal:** Shell resolves class posture synchronously at iframe creation and enforces it uniformly across all NUB domains via a centralized `enforce.ts` gate — so a class-restricted napplet cannot invoke capabilities outside its posture regardless of which NUB domain it uses.

**Verified:** 2026-04-24T14:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A class-restricted napplet attempting a NUB request outside its class posture is rejected at the `enforce.ts` gate regardless of which NUB domain issued the request | VERIFIED | `class-invariant.spec.ts` has 8 parameterized tests across identity, ifc, keys, media, notify, relay, storage, theme; all passed at 62/0/0 E2E close |
| 2 | `shell.init` carries the resolved class inline (no async `class.assigned` envelope); session entry written before `shell.init` sent | VERIFIED | `shell-bridge.ts:224` reads `sessionEntry?.class ?? null` and stamps it on `initMsg` before `postMessage`; grep of `class.assigned` in executable code returns 0 hits |
| 3 | `CLASS_BY_DTAG` data-driven map exists adjacent to `DEMO_NAPPLETS`; module-load assertion throws on missing entry | VERIFIED | `shell-host.ts:235-261` has `CLASS_BY_DTAG` with all 10 entries and a block-scoped `throw new Error('[CLASS-04 / H-05]...')` guard |
| 4 | `docs/policies/SHELL-CLASS-POLICY.md` is present with kehto file:line cross-references | VERIFIED | File exists; comment header lists 10 file:line cross-refs into enforce.ts, shell-bridge.ts, types.ts, shell-host.ts, main.ts; upstream SHA recorded |
| 5 | Class enforcement is centralized in `enforce.ts` only; the gate is not scattered across individual NUB handler files | VERIFIED | `class-forbidden` string appears in 4 places in `enforce.ts` and in 1 type declaration line in `types.ts`; grep across `state-handler.ts`, `service-dispatch.ts`, `runtime.ts` handler bodies returns empty |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/runtime/src/enforce.ts` | CLASS_CAPABILITY_ALLOWLIST + class pre-filter + EnforceResult.reason | VERIFIED | `CLASS_CAPABILITY_ALLOWLIST` with `class-1` (all 15 caps) and `class-2` (all minus `relay:write`); `nappletClass !== null` guard runs before capability check; `reason` on all 3 return paths |
| `packages/runtime/src/runtime.ts` | `resolveIdentityByWindowId` returns `class: entry.class` | VERIFIED | `grep -c "class: entry.class" packages/runtime/src/runtime.ts` → 1 at enforceNub wiring |
| `packages/runtime/src/types.ts` | `NappletClass` inline alias + `SessionEntry.class` + `AclCheckEvent.reason?` | VERIFIED | `export type NappletClass` at 1 occurrence; `class: NappletClass` on `SessionEntry`; `reason?: 'allowed' | 'capability-missing' | 'class-forbidden'` on `AclCheckEvent` |
| `packages/shell/src/types.ts` | `onNip5dIframeCreate` return includes `class: NappletClass` | VERIFIED | 2 occurrences of `class: NappletClass` (onNip5dIframeCreate return + SessionEntry re-declaration) |
| `packages/shell/src/shell-bridge.ts` | `shell.init` envelope carries `class: resolvedClass` | VERIFIED | `grep -c "class: resolvedClass"` → 1; reads session entry synchronously, posts before any NUB request |
| `apps/demo/src/shell-host.ts` | `CLASS_BY_DTAG` map + module-load assertion + `registerSessionEntry` reads from map | VERIFIED | All 10 DEMO_NAPPLETS mapped to null; assertion block present; `CLASS_BY_DTAG.get(name) ?? null` at `registerSessionEntry` |
| `apps/demo/src/main.ts` | `window.__setNappletClass__` test hook (D9 locked) | VERIFIED | 8 occurrences in `main.ts`; 0 definition occurrences in `shell-host.ts` (D9 guard confirmed) |
| `docs/policies/SHELL-CLASS-POLICY.md` | Policy doc with upstream SHA + kehto file:line cross-refs | VERIFIED | SHA `27e16248` recorded; 2 occurrences of `packages/runtime/src/enforce.ts` in cross-ref table |
| `tests/e2e/class-invariant.spec.ts` | 8 parameterized tests covering 8 NUB domains | VERIFIED | `ACTIVE_NUB_DOMAINS` array declares all 8; `class-forbidden` appears 8 times; `for (const domain of ACTIVE_NUB_DOMAINS)` loop confirmed |
| `.changeset/class-01-breaking-hook.md` | Minor bump changeset for `@kehto/shell` | VERIFIED (38-01-SUMMARY) | Confirmed exists; `@kehto/shell: minor` documented |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `shell-bridge.ts` shell.init emission | `SessionEntry.class` | `runtime.sessionRegistry.getEntryByWindowId(windowId)?.class` | WIRED | Line 223-224 confirmed |
| `runtime.ts` enforceNub wiring | `SessionEntry.class` | `class: entry.class` in `resolveIdentityByWindowId` callback | WIRED | `grep -c "class: entry.class"` → 1 |
| `enforce.ts` enforceNub body | `CLASS_CAPABILITY_ALLOWLIST` | `CLASS_CAPABILITY_ALLOWLIST[nappletClass]` then `.has(capability)` | WIRED | `grep -c "CLASS_CAPABILITY_ALLOWLIST"` → 2 in enforce.ts |
| `shell-host.ts` registerSessionEntry | `CLASS_BY_DTAG` | `CLASS_BY_DTAG.get(name) ?? null` | WIRED | `grep -c "CLASS_BY_DTAG.get(name)"` → 1 |
| `shell-host.ts` module-load assertion | `DEMO_NAPPLETS` + `CLASS_BY_DTAG` | block-scoped throw at import time | WIRED | `throw new Error('[CLASS-04 / H-05]...')` confirmed |
| `main.ts` `__setNappletClass__` | `relay.runtime.sessionRegistry` | in-place mutation of `SessionEntry.class` | WIRED | Definition in `main.ts` (D9 honored); 8 occurrences confirmed |
| `class-invariant.spec.ts` | `enforce.ts` class gate | `__setNappletClass__` + `__injectNubEnvelopeAsNapplet__` + `__aclEvents__` observability | WIRED | E2E passed 62/0/0 |

---

### Key Invariant Checks (explicit per brief)

| Invariant | Check | Result |
|-----------|-------|--------|
| Class enforcement centralized in `enforce.ts` ONLY | `grep -rn "class-forbidden" packages/runtime/src/ --include="*.ts" \| grep -v enforce.ts\|types.ts` | Empty — no leakage into handlers |
| No async `class.assigned` envelope in executable code | `grep -rn "class.assigned" packages/ apps/ tests/` filtered to non-comment lines | 3 hits, all doc-comments (shell-bridge.ts, provisional-class.ts, main.ts comment) — no envelope implementation |
| `class-invariant.spec.ts` 8 parameterized tests covering all 8 domains | grep counts + ACTIVE_NUB_DOMAINS array | identity, ifc, keys, media, notify, relay, storage, theme confirmed; `class-forbidden` × 8 |
| `shell.init` emission site includes `class` field inline | `grep -c "class: resolvedClass" packages/shell/src/shell-bridge.ts` | 1 — confirmed |
| `__setNappletClass__` in `main.ts` NOT `shell-host.ts` | `grep -cE "__setNappletClass__[[:space:]]*=" apps/demo/src/shell-host.ts` | 0 — D9 honored |
| `CLASS_BY_DTAG` module-load assertion throws on missing entry | Source reading of `shell-host.ts:252-261` | Block-scoped assertion with `[CLASS-04 / H-05]` error tag confirmed |
| 62/0/0 E2E recorded in ITERATION-LOG.md | ITERATION-LOG Plan 38-03 section | "62 passed (20.6s)" confirmed |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `class-invariant.spec.ts` assertions | `__aclEvents__` array | `onAclCheck` callback in `shell-host.ts` → `window.__aclEvents__` push | Yes — events populated by enforceNub on real NUB envelope dispatch via `__injectNubEnvelopeAsNapplet__` | FLOWING |
| `shell-bridge.ts` shell.init `class` field | `resolvedClass` | `runtime.sessionRegistry.getEntryByWindowId(windowId)?.class` | Yes — read from real session entry stamped at iframe creation | FLOWING |
| `enforce.ts` class pre-filter | `nappletClass` | `entry?.class ?? null` from `resolveIdentityByWindowId` callback in `runtime.ts` | Yes — sourced from `SessionEntry.class` set during `registerSessionEntry` | FLOWING |
| `shell-host.ts` registerSessionEntry | `class` field | `CLASS_BY_DTAG.get(name) ?? null` | Yes — map lookup at registration time; test hook mutates in-place for spec runs | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — E2E tests serve as the behavioral verification layer. The canonical iteration loop (rm -rf + pnpm install + pnpm build + pnpm test:e2e) recorded 62 passed / 0 failed / 0 skipped; individual spot-check commands cannot be run without a live dev server.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CLASS-01 | 38-01 | Breaking `onNip5dIframeCreate` hook expansion with `class: NappletClass` | SATISFIED | `grep -c "class: NappletClass" packages/shell/src/types.ts` → 2 |
| CLASS-02 | 38-01 | Synchronous class on `SessionEntry` + inline in `shell.init` (no async envelope) | SATISFIED | `shell-bridge.ts:224` confirmed; `class.assigned` in executable code → 0 |
| CLASS-03 | 38-02 | Centralized class pre-filter in `enforce.ts` only | SATISFIED | `class-forbidden` in 4 places in enforce.ts; zero in handler files |
| CLASS-04 | 38-03 | `CLASS_BY_DTAG` data-driven map + module-load assertion | SATISFIED | Map with 10 entries; block-scoped assertion confirmed |
| CLASS-05 | 38-03 | `docs/policies/SHELL-CLASS-POLICY.md` with kehto cross-references | SATISFIED | File present; 10 cross-refs; upstream SHA documented |
| CLASS-06 | 38-01 | Provisional `NappletClass` type in `provisional-class.ts`; re-exported from shell barrel | SATISFIED | `export type { NappletClass }` in `packages/shell/src/index.ts` → 1 |
| E2E-20 | 38-03 | `class-invariant.spec.ts` 8-domain cross-NUB invariant spec (Phase 38 portion) | SATISFIED (partial, per plan) | 8 tests passed in 62/0/0; Phase 40 extends to 10/10 |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

Anti-pattern scan across all phase-modified files returned clean results. No TODO/FIXME/placeholder comments, no empty handlers, no stub return values in paths relevant to class enforcement. The three `class.assigned` comment occurrences are doc-comments explicitly documenting the C-01 anti-feature that was prevented — not implementation stubs.

---

### Human Verification Required

None. All success criteria are verifiable programmatically via grep and the recorded E2E iteration loop result. The 62/0/0 canonical run (clean install + build + test:e2e) is the behavioral proof; no UI walkthrough is required for this phase's goals.

---

### Gaps Summary

No gaps. All 5 observable truths are verified, all 10 required artifacts are present and substantive, all 7 key links are wired, data flows through the full stack from session entry creation to enforce.ts gate to E2E observable output. The 62/0/0 E2E result closes the loop.

---

_Verified: 2026-04-24T14:30:00Z_
_Verifier: Claude (gsd-verifier)_
