# Phase 80: Firewall Pure Core (`@kehto/firewall`) - Pattern Map

**Mapped:** 2026-06-15
**Files analyzed:** 11 (9 created in `packages/firewall/`, 1 modified wiring file, 2 wiring files verified no-edit)
**Analogs found:** 9 / 9 (every new file has an in-repo `@kehto/acl` analog — exact mirror exercise)

This phase is a near-verbatim structural mirror of `packages/acl/`. Every new file copies a concrete `packages/acl/` analog. The executor's job is: copy the skeleton, swap `Acl*`→`Firewall*` naming and capability-bitfield logic for token-bucket/observation logic, keep every convention (JSDoc-on-every-export, `import type`, `.js` extensions, 2-space indent, immutable spread returns).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/firewall/package.json` | config | — | `packages/acl/package.json` | exact (drop `./capabilities` export + `@napplet/nub`) |
| `packages/firewall/tsconfig.json` | config | — | `packages/acl/tsconfig.json` | exact (verbatim copy) |
| `packages/firewall/tsup.config.ts` | config | — | `packages/acl/tsup.config.ts` | exact (single entry only) |
| `packages/firewall/README.md` | doc | — | `packages/acl/README.md` | role-match (adapt copy) |
| `packages/firewall/src/types.ts` | model | — | `packages/acl/src/types.ts` | role-match (immutable types + UPPER_SNAKE constants) |
| `packages/firewall/src/evaluate.ts` | service | transform / request-response | `packages/acl/src/check.ts` | role-match (pure decision fn + `toKey`) |
| `packages/firewall/src/config.ts` | service | CRUD / transform | `packages/acl/src/mutations.ts` (+ `migrate.ts` for defensive deserialize) | role-match (immutable mutations + serialize/deserialize) |
| `packages/firewall/src/defaults.ts` | config | — | `packages/acl/src/capabilities.ts` | role-match (constants/defaults module) |
| `packages/firewall/src/index.ts` | barrel | — | `packages/acl/src/index.ts` | exact (barrel re-export shape) |
| `packages/firewall/src/evaluate.test.ts` | test | — | `packages/acl/src/check.test.ts` | role-match (vitest co-located) |
| `packages/firewall/src/config.test.ts` | test | — | `packages/acl/src/mutations.test.ts` | role-match (immutability + round-trip) |
| `packages/firewall/src/defaults.test.ts` | test | — | `packages/acl/src/mutations.test.ts` (serialize/deserialize describe block) | partial |
| `vitest.config.ts` (MODIFIED) | config | — | existing `@kehto/*` alias block | exact (add one alias line) |

---

## Pattern Assignments

### `packages/firewall/package.json` (config)

**Analog:** `packages/acl/package.json` (lines 1-55)

Copy verbatim and change: `name`→`@kehto/firewall`, `version`→`0.1.0` (acl is `0.8.0`; firewall is new, changeset in Phase 82 owns bumps), `description`, `repository.directory`→`packages/firewall`, `keywords`. **Drop** the `./capabilities` subpath export (firewall has no second entry) and **drop** `@napplet/nub` (acl-only, for `resolve.ts`). Keep `@napplet/core` peer/dev for mirror-symmetry — but the firewall core must NOT `import` it (zero-dep / WASM boundary).

**Shape to replicate** (acl lines 1-54, with the two firewall deltas applied):
```jsonc
{
  "name": "@kehto/firewall",
  "version": "0.1.0",
  "description": "Pure, WASM-ready behavioral firewall engine for the napplet protocol — zero dependencies, zero side effects",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "files": ["dist"],
  "sideEffects": false,
  "publishConfig": { "access": "public" },
  "dependencies": {},
  "peerDependencies": { "@napplet/core": "^0.5.0" },
  "devDependencies": { "@napplet/core": "^0.5.0", "tsup": "^8.5.0", "typescript": "^5.9.3" },
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
> `@napplet/core` peer dep is optional (research A3) — keep it for symmetry, but never `import` it in src. `vitest` is NOT a devDep of acl (it is inherited from root); do not add it.

### `packages/firewall/tsconfig.json` (config)

**Analog:** `packages/acl/tsconfig.json` (lines 1-9) — copy VERBATIM, no changes:
```jsonc
{
  "extends": "../../tsconfig.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src", "lib": ["ES2022"] },
  "include": ["src"]
}
```
> Root tsconfig has no `references` array (not a project-references monorepo) → no root tsconfig edit needed.

### `packages/firewall/tsup.config.ts` (config)

**Analog:** `packages/acl/tsup.config.ts` (lines 1-9). Copy, but acl has TWO entries (`index.ts`, `capabilities.ts`); firewall has ONE:
```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
});
```

### `packages/firewall/src/types.ts` (model)

**Analog:** `packages/acl/src/types.ts` (lines 1-82)

Copy the conventions, NOT the content: file-header JSDoc block (lines 1-6), `Readonly<>` on every interface field, `readonly` on every member, UPPER_SNAKE_CASE constants with inline JSDoc (acl lines 8-33: `export const CAP_RELAY_READ = 1 << 0;`), `DEFAULT_QUOTA = 512 * 1024` style for numeric defaults (line 81), JSDoc `@param` per interface field (acl lines 53-64).

**Immutable-state-container pattern to mirror** (acl `AclState`, lines 66-78) → firewall `FirewallConfig` and `FirewallState`:
```ts
export interface AclState {
  readonly defaultPolicy: 'permissive' | 'restrictive';
  readonly entries: Readonly<Record<string, AclEntry>>;
}
```
Firewall types to define here (per CONTEXT lines 27-32, 36-47, 75-84): `Observation`, `FirewallConfig`, `RateLimit`, `BurstGuard`, `ContentMatcher`, `NappletPolicy` (`'allow' | 'deny' | 'ask'`), `FirewallState` (counter map: `Readonly<Record<string, Bucket>>` mirroring `entries`), `Decision` (`'pass' | 'reject' | 'prompt'`), `Action` (`'flag' | 'block' | 'ignore'`). Use literal-union types exactly as acl uses `'permissive' | 'restrictive'`.

> `Observation` definition is locked in CONTEXT lines 36-47 — copy that interface signature verbatim into `types.ts` with per-field JSDoc.

### `packages/firewall/src/evaluate.ts` (service, pure decision function)

**Analog:** `packages/acl/src/check.ts` (lines 1-67)

**Imports pattern** (acl check.ts line 8) — type-only `import type`, `.js` extension (mandatory under `verbatimModuleSyntax`):
```ts
import type { AclState, Identity } from './types.js';
```

**`toKey` pattern** (acl check.ts lines 24-26) — pure key derivation, replicate for the bucket key:
```ts
export function toKey(identity: Identity): string {
  return `${identity.dTag}:${identity.hash}`;
}
```
Firewall analog: `${observation.napplet}:${observation.opClass}` — **dTag only, NOT `dTag:hash`** (version-agnostic, deliberate divergence per CONTEXT line 41 / research Pattern 3). Document the divergence in JSDoc.

**Pure decision-function pattern** (acl check.ts lines 28-67) — note the numbered decision-logic JSDoc (lines 31-37) and the early-return cascade (no-entry → blocked → bitfield check). Mirror this exactly for `evaluate`, with the cascade being the precedence tiers:
```ts
export function check(state: AclState, identity: Identity, cap: number): boolean {
  const key = toKey(identity);
  const entry = state.entries[key];
  if (!entry) {
    return state.defaultPolicy === 'permissive';
  }
  if (entry.blocked) {
    return false;
  }
  return (entry.caps & cap) !== 0;
}
```
Firewall `evaluate(config, state, observation)` returns `{ decision, action, ruleId, reason, newState }` (CONTEXT line 51). Precedence cascade (CONTEXT lines 59-62; research A1 recommends order: policy → init-burst → content matchers → rate limit). `newState` returned via spread (see config.ts immutable pattern below); original `state` never mutated. Token-bucket refill math is the one new piece — see research Pattern 2 (lazy `lastRefill || now` init, `Math.max(0, now-last)` skew clamp, `Math.min(capacity, …)` cap clamp, keep fractional tokens, gate spend at `>= 1`). `now` is an INPUT — never call `Date.now()`.

### `packages/firewall/src/config.ts` (service, immutable mutations + serialize/deserialize)

**Analog:** `packages/acl/src/mutations.ts` (lines 1-270), plus `migrate.ts` idempotent-return idiom.

**`createState` factory pattern** (acl mutations.ts lines 25-27):
```ts
export function createState(policy: 'permissive' | 'restrictive' = 'permissive'): AclState {
  return { defaultPolicy: policy, entries: {} };
}
```
Firewall analog: `defaultConfig()` returns the built-in config (pulls from `defaults.ts`), and `createState()` returns `{ buckets: {} }` (empty counter state).

**Immutable mutation pattern** (acl mutations.ts `grant`, lines 61-71) — every mutation spreads a new object; original untouched:
```ts
export function grant(state: AclState, identity: Identity, cap: number): AclState {
  const key = toKey(identity);
  const entry = getEntry(state, key);
  return {
    ...state,
    entries: { ...state.entries, [key]: { ...entry, caps: entry.caps | cap } },
  };
}
```
Firewall analogs (CONTEXT line 29): `setPolicy(config, napplet, policy)`, `setRateLimit(config, napplet, opClass, limit)`, `addMatcher(config, matcher)` → `{ ...config, matchers: [...config.matchers, matcher] }`. `evaluate`'s `newState` uses the same spread: `{ ...state, buckets: { ...state.buckets, [key]: nextBucket } }`. Use a private `getEntry`-style helper (acl lines 33-42) for default-on-absent lookups — NOT exported.

**Serialize pattern** (acl mutations.ts lines 220-222) — plain `JSON.stringify`:
```ts
export function serialize(state: AclState): string {
  return JSON.stringify(state);
}
```

**Defensive deserialize pattern** (acl mutations.ts lines 239-270) — THE critical one to replicate (V5 input validation): try/parse, shape-validate every field, rebuild validated entries, fall back to a fresh default on any failure:
```ts
export function deserialize(json: string): AclState {
  try {
    const parsed = JSON.parse(json);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed.defaultPolicy === 'permissive' || parsed.defaultPolicy === 'restrictive') &&
      typeof parsed.entries === 'object' &&
      parsed.entries !== null
    ) {
      const entries: Record<string, AclEntry> = {};
      for (const [key, value] of Object.entries(parsed.entries)) {
        const entry = value as Record<string, unknown>;
        if (
          typeof entry.caps === 'number' &&
          typeof entry.blocked === 'boolean' &&
          typeof entry.quota === 'number'
        ) {
          entries[key] = { caps: entry.caps, blocked: entry.blocked, quota: entry.quota };
        }
      }
      return { defaultPolicy: parsed.defaultPolicy, entries };
    }
  } catch {
    // Invalid JSON — fall through to default
  }
  return createState('permissive');
}
```
Firewall `deserialize(string) → FirewallConfig` must round-trip lossless (CORE-03) and fall back to `defaultConfig()` (NOT `createState`) on invalid input — config and counter-state are distinct here, unlike acl which has one `AclState`.

> **Idempotent-return idiom** (from `migrate.ts` line 76: `if (!migrated) return state;` returning the same reference): useful if any firewall mutation is a no-op, mirror it.

### `packages/firewall/src/defaults.ts` (config, constants/defaults module)

**Analog:** `packages/acl/src/capabilities.ts` (lines 1-67)

Mirror the structure: a leading JSDoc block, a single source-of-truth `as const` array/object, derived union types, then individually-exported named constants each with a one-line JSDoc. acl pattern (lines 11-39):
```ts
export const ALL_CAPABILITIES = [
  'relay:read', 'relay:write',
  // ...
] as const;

/** Union of every capability string in ALL_CAPABILITIES. */
export type Capability = typeof ALL_CAPABILITIES[number];

/** identity.getProfile/... */
export const CAP_IDENTITY_READ = 'identity:read' as const;
```
Firewall `defaults.ts` exports (CONTEXT lines 91-94, BURST-02): conservative built-in `RateLimit`/`BurstGuard` defaults, `DEFAULT_EXCEED_ACTION = 'flag'` (allow+audit), `DEFAULT_BURST_ACTION = 'block'` (the exception), `DEFAULT_UNFOCUSED_MULTIPLIER` (e.g. `0.25`, FOCUS-02), and a `defaultConfig()` assembling them. Use UPPER_SNAKE_CASE for the scalar constants (acl convention, verified `CAP_*` / `DEFAULT_QUOTA`).
> Align opClass example strings with ACL capability strings where they overlap (`relay:write`, `outbox:publish`/`outbox:write`, `intent:invoke`) per CONTEXT line 129 — see `packages/acl/src/capabilities.ts` for the canonical list, but treat opClass as an opaque string (do not import it).

### `packages/firewall/src/index.ts` (barrel)

**Analog:** `packages/acl/src/index.ts` (lines 1-89)

Replicate: `@packageDocumentation` JSDoc header with a full `@example` (acl lines 1-35), then grouped re-exports with section comments — `export type { … }` for types, `export { … }` for values, each grouped by source module:
```ts
// Types
export type { AclState, AclEntry, Identity } from './types.js';

export { CAP_RELAY_READ, /* … */ DEFAULT_QUOTA } from './types.js';

export { check, toKey } from './check.js';

export { createState, grant, /* … */ serialize, deserialize } from './mutations.js';
```
Firewall barrel re-exports: types from `./types.js`; `evaluate`, `toKey` (or bucket-key helper) from `./evaluate.js`; `defaultConfig`, `createState`, `setPolicy`, `setRateLimit`, `addMatcher`, `serialize`, `deserialize` from `./config.js`; defaults from `./defaults.js`. Drop acl's NUB/`resolve`/`migrate`/`capabilities` export blocks (lines 70-88) — firewall has no equivalents.

### `packages/firewall/src/evaluate.test.ts` / `config.test.ts` / `defaults.test.ts` (tests)

**Analogs:** `packages/acl/src/check.test.ts` (lines 1-103), `packages/acl/src/mutations.test.ts` (lines 1-174)

**Import + describe/it structure** (check.test.ts lines 1-6 / mutations.test.ts lines 1-8) — vitest, co-located, relative `.js` imports, top-level shared fixtures:
```ts
import { describe, it, expect } from 'vitest';
import { toKey, check } from './check.js';
import { CAP_RELAY_READ, CAP_SIGN_EVENT, CAP_ALL } from './types.js';
import type { AclState, Identity } from './types.js';

const id: Identity = { dTag: 'chat', hash: 'ff00' };
```

**Immutability assertion** (mutations.test.ts lines 61-65) — the "does not modify original state" test is mandatory for firewall too:
```ts
it('does not modify original state', () => {
  const state = createState('restrictive');
  grant(state, id, CAP_RELAY_READ);
  expect(state.entries).toEqual({});
});
```

**Serialize round-trip + invalid-input assertions** (mutations.test.ts lines 133-163) — replicate for `config.test.ts`:
```ts
it('round-trips state with new dTag:hash key format', () => {
  const state2 = grant(createState('restrictive'), id, CAP_RELAY_READ);
  const restored = deserialize(serialize(state2));
  expect(check(restored, id, CAP_RELAY_READ)).toBe(true);
});

it('deserialize returns permissive state for invalid JSON', () => {
  const state = deserialize('not-json');
  expect(state.defaultPolicy).toBe('permissive');
});
```

Firewall test coverage (RESEARCH §Validation, lines 374-388): `evaluate.test.ts` → CORE-01/02, RATE-01/02/03, BURST-01/02, CONTENT-01/02/03, POLICY-03, FOCUS-02 (use injected `now` with two values for refill-after-window; vary `initElapsedMs` for burst; `kind: 5` obs for delete-spam; same op focused vs unfocused for the multiplier; overlapping rules for precedence). `config.test.ts` → CORE-03 (mutation immutability + serialize round-trip). `defaults.test.ts` → CORE-04, BURST-02 default. Add the "first op of a fresh napplet passes" test (research Pitfall 2).

### `vitest.config.ts` (MODIFIED — the one easy-to-miss wiring edit)

**Existing `@kehto/*` alias block** (vitest.config.ts lines 5-15) — aliases are HAND-LISTED, not auto-discovered:
```ts
resolve: {
  alias: {
    '@kehto/acl/capabilities': resolve(__dirname, 'packages/acl/src/capabilities.ts'),
    '@kehto/acl': resolve(__dirname, 'packages/acl/src/index.ts'),
    '@kehto/runtime': resolve(__dirname, 'packages/runtime/src/index.ts'),
    '@kehto/services/cvm-nostr-transport': resolve(__dirname, 'packages/services/src/cvm-nostr-transport.ts'),
    '@kehto/services': resolve(__dirname, 'packages/services/src/index.ts'),
    '@kehto/shell': resolve(__dirname, 'packages/shell/src/index.ts'),
    '@kehto/nip/66': resolve(__dirname, 'packages/nip/src/66.ts'),
    '@kehto/nip': resolve(__dirname, 'packages/nip/src/index.ts'),
  },
},
```
**ADD** this line (firewall has no subpath, so a single alias):
```ts
'@kehto/firewall': resolve(__dirname, 'packages/firewall/src/index.ts'),
```
> Phase 80's own tests use relative `./` imports so they pass without this, but the alias is required convention and unblocks Phase 81's name-based imports (research Pitfall 1). Place it alphabetically near the other `@kehto/*` entries; no subpath alias needed (firewall has no `./capabilities`-style second entry).

---

## Shared Patterns

### Immutable spread-return (applies to: `config.ts`, `evaluate.ts` `newState`)
**Source:** `packages/acl/src/mutations.ts` lines 61-71 (`grant`)
Every state/config transition returns a fresh object via `{ ...state, key: { ...nested } }`. Original never mutated. Tests assert the original is unchanged.

### `import type` + `.js` extensions (applies to: ALL `src/*.ts`)
**Source:** `packages/acl/src/check.ts` line 8, `mutations.ts` line 8
`verbatimModuleSyntax: true` in root tsconfig forbids mixing value/type imports and requires explicit `.js` on relative imports:
```ts
import type { AclState, Identity } from './types.js';
import { CAP_ALL, type AclEntry, type AclState } from './types.js';  // mixed → inline `type`
```
Failure mode: build passes, `pnpm type-check` fails (research Pitfall 3).

### JSDoc-on-every-export (applies to: ALL `src/*.ts`)
**Source:** `packages/acl/src/check.ts` lines 28-56, `mutations.ts` lines 44-60
Every public export has a JSDoc block with `@param`, `@returns`, and a runnable `@example` fenced code block. CLAUDE.md mandates this; acl follows it on every export.

### Defensive deserialize → fall back to default (applies to: `config.ts`)
**Source:** `packages/acl/src/mutations.ts` lines 239-270
try/parse → shape-validate each field → rebuild validated structure → `catch`/invalid falls through to a fresh default. The firewall security control for poisoned-config tampering (ASVS V5).

### File header JSDoc block (applies to: ALL `src/*.ts`)
**Source:** `packages/acl/src/types.ts` lines 1-6, `check.ts` lines 1-6
Each source file opens with a `/** @kehto/<pkg> — <one-line role>. ... */` block describing purity/no-side-effects.

---

## No Analog Found

None. Every new file maps to an existing `packages/acl/` analog. The only genuinely new logic (not a copy) is the **token-bucket refill math** inside `evaluate.ts` — there is no in-repo analog for it; the planner/executor uses RESEARCH §Pattern 2 (lines 130-158) as the reference, not an acl file.

| New logic | No in-repo analog because | Use instead |
|-----------|---------------------------|-------------|
| Token-bucket refill/spend (`evaluate.ts`) | acl is a static bitfield check, not temporal | RESEARCH 80-RESEARCH.md Pattern 2 (lazy `lastRefill||now` init, skew/cap clamps, fractional tokens, spend `>= 1`) |

## Monorepo Wiring (verified)

| Touch-point | Action | Evidence |
|-------------|--------|----------|
| `vitest.config.ts` | **MODIFY** — add `@kehto/firewall` alias (see above) | aliases hand-listed at lines 5-15, not auto-discovered |
| `pnpm-workspace.yaml` | **NO EDIT** — `packages/*` glob (line 3) already covers `packages/firewall` | confirmed: line 2 `packages/*` |
| `turbo.json` | **NO EDIT** — generic `build` / `type-check` / `test:unit` tasks match any package with those scripts | confirmed: tasks at lines 4-37, no per-package config for acl either |
| root `tsconfig.json` | **NO EDIT** — no `references` array (not project-references); each package `extends ../../tsconfig.json` | per RESEARCH line 348 |
| `.changeset/` | **NO EDIT in Phase 80** — package is changeset-eligible automatically (`publishConfig.access: public` + workspace member); changeset added in Phase 82 | CONTEXT deferred (line 138) |
| `pnpm install` (root) | **RUN** after scaffolding to link the new workspace package | standard pnpm workspace behavior |

## Metadata

**Analog search scope:** `packages/acl/` (full package — package.json, tsconfig.json, tsup.config.ts, README.md, src/{types,check,mutations,migrate,index,capabilities}.ts, src/{check,mutations}.test.ts), root `vitest.config.ts`, `pnpm-workspace.yaml`, `turbo.json`
**Files scanned:** 14 (all read in full; each ≤ 270 lines, single-pass)
**Pattern extraction date:** 2026-06-15
