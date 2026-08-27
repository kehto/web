# Phase 106: Active-Surface Conformance and Release - Pattern Map

**Mapped:** 2026-07-27  
**Files analyzed:** 5  
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/verify-napplet-authorities.mjs` | utility | batch | `scripts/audit-gateway-artifacts.mjs` | role-match |
| `tests/unit/sdk-migration-guard.test.ts` | test | batch | itself (classified active-surface guard) | exact |
| `tests/unit/published-napplet-contract.test.ts` | test | batch | itself (installed-package contract guard) | exact |
| `tests/unit/playground-gateway-guard.test.ts` | test | batch | `tests/unit/sdk-migration-guard.test.ts` | role-match |
| `.planning/phases/106-active-surface-conformance-and-release/106-RELEASE-CHECKLIST.md` | config | batch | `105-VERIFICATION.md` | role-match |

The existing `.changeset/phase-105-published-package-line.md` is evidence to retain, not a Phase-106 edit target: it already names exactly `acl`, `cli`, `firewall`, `paja`, `runtime`, `services`, and `shell` as minor releases (lines 1-17).

## Pattern Assignments

### `scripts/verify-napplet-authorities.mjs` (utility, batch)

**Analog:** `scripts/audit-gateway-artifacts.mjs`

Use an ESM executable script rooted from `import.meta.url`, collect every violation instead of failing at the first one, emit each actionable failure to stderr, then exit nonzero only after the complete report. The authority script may use `gh api`, `npm view`, and JSR metadata fetches, but must make its result deterministic under `--check`: unavailable external authority is a reported verification failure, not a silently accepted skip.

**Imports and repository-root pattern** (lines 11-17):

```javascript
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..');
```

**Aggregate-error pattern** (lines 23-34):

```javascript
/** @type {string[]} */
const violations = [];

function fail(message) {
  violations.push(message);
}

function read(path) {
  return readFileSync(path, 'utf8');
}
```

**Final report and exit pattern** (lines 152-161):

```javascript
if (violations.length > 0) {
  for (const violation of violations) {
    console.error(`audit:gateway-artifacts FAILED — ${violation}`);
  }
  console.error(`\n[audit:gateway-artifacts] ${violations.length} violation(s)`);
  process.exit(1);
}

console.log(`[audit:gateway-artifacts] OK — checked ${names.length} napplet gateway artifact(s)`);
process.exit(0);
```

For the Phase-106 checks, model immutable expectations as explicit constants and compare: PR #89 old head `4593ce9…` with merged head `e0cd584…`, PR state/head/merge/base for #89–#92, npm + JSR package versions, `pnpm-lock.yaml`, and the published-contract source assertions. Do not edit authority constants until the semantic NAP-INC diff has been reviewed and classified.

---

### `tests/unit/sdk-migration-guard.test.ts` (test, batch)

**Analog:** itself, especially its classified active-surface implementation.

Extend this guard—not a repository-wide literal search—if the audit finds active obsolete negotiation or intent vocabulary. Preserve archived plans, changesets, changelogs, and intentional fixture inputs as exclusions.

**Classified source and historical-exclusion pattern** (lines 65-78):

```typescript
const activeMigrationSourceDirs = [
  ...sdkTargetDirs.filter((dir) => dir.startsWith('apps/playground/')),
  ...publicPackageDirs.map((dir) => `${dir}/src`),
  'packages/nip/src',
] as const;

const historicalMigrationExclusions = [
  '.planning/',
  '.changeset/',
  'CHANGELOG.md',
  'tests/fixtures/napplets/',
] as const;
```

**Recursive executable-source enumeration** (lines 106-121):

```typescript
function sourceFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const entries = readdirSync(root);
  const files: string[] = [];
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.turbo') continue;
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...sourceFiles(path));
    else if (/\.[cm]?tsx?$/.test(path)) files.push(path);
  }
  return files;
}
```

**Bounded violation assertion** (lines 282-297):

```typescript
const violations: string[] = [];
for (const dir of activeMigrationSourceDirs) {
  for (const abs of sourceFiles(join(process.cwd(), dir))) {
    const file = relative(process.cwd(), abs);
    const lines = readFileSync(abs, 'utf8').split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      if (pattern.test(line)) violations.push(`${file}:${index + 1}`);
    }
  }
}
expect(violations).toEqual([]);
```

---

### `tests/unit/published-napplet-contract.test.ts` (test, batch)

**Analog:** itself, especially the installed-artifact guard.

Use this file only for deterministic source/lockfile/installed-declaration assertions discovered by authority revalidation. Keep live registry querying in `verify-napplet-authorities.mjs`, so unit tests remain offline and fast.

**Installed pnpm artifact resolver** (lines 36-50):

```typescript
function installedPackagePath(name: string, version: string): string {
  const escaped = name.replace('@', '').replace('/', '+');
  const packageDir = readdirSync(join(ROOT, 'node_modules/.pnpm'))
    .find((entry) => entry.startsWith(`@${escaped}@${version}`));
  expect(packageDir, `installed ${name}@${version}`).toBeTruthy();
  return join(ROOT, 'node_modules/.pnpm', packageDir ?? '', 'node_modules', name);
}

function packageText(name: string, version: string, path: string): string {
  return readFileSync(join(installedPackagePath(name, version), path), 'utf8');
}
```

**Authority evidence pattern** (lines 89-98):

```typescript
it('records the exact NAP, source, and release evidence used for the published contract', () => {
  expect([NAP_INTENT_REF, NAP_INC_REF, NAP_SHELL_REF, NAP_RELAY_REF, SOURCE_REF, RELEASE_REF]).toEqual([
    'a718915ddefa2f03a0126579601f59d8bd86f7c4',
    '6461e4b37c29dc09a20dff35d9515889c4433874',
    '5ac0490461ca6fec2f0d2e45b4835cf9bc08de24',
    '0be8abce18beb46ca37bd4ddd042f58d30b4eedc',
    'dd7b3a728eb9c838b7218fcec7bb7bb00e7cc88b',
    '60889f1c2476e063500c7ab6624af6abe0dbcbe5',
  ]);
});
```

**Explicit upstream-drift pattern** (lines 138-147):

```typescript
expect(
  incSdk,
  `upstream package drift at NAP-INC ${NAP_INC_REF}: the callback receives one IncEvent`,
).toContain('callback: (payload: unknown, event: NostrEvent) => void');
expect(namespace).toContain('on(topic: string, callback: (event: IncEvent) => void)');
```

---

### `tests/unit/playground-gateway-guard.test.ts` (test, batch)

**Analog:** `tests/unit/sdk-migration-guard.test.ts`

Use existing guard style for any evidence gap limited to active playground configurations, catalog/controller/host wiring, or retained host-bound shell behavior. It should assert known production paths and explicit negative strings; it must not turn archived demo/fixture material into a release failure.

The corresponding source-level host invariant script provides the concrete failure shape to reuse (from `scripts/audit-gateway-artifacts.mjs` lines 36-65):

```javascript
if (!shellHost.includes('iframe.srcdoc =') || !shellHost.includes('injectCspMeta(')) {
  fail('shell-host.ts does not inject verified bytes via iframe.srcdoc');
}
if (shellHost.includes('iframe.src = metadata.htmlUrl') || shellHost.includes('/napplet-gateway/')) {
  fail('shell-host.ts still uses the retired gateway htmlUrl/metadata navigation');
}
if (shellHost.includes('allow-same-origin')) {
  fail('shell-host.ts contains allow-same-origin; napplets must stay opaque-origin');
}
```

---

### `.planning/phases/106-active-surface-conformance-and-release/106-RELEASE-CHECKLIST.md` (config, batch)

**Analog:** `.planning/phases/105-published-convention-adoption-and-host-flows/105-VERIFICATION.md`

Create an evidence document, not a new policy. Maintain frontmatter and a time-stamped, auditable table of requirements, commands, exit statuses, allowed optional-network skip, changeset status, pushed SHA, exact-main CI URL/status, PR link, and the explicit Phase-105 UI-risk fix/defer decision. It is updated as gates run; unknown values remain clearly pending rather than being inferred.

**Frontmatter and status pattern** (lines 1-18):

```markdown
---
phase: 105-published-convention-adoption-and-host-flows
verified: 2026-07-27T14:41:01Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---
```

**Evidence table pattern** (lines 104-110):

```markdown
| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Package alignment, released surfaces, active drift guards, catalogs/controllers, safe media | `pnpm exec vitest run` on nine focused Phase-105 files | 9 files, 90 tests passed | ✓ PASS |
| Mandatory retained NAP-SHELL prelude | `pnpm exec vitest run packages/shell/src/napplet-namespace.test.ts` | 28 tests passed | ✓ PASS |
| Complete browser/runtime proof | `pnpm test:e2e` | 79 passed, 1 optional live-network case skipped, 0 failed | ✓ PASS |
```

## Shared Patterns

### Classified active-surface scanning

**Source:** `tests/unit/sdk-migration-guard.test.ts` lines 65-78, 123-142, 282-297  
**Apply to:** all active-code vocabulary and package-line audit extensions.

Only enumerate executable/current source roots. The guard itself asserts that its scope is bounded and that its historic exclusions are deliberate:

```typescript
expect(historicalMigrationExclusions).toEqual([
  '.planning/',
  '.changeset/',
  'CHANGELOG.md',
  'tests/fixtures/napplets/',
]);
```

### Authority and package evidence separation

**Source:** `tests/unit/published-napplet-contract.test.ts` lines 36-50, 89-147  
**Apply to:** authority script and package-guard updates.

The script owns mutable network evidence and semantic-diff reporting. The Vitest guard owns installed pnpm artifacts, frozen package matrix, and documented upstream drift. Never make a unit test depend on a live registry.

### Release metadata and CI policy

**Source:** `tests/unit/ci-release-gate.test.ts` lines 14-31 and `.changeset/phase-105-published-package-line.md` lines 1-17  
**Apply to:** checklist and release readiness.

Preserve Changesets-generated versioning and the release-only JSR sync guard. The checklist must record, rather than bypass, the requirement to verify the CI result on the exact `origin/main` target before a tag or `release.yml` dispatch.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `scripts/verify-napplet-authorities.mjs` | utility | batch | No existing repository script combines mutable GitHub PR state, semantic compare result, npm, JSR, lockfile, and installed-package authority checks; use the audit-script structure above. |
| `106-RELEASE-CHECKLIST.md` | config | batch | No prior release checklist exists; Phase 105 verification reporting is the closest evidence-document pattern. |

## Metadata

**Analog search scope:** `scripts/`, `tests/unit/`, `.changeset/`, `.github/workflows/`, Phase 105 verification evidence  
**Files scanned:** 8 primary analog/evidence files  
**Pattern extraction date:** 2026-07-27
