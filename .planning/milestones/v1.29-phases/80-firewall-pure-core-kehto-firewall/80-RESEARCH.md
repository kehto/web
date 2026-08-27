# Phase 80: Firewall Pure Core (`@kehto/firewall`) - Research

**Researched:** 2026-06-15
**Domain:** Pure TypeScript decision engine (token-bucket rate limiting, behavioral abuse detection), monorepo package authoring
**Confidence:** HIGH (the reference package `@kehto/acl` is in-repo and fully readable; all conventions verified by direct file read)

## Summary

This phase is almost entirely a **mirror-and-fill exercise**, not a research-heavy domain problem. The architecture is locked in CONTEXT.md (token-bucket / normalized `Observation` / first-match precedence), and the precise package skeleton, build config, export shape, JSDoc style, and test style to replicate already exist in `packages/acl/`. The highest-value research output is therefore *concrete excerpts and a copy-checklist* from `@kehto/acl`, plus the three small wiring touch-points that are easy to forget (`vitest.config.ts` aliases, `pnpm-workspace.yaml` glob coverage, turbo task graph), and the standard O(1) token-bucket refill math with its edge cases.

The package is greenfield and **installs no external dependencies** — it is pure TypeScript with zero runtime deps. The only "library" decisions are dev-tooling versions, all of which are pinned by the existing monorepo (`tsup ^8.5.0`, `typescript ^5.9.3`, `vitest ^4.1.2`). There is no npm-package-legitimacy risk surface in this phase.

**Primary recommendation:** Copy `packages/acl/` as the skeleton template (`package.json`, `tsconfig.json`, `tsup.config.ts`, file-split, JSDoc-on-every-export, co-located `*.test.ts` with `vitest`), implement the five source files described in CONTEXT.md, and add exactly three wiring edits: the `@kehto/firewall` alias to root `vitest.config.ts`, a changeset-eligible `package.json` (auto-covered by the `packages/*` workspace glob), and nothing in `turbo.json` (the generic `build`/`type-check`/`test:unit` tasks already match all `packages/*`). Use a single O(1) `lastRefill`-based token bucket with injected `now`; clamp tokens to capacity; lazily initialize `lastRefill` on first observation.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `evaluate(config, state, observation)` decision | Pure core (`@kehto/firewall`) | — | Deterministic, no I/O — the WASM-ready boundary [VERIFIED: CONTEXT.md decisions] |
| Token-bucket refill/spend | Pure core | — | Math over injected `now` + immutable state |
| Rule precedence resolution | Pure core | — | First-match-wins over config structures |
| Content matcher evaluation | Pure core | — | Pure predicate over `Observation` scalars |
| Config mutation + serialize/deserialize | Pure core | — | Mirror of acl `mutations.ts` immutable pattern |
| Counter persistence / ephemerality | **Phase 81** (`firewall-state.ts`) | — | Out of scope here — pure core only defines `FirewallState` shape + transition |
| Envelope → `Observation` normalization | **Phase 81** (`runtime.ts`) | — | Pure core never parses envelopes (CORE-02) |
| Focus context sourcing (`getFocusContext`) | **Phase 81** (shell/`@kehto/wm`) | — | `focused`/`msSinceFocusGain` are *inputs* to the pure core |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (none — zero runtime deps) | — | Pure TS module | CONTEXT locks "zero runtime deps, WASM-ready"; mirrors acl which imports nothing in its decision core [VERIFIED: grep of `packages/acl/src/*.ts` — only `resolve.ts` references `@napplet` and only in a comment] |

### Supporting (dev tooling — already pinned by monorepo, do NOT add new versions)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tsup` | `^8.5.0` | ESM build + `.d.ts` emission | Build script `tsup` [VERIFIED: packages/acl/package.json] |
| `typescript` | `^5.9.3` | strict + `verbatimModuleSyntax` | `type-check`: `tsc --noEmit` [VERIFIED: package.json] |
| `vitest` | `^4.1.2` | co-located unit tests | `test:unit`: `vitest run --config ../../vitest.config.ts` [VERIFIED: package.json] |
| `@napplet/core` | `^0.5.0` | peer dep convention | acl declares it as peer + dev; **firewall's pure core needs no import** — declaring it is optional convention, not a functional requirement [VERIFIED: grep] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Token bucket | Leaky bucket / sliding-window-log / fixed-window-counter | CONTEXT **locks token bucket** (RATE-02 mandates it + O(1) fixed state). Do not propose alternatives. Token bucket is the right choice anyway: O(1) state (`{tokens, lastRefill}`), allows controlled bursts, trivially refillable from injected `now`. |
| Declaring `@napplet/core` peer dep | Omit it entirely | acl keeps it for the `resolve.ts` NUB feature firewall lacks. Safe to omit; safe to keep for symmetry. **Recommend keeping** for mirror-fidelity and future-proofing, but the pure core must not `import` it. |

**Installation:** No `pnpm add` of runtime deps. Dev deps are inherited/declared mirroring acl. The package is created by scaffolding files, then `pnpm install` at repo root re-links the workspace.

**Version verification:** No external packages are installed by this phase, so registry verification is N/A. The dev-tool versions above are read directly from the in-repo `packages/acl/package.json` and root `package.json` (not from training data).

## Package Legitimacy Audit

> Not applicable — this phase installs **zero external packages**. The package is pure TypeScript with no runtime dependencies, and all dev tooling (`tsup`, `typescript`, `vitest`) is already present in the monorepo at pinned versions. No `npm install` / `pnpm add` of new packages occurs. slopcheck was therefore not run (nothing to check).

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────────┐
   (Phase 81 supplies)   │            @kehto/firewall (Phase 80)         │
                         │                  PURE CORE                    │
  Observation ──────────►│                                               │
  { napplet, opClass,    │   evaluate(config, state, observation)        │
    kind?, size?,        │        │                                      │
    initElapsedMs?,      │        ▼                                      │
    focused,             │   1. per-napplet POLICY (allow/deny/ask)? ────┼──► short-circuit
    msSinceFocusGain?,   │        │ no match                             │
    now }                │        ▼                                      │
                         │   2. CONTENT MATCHERS (first match) ──────────┼──► action
  FirewallConfig ───────►│        │ no match                             │
  (immutable)            │        ▼                                      │
                         │   3. INIT-BURST guard (initElapsedMs window) ─┼──► block (default)
  FirewallState ────────►│        │ within budget                        │
  (counter map)          │        ▼                                      │
                         │   4. RATE LIMIT token bucket                  │
                         │      key (napplet, opClass) → specific rule   │
                         │      else per-napplet global fallback (RATE-03)│
                         │      else defaults.ts (CORE-04)               │
                         │      × unfocusedMultiplier if !focused (FOCUS-2)│
                         │        │                                      │
                         │        ▼                                      │
                         │   { decision, action, ruleId, reason,         │
   (Phase 81 consumes) ◄─┼─────    newState }                           │
                         └─────────────────────────────────────────────┘
```

> **Note:** the exact ordering of precedence stages (matchers vs. burst vs. rate) within "step 2-4" is a planning decision — CONTEXT locks the *outer* precedence (policy → op-class rule → global fallback → defaults, POLICY-03) and lists burst/content/rate as the rule types. The planner should pick one deterministic order and pin it in tests. A defensible order: policy override → init-burst guard → content matchers → rate limit, because burst and explicit content rules are "harder" verdicts than a soft rate flag. [ASSUMED — see Assumptions A1]

### Recommended Project Structure (mirror `packages/acl/`)
```
packages/firewall/
├── package.json          # mirror acl: name @kehto/firewall, ESM, tsup, vitest
├── tsconfig.json         # extends ../../tsconfig.json, outDir dist, rootDir src
├── tsup.config.ts        # entry src/index.ts, format esm, dts, sourcemap, clean
├── README.md             # mirror acl README structure (alpha banner, install, overview)
├── src/
│   ├── types.ts          # Observation, FirewallConfig, RateLimit, BurstGuard,
│   │                     #   ContentMatcher, NappletPolicy, FirewallState,
│   │                     #   Decision/Action unions, constants
│   ├── evaluate.ts       # pure evaluate(config, state, observation)
│   ├── config.ts         # setPolicy/setRateLimit/addMatcher + serialize/deserialize
│   ├── defaults.ts       # built-in default rate/burst limits (CORE-04)
│   ├── index.ts          # barrel export
│   ├── evaluate.test.ts  # token-bucket refill, burst, matchers, focus, precedence
│   ├── config.test.ts    # mutation immutability + serialize round-trip
│   └── defaults.test.ts  # defaults applied out-of-the-box
└── (dist/ generated)
```

### Pattern 1: Immutable mutation returning new state (mirror acl `mutations.ts`)
**What:** Every config/state mutation spreads a new object; original never touched.
**When to use:** All of `setPolicy`, `setRateLimit`, `addMatcher`, and the `newState` returned by `evaluate`.
**Example (verified acl pattern to replicate):**
```ts
// Source: packages/acl/src/mutations.ts (grant)
export function grant(state: AclState, identity: Identity, cap: number): AclState {
  const key = toKey(identity);
  const entry = getEntry(state, key);
  return {
    ...state,
    entries: { ...state.entries, [key]: { ...entry, caps: entry.caps | cap } },
  };
}
```
Firewall analog: `addMatcher(config, matcher)` returns `{ ...config, matchers: [...config.matchers, matcher] }`; `evaluate` returns `{ ...state, buckets: { ...state.buckets, [key]: nextBucket } }`.

### Pattern 2: Token bucket with injected `now` (the only genuinely new math)
**What:** O(1) refill — store `{ tokens, lastRefill }`; on each observation, add `(now - lastRefill) * refillRatePerMs`, clamp to `capacity`, then attempt to spend 1.
**When to use:** RATE-01/02/03.
**Example (standard formula — verify behavior in tests):**
```ts
// refillRatePerMs = capacity / windowMs   (tokens regained per ms)
interface Bucket { tokens: number; lastRefill: number; }

function refill(bucket: Bucket, now: number, capacity: number, refillPerMs: number): Bucket {
  // First observation: lastRefill may be 0/undefined — start full at `now`.
  const last = bucket.lastRefill || now;
  const elapsed = Math.max(0, now - last);           // clamp negative clock skew to 0
  const tokens = Math.min(capacity, bucket.tokens + elapsed * refillPerMs);
  return { tokens, lastRefill: now };
}

function spend(bucket: Bucket): { ok: boolean; bucket: Bucket } {
  if (bucket.tokens >= 1) return { ok: true, bucket: { ...bucket, tokens: bucket.tokens - 1 } };
  return { ok: false, bucket };                        // exceeded — trigger exceed-action
}
```
[CITED: standard token-bucket refill — see Sources; the lazy `lastRefill || now` init and negative-skew clamp are the edge cases CONTEXT calls out]

**Edge cases to test (VERIFY-01):**
- First observation for a key: bucket absent → initialize full at `capacity`, `lastRefill = now` (do NOT charge refill from epoch 0).
- Fractional tokens: refill produces non-integers; spend requires `>= 1`. Keep fractional tokens in state (do not floor) so slow drips accumulate.
- Clamp to capacity: a long idle gap must not over-fill (`Math.min(capacity, …)`).
- Negative `now - lastRefill` (clock skew / out-of-order): clamp elapsed to `0`, never subtract tokens.
- Focus multiplier: when `!focused`, effective `capacity` (and/or refill) is scaled by `unfocusedMultiplier` (e.g. 0.25). Decide whether the multiplier scales capacity, refill rate, or both — and pin it (FOCUS-02). Recommend scaling **capacity** (tightens burst headroom) while keeping the bucket key stable. [ASSUMED — see A2]

### Pattern 3: Key derivation (mirror acl `toKey`)
```ts
// Source: packages/acl/src/check.ts
export function toKey(identity: Identity): string { return `${identity.dTag}:${identity.hash}`; }
```
Firewall analog: bucket key is `(napplet dTag, opClass)` → `${observation.napplet}:${observation.opClass}`. Note firewall keys on **dTag only** (version-agnostic, "any version"), NOT `dTag:hash` — this is a deliberate difference from acl per POLICY-01/CONTEXT. Document it in JSDoc.

### Pattern 4: Defensive deserialize (mirror acl)
```ts
// Source: packages/acl/src/mutations.ts (deserialize) — validates shape, falls back to default
export function deserialize(json: string): AclState {
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed === 'object' && parsed !== null && /* shape checks */ true) {
      /* rebuild validated entries */
    }
  } catch { /* fall through */ }
  return createState('permissive');
}
```
Firewall `deserialize(string) → FirewallConfig` must round-trip without loss (CORE-03) and fall back to `defaultConfig()` on invalid input.

### Anti-Patterns to Avoid
- **Reading a wall clock inside `evaluate`** (`Date.now()`): forbidden — `now` is an input (CORE-01/02). Determinism + WASM-readiness depend on this.
- **Mutating the passed-in `state`/`config`**: every return is a fresh object (acl pattern). Tests assert originals are unchanged (see acl `mutations.test.ts` "does not modify original state").
- **Parsing envelopes / handling strings-from-the-wire**: CORE-02 — the pure core sees only the normalized `Observation`. Envelope→Observation is Phase 81.
- **Flooring fractional tokens into state**: loses slow-refill accumulation; keep fractional, gate spend at `>= 1`.
- **Importing `@napplet/core` into the decision core**: breaks the zero-dep/WASM boundary. acl's core does not import it; neither should firewall's.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Immutable state updates | A deep-clone util / structural-sharing lib | Plain object spread (`{...state, ...}`) as acl does | Zero-dep constraint; objects are shallow and small; acl proves spread is sufficient |
| Serialization | A custom binary format / schema lib | `JSON.stringify` / `JSON.parse` with shape validation (acl `serialize`/`deserialize`) | CORE-03 only needs lossless round-trip; acl's defensive parse is the proven pattern |
| Rate limiting algorithm | A novel sliding-window scheme | Token bucket (locked) | RATE-02 mandates O(1) token bucket; reinventing it risks unbounded state |
| Test scaffolding | Custom harness | `vitest` co-located `*.test.ts` (already wired) | The monorepo's `vitest.config.ts` already globs `packages/*/src/**/*.test.ts` |

**Key insight:** This package's "complexity budget" should go entirely into *correct token-bucket edge cases and precedence ordering tests*, not into infrastructure — the infrastructure is a verbatim copy of acl.

## Runtime State Inventory

> Greenfield package creation — not a rename/refactor/migration. **No runtime state to migrate.** The only "state" defined is the in-memory `FirewallState` counter shape, which this phase defines but does NOT persist (persistence is Phase 81). Verified by grep: no existing `firewall` references anywhere in `packages/`, `apps/`, or `tests/`.

## Common Pitfalls

### Pitfall 1: Forgetting the `vitest.config.ts` alias
**What goes wrong:** New package's tests (and any cross-package import of `@kehto/firewall`) fail to resolve because root `vitest.config.ts` uses **hardcoded path aliases**, not auto-discovery.
**Why it happens:** `vitest.config.ts` maps each `@kehto/*` to `packages/*/src/index.ts` explicitly (verified: acl, runtime, services, shell, nip all hand-listed).
**How to avoid:** Add `'@kehto/firewall': resolve(__dirname, 'packages/firewall/src/index.ts')` to the `resolve.alias` block. (Phase 80's own tests use relative `./` imports so they pass regardless, but adding the alias now is the right convention and unblocks Phase 81.)
**Warning signs:** "Cannot find module '@kehto/firewall'" in a test that imports the package by name.

### Pitfall 2: Token bucket "starts empty" bug
**What goes wrong:** First observation for a `(napplet, opClass)` key is immediately rejected because the bucket initialized with `tokens: 0` and `lastRefill: 0`, so refill computes `(now - 0) * rate` → either huge (over-fills, then clamps fine) or zero (if rate logic differs) → false reject.
**Why it happens:** Treating absent bucket as `{tokens:0, lastRefill:0}` instead of "full at now".
**How to avoid:** On absent bucket, initialize `{ tokens: capacity, lastRefill: now }` *before* spending. Add an explicit "first op of a fresh napplet passes" test.
**Warning signs:** A brand-new napplet's very first op is flagged/blocked in tests.

### Pitfall 3: `verbatimModuleSyntax` + type-only imports
**What goes wrong:** `tsc --noEmit` fails with "X is a type and must be imported using a type-only import" because root tsconfig sets `verbatimModuleSyntax: true`.
**Why it happens:** Strict ESM verbatim mode forbids mixing value and type imports without `type` modifiers.
**How to avoid:** Use `import type { Observation, FirewallConfig } from './types.js'` for type-only imports, and `.js` extensions on relative imports (acl does this: `from './types.js'`). Verified pattern across all acl src files.
**Warning signs:** Build passes but `pnpm type-check` fails.

### Pitfall 4: Precedence order left implicit
**What goes wrong:** POLICY-03 (first-match-wins, most→least specific) is satisfied for the *outer* tiers, but the relative order of burst guard vs. content matcher vs. rate limit within a tier is undefined, producing nondeterministic-looking results.
**Why it happens:** CONTEXT lists the rule *types* but doesn't fully order burst/content/rate against each other.
**How to avoid:** Pick one order, encode it as a documented constant/comment in `evaluate.ts`, and write a precedence test that proves a more-specific rule wins over a less-specific one for the same observation.
**Warning signs:** A test where two rules could match and the "wrong" one fires.

## Code Examples

### Mirror: `package.json` for the new package
```jsonc
// Source: packages/acl/package.json — adapt name/keywords/description, drop ./capabilities export
{
  "name": "@kehto/firewall",
  "version": "0.1.0",
  "description": "Pure, WASM-ready behavioral firewall engine for the napplet protocol — zero dependencies, zero side effects",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } },
  "files": ["dist"],
  "sideEffects": false,
  "publishConfig": { "access": "public" },
  "dependencies": {},
  "peerDependencies": { "@napplet/core": "^0.5.0" },   // optional — see note; firewall core imports nothing
  "devDependencies": { "tsup": "^8.5.0", "typescript": "^5.9.3" },
  "scripts": {
    "build": "tsup",
    "type-check": "tsc --noEmit",
    "test:unit": "vitest run --config ../../vitest.config.ts"
  },
  "license": "MIT",
  "repository": { "type": "git", "url": "git+https://github.com/kehto/web.git", "directory": "packages/firewall" },
  "keywords": ["nostr", "napplet", "kehto", "firewall", "rate-limit"]
}
```

### Mirror: `tsconfig.json` and `tsup.config.ts` (copy verbatim, only entry differs)
```jsonc
// packages/firewall/tsconfig.json — identical to acl
{ "extends": "../../tsconfig.json", "compilerOptions": { "outDir": "dist", "rootDir": "src", "lib": ["ES2022"] }, "include": ["src"] }
```
```ts
// packages/firewall/tsup.config.ts — single entry (no /capabilities subpath)
import { defineConfig } from 'tsup';
export default defineConfig({ entry: ['src/index.ts'], format: ['esm'], dts: true, sourcemap: true, clean: true });
```

### Mirror: test style (vitest, co-located, injected determinism)
```ts
// Source style: packages/acl/src/mutations.test.ts
import { describe, it, expect } from 'vitest';
import { evaluate } from './evaluate.js';
import { defaultConfig, createState } from './config.js'; // or defaults.js
import type { Observation } from './types.js';

describe('evaluate — token bucket', () => {
  it('passes the first op for a fresh napplet', () => {
    const cfg = defaultConfig();
    const obs: Observation = { napplet: 'chat', opClass: 'relay:write', focused: true, now: 1000 };
    const { decision, newState } = evaluate(cfg, createState(), obs);
    expect(decision).toBe('pass');
    expect(newState).not.toBe(createState()); // original untouched, new state returned
  });

  it('refills after the window with injected now', () => {
    /* spend to empty at now=1000, then evaluate at now=1000+windowMs → pass again */
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed-window counters | Token bucket with `lastRefill` timestamp | Standard for years | O(1) state, burst-tolerant, refill from injected clock — matches RATE-02 exactly |
| Self-reported focus | Shell-sourced focus injected as `Observation` field | This design | Forge-proof (FOCUS-01, Phase 81); pure core just consumes `focused`/`msSinceFocusGain` |

**Deprecated/outdated:** Nothing in this domain is moving fast. The token-bucket algorithm is stable and decades-old; no version churn risk.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Recommended intra-tier order (policy → burst → content → rate). CONTEXT locks outer precedence but not burst-vs-content-vs-rate ordering. | Architecture / Pitfall 4 | Low — planner picks the order; any deterministic, documented order satisfies POLICY-03. Must be pinned in a test. |
| A2 | `unfocusedMultiplier` scales **capacity** (recommended) vs. refill rate vs. both. CONTEXT says it "tightens budget" without specifying which knob. | Pattern 2 / FOCUS-02 | Low-Med — observable behavior differs slightly; pick one, document in JSDoc, test it. "Focus alone never hard-blocks" must hold either way (multiplier > 0). |
| A3 | `@napplet/core` peer dep is optional for firewall (core imports nothing). Recommend keeping for mirror-symmetry. | Standard Stack | Very low — verified acl's decision core has no `@napplet` import. |
| A4 | Initial package version `0.1.0`. CONTEXT doesn't specify; changeset in Phase 82 will bump. | Code Examples | Very low — cosmetic; changeset flow owns versioning. |

## Open Questions

1. **Exact `FirewallConfig` shape for per-napplet × op-class rules.**
   - What we know: CONTEXT lists the tiers (policy / op-class rule / global fallback / defaults) and the rule types (RateLimit, BurstGuard, ContentMatcher).
   - What's unclear: whether per-napplet rules live in a nested `Record<dTag, { policy?, rules: Record<opClass, RateLimit>, globalRate?: RateLimit }>` or a flatter shape.
   - Recommendation: nested-by-dTag map mirrors acl's `entries: Record<key, Entry>` and serializes cleanly. Let the planner finalize; either is fine as long as serialize round-trips.

2. **`BurstGuard` data model: a separate config field or a special ContentMatcher?**
   - What we know: burst guard counts ops while `initElapsedMs < threshold`; defaults to `block`.
   - Recommendation: model it as a first-class `BurstGuard { windowMs, maxOps, action }` (clearer than overloading matchers), counted via a dedicated counter in `FirewallState`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | build/test | ✓ | v22.22.2 | — |
| pnpm | workspace | ✓ | 10.8.0 | — |
| vitest | unit tests | ✓ | 4.1.2 | — |
| turbo | task graph | ✓ | 2.9.14 | — |
| tsup | build | ✓ (via acl devDeps `^8.5.0`) | 8.5.x | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None. All tooling present and pinned.

## Monorepo Wiring Checklist (the easy-to-miss edits)

| Touch-point | Action | Verified detail |
|-------------|--------|-----------------|
| `pnpm-workspace.yaml` | **No edit needed** — `packages/*` glob already covers `packages/firewall` | [VERIFIED: pnpm-workspace.yaml line 3] |
| `turbo.json` | **No edit needed** — generic `build`, `type-check`, `test:unit` tasks match any package with those scripts | [VERIFIED: turbo.json] |
| Root `vitest.config.ts` | **ADD** `'@kehto/firewall': resolve(__dirname, 'packages/firewall/src/index.ts')` to `resolve.alias` | [VERIFIED: aliases are hand-listed, not auto-discovered] |
| Root `package.json` scripts | **No edit needed** — `test:unit` = `vitest run` (root config globs `packages/*/src/**/*.test.ts`); `build`/`type-check` = `turbo run …` | [VERIFIED: root package.json + vitest.config.ts include globs] |
| `.changeset/` | **No edit in Phase 80** — package is changeset-eligible automatically (workspace member, `publishConfig.access: public`); the changeset is added in Phase 82 per CONTEXT | [VERIFIED: .changeset/config.json, CONTEXT deferred] |
| `pnpm install` (root) | **RUN** after scaffolding to link the new workspace package | standard pnpm workspace behavior |

> Each package's `tsconfig.json` `extends ../../tsconfig.json`; the root tsconfig has **no `references` array** (not a TS project-references monorepo), so no root tsconfig edit is needed. [VERIFIED: root tsconfig.json has no `references`]

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **ESM-only** (no CJS output) — `tsup` format `['esm']` only. [CLAUDE.md]
- **Zero framework dependencies** (no Svelte/React/etc.) — and here zero runtime deps at all. [CLAUDE.md]
- **JSDoc on every public export** with `@param`, `@returns`, `@example`. [CLAUDE.md — verified acl follows this on every export]
- **2-space indentation.** [CLAUDE.md]
- **TS strict + `verbatimModuleSyntax`** → use `import type` and `.js` extensions on relative imports. [CLAUDE.md + root tsconfig]
- **File naming:** lowercase with hyphens (`acl-store.ts`, `storage-proxy.ts`). The CONTEXT-specified filenames (`types.ts`, `evaluate.ts`, `config.ts`, `defaults.ts`, `index.ts`) all comply. [CLAUDE.md]
- **PascalCase** for interfaces/types, **camelCase** for functions/vars, **UPPER_SNAKE_CASE** for constants. [CLAUDE.md — verified acl: `CAP_*`, `DEFAULT_QUOTA`]
- **GSD workflow enforcement:** edits must flow through a GSD command (this is research-only; implementation happens in `/gsd:execute-phase`). [kehto/CLAUDE.md]

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.2 |
| Config file | root `vitest.config.ts` (shared; package uses `--config ../../vitest.config.ts` for its own `test:unit`) |
| Quick run command | `pnpm --filter @kehto/firewall test:unit` (or `npx vitest run packages/firewall`) |
| Full suite command | `pnpm test:unit` (root — runs `vitest run` across all `packages/*/src/**/*.test.ts`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CORE-01 | `evaluate` returns `{decision, action, ruleId, reason, newState}`, no mutation/I/O | unit | `npx vitest run packages/firewall/src/evaluate.test.ts -t "evaluate"` | ❌ Wave 0 |
| CORE-02 | Operates only on `Observation` fields; never parses envelopes (assert by signature + no envelope import) | unit | same file | ❌ Wave 0 |
| CORE-03 | `setPolicy`/`setRateLimit`/`addMatcher` return new config; serialize↔deserialize round-trips lossless | unit | `npx vitest run packages/firewall/src/config.test.ts` | ❌ Wave 0 |
| CORE-04 | Defaults apply to unknown napplet; default exceed-action `flag` | unit | `npx vitest run packages/firewall/src/defaults.test.ts` | ❌ Wave 0 |
| RATE-01 | Exceeding budget triggers configured exceed-action (`flag`/`block`/`ignore`) | unit | evaluate.test.ts | ❌ Wave 0 |
| RATE-02 | Token bucket keyed `(dTag, opClass)`, O(1), refill from injected `now` | unit | evaluate.test.ts (refill-after-window with two `now` values) | ❌ Wave 0 |
| RATE-03 | Per-napplet global budget used as fallback for op-classes lacking a specific rule | unit | evaluate.test.ts | ❌ Wave 0 |
| BURST-01 | >N ops within init window caught by burst guard | unit | evaluate.test.ts (vary `initElapsedMs`) | ❌ Wave 0 |
| BURST-02 | Burst guard defaults to `block` | unit | defaults.test.ts / evaluate.test.ts | ❌ Wave 0 |
| CONTENT-01 | Matcher on opClass / kind(s) / size with own action | unit | evaluate.test.ts | ❌ Wave 0 |
| CONTENT-02 | Matcher conditions on `focused` / `maxMsSinceFocusGain` | unit | evaluate.test.ts | ❌ Wave 0 |
| CONTENT-03 | kind-5 delete-spam matcher detectable + actionable | unit | evaluate.test.ts (`kind: 5` observation) | ❌ Wave 0 |
| POLICY-03 | First-match-wins, most→least specific precedence | unit | evaluate.test.ts (overlapping rules → most specific wins) | ❌ Wave 0 |
| FOCUS-02 | `unfocusedMultiplier` tightens budget; focus never hard-blocks | unit | evaluate.test.ts (same op focused vs. unfocused) | ❌ Wave 0 |
| VERIFY-01 | Aggregate: refill, burst, matcher (incl. focus), precedence, serialize round-trip with injected `now` | unit | full `packages/firewall` suite green | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @kehto/firewall test:unit`
- **Per wave merge:** `pnpm test:unit` (root — proves the new package didn't break the 563+ existing unit tests)
- **Phase gate:** Full root unit suite green + `pnpm type-check` green before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `packages/firewall/src/evaluate.test.ts` — covers CORE-01/02, RATE-01/02/03, BURST-01/02, CONTENT-01/02/03, POLICY-03, FOCUS-02
- [ ] `packages/firewall/src/config.test.ts` — covers CORE-03 (mutation immutability + serialize round-trip)
- [ ] `packages/firewall/src/defaults.test.ts` — covers CORE-04, BURST-02 default
- [ ] Framework install: none needed — vitest already present; only the root `vitest.config.ts` alias addition is required for name-based imports.

## Security Domain

> `security_enforcement` not explicitly set in config — treating as enabled. This phase is a **pure, side-effect-free decision engine with no I/O, no network, no untrusted parsing** (envelope parsing is Phase 81). Its security relevance is that it *is* an anti-abuse control, so correctness = security.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Firewall does not authenticate (ACL/AUTH do) |
| V3 Session Management | no | Stateless pure function |
| V4 Access Control | partial | Behavioral rate/abuse limiting composes with ACL static authz; the firewall is itself an access-control enrichment |
| V5 Input Validation | yes | `deserialize` must defensively validate config shape and fall back to defaults (mirror acl `deserialize`); `evaluate` must tolerate missing optional `Observation` fields and out-of-order `now` |
| V6 Cryptography | no | No crypto in this package |

### Known Threat Patterns for the pure-core firewall
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/poisoned persisted config | Tampering | Defensive `deserialize` → fall back to `defaultConfig()` (acl pattern) |
| Counter-state forgery via huge/negative `now` | Tampering / DoS | Clamp `elapsed = max(0, now-lastRefill)`; clamp tokens to `[0, capacity]`; never read wall clock |
| Self-reported focus to evade tightening | Spoofing | Out of scope here — focus is shell-sourced in Phase 81 (FOCUS-01); pure core treats `focused` as a trusted input |
| Init-burst flood (rapid ops at startup) | DoS | Burst guard defaults to `block` (BURST-02) — this *is* the mitigation being built |
| Delete-spam (kind 5 flooding) | DoS | Content matcher on `kind: 5` (CONTENT-03) — built here |

## Sources

### Primary (HIGH confidence — in-repo, directly read)
- `packages/acl/package.json`, `tsconfig.json`, `tsup.config.ts` — package skeleton + build config to mirror
- `packages/acl/src/{types,check,mutations,migrate,index}.ts` — immutable pattern, `toKey`, serialize/deserialize, barrel, JSDoc style
- `packages/acl/src/{check,mutations}.test.ts` — vitest co-located test style (immutability + round-trip assertions)
- `packages/acl/README.md`, `CHANGELOG.md` — README structure + changeset-driven changelog
- Root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json`, `vitest.config.ts`, `.changeset/config.json` — monorepo wiring (verified: vitest aliases hand-listed; turbo/workspace auto-cover `packages/*`; no TS project references)
- `.planning/phases/80-…/80-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — locked design + 15 requirement IDs
- `packages/runtime/package.json` — peer-dep convention cross-check
- Tool versions: `node v22.22.2`, `pnpm 10.8.0`, `vitest 4.1.2`, `turbo 2.9.14` (verified via CLI)

### Secondary (MEDIUM confidence)
- Standard token-bucket refill algorithm (`tokens += elapsed * rate`, clamp to capacity, lazy `lastRefill` init) — well-established, cross-checked against the RATE-02 requirement wording. No external library needed.

### Tertiary (LOW confidence)
- None — all claims are either verified in-repo or standard textbook algorithm.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero external deps; all tooling read from in-repo files, not training data.
- Architecture: HIGH — locked in CONTEXT; precedence/multiplier knobs flagged as planner decisions (A1/A2), not unknowns.
- Pitfalls: HIGH — the four pitfalls (vitest alias, empty-bucket init, `verbatimModuleSyntax`, implicit precedence) are concrete and verified against in-repo config.
- Monorepo wiring: HIGH — each touch-point verified against the actual config files.

**Research date:** 2026-06-15
**Valid until:** ~2026-07-15 (stable — pure algorithm + in-repo conventions; no fast-moving external deps). Re-check only if `@kehto/acl` conventions or root `vitest.config.ts` alias strategy change.
