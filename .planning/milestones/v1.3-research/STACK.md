# Stack Research: v1.3 Demo-Functional & Playwright Parity

**Domain:** Iframe-sandboxed napplet runtime — demo wiring + Playwright E2E debug loop + release rehearsal
**Researched:** 2026-04-18
**Confidence:** HIGH for Playwright/tooling additions; MEDIUM for version pins (npm live, not Context7)

---

## Context: What Already Exists (Do Not Re-Research)

The v1.2 stack is fully settled and works. This document covers only **net-new additions** for v1.3:

- **Core stack unchanged:** TypeScript 5.9, tsup, turborepo, pnpm 10, vitest 4.1, @playwright/test 1.52, Vite 6, changesets
- **Protocol packages unchanged:** @napplet/core, @napplet/shim, @napplet/sdk, @napplet/nub-* (all via workspace overrides)
- **@kehto/* runtime unchanged:** acl, runtime, shell, services — no protocol changes in v1.3
- **Napplet deps unchanged:** bot/chat use @napplet/shim + @napplet/sdk via workspace links

---

## Critical Constraint: Playwright 1.52 → Upgrade Path

The root `package.json` pins `"@playwright/test": "^1.52.0"`. The latest Playwright as of research is **1.59**, which adds:

- `page.consoleMessages()` + `page.pageErrors()` (added in 1.54) — essential for the debug loop
- `consoleMessage.timestamp()` (1.54)
- `locator.describe()` for trace viewer annotations (1.53)
- `locator.contentFrame()` / `frameLocator.owner()` (added 1.43, present in 1.52)

**Recommendation:** Upgrade to `^1.54.0` minimum (for `page.consoleMessages()`) or `^1.59.0` to pick up the full set. The 1.52 → 1.59 window has no breaking changes for the existing config. Since the project uses `^` semver, `pnpm update @playwright/test` is sufficient. Pin at `^1.54.0` (conservative) or `^1.59.0` (picks up screencast + MCP improvements).

---

## Recommended Additions

### Section 1: Playwright Debug-Loop Helpers

These go in the root devDependencies (alongside `@playwright/test`). None require CJS or introduce framework deps.

#### 1a. Upgrade @playwright/test to ^1.54.0 (already in devDeps, just bump version)

| New API | Why v1.3 Needs It |
|---------|-------------------|
| `page.consoleMessages({ filter })` | Collect shell-side console output after a test action without adding `page.on('console')` boilerplate to every spec. Critical for the build→run→fix loop. |
| `page.pageErrors()` | Capture uncaught exceptions thrown inside the shell page (includes postMessage handler errors from @kehto/runtime). |
| `consoleMessage.timestamp()` | Correlate console events with postMessage timing in sandboxed iframe flows. |
| `locator.describe('label')` | Annotate iframe locators in trace viewer — makes traces readable for napplet frames. |

**Integration:** No config change needed. Methods are addable inline in spec files. The existing `playwright.config.ts` remains valid.

#### 1b. No additional Playwright plugins needed

Do NOT add these — they solve problems this project doesn't have:
- `@playwright/experimental-ct-*` — component testing wrapper; kehto has no framework components
- `@vitest/browser-playwright` — Vitest browser mode; kehto E2E lives in Playwright, unit tests in Vitest, the split is correct
- `axe-playwright` — accessibility audit; not in v1.3 scope
- `playwright-ct` — same as experimental-ct; wrong layer

The existing harness-based design (`tests/e2e/harness/`) is the correct pattern for iframe protocol testing. `frameLocator()` is NOT the right tool here because napplets run with `allow-scripts` only (no `allow-same-origin`) — Playwright's `frameLocator` cannot reach into cross-origin sandboxed iframes for DOM interaction. The harness's `window.__*__` globals + `page.evaluate()` bridge is the correct approach and must be kept.

---

### Section 2: Console + Network Capture in the Debug Loop

No new packages needed. Use Playwright's built-in event system properly.

#### Pattern: Per-test console collector (add to test helpers)

```typescript
// tests/helpers/console-collector.ts
import type { Page, ConsoleMessage } from '@playwright/test';

export function collectConsole(page: Page): { messages: ConsoleMessage[]; errors: string[] } {
  const messages: ConsoleMessage[] = [];
  const errors: string[] = [];
  page.on('console', msg => {
    messages.push(msg);
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));
  return { messages, errors };
}
```

After Playwright 1.54: `page.consoleMessages()` retrieves buffered messages without the listener setup — use this in `afterEach` dumps to avoid littering spec files with `page.on` wiring.

#### Pattern: Network interception for napplet asset loading

```typescript
// Intercept napplet script loads to verify correct CORS headers from harness Vite plugin
page.on('response', res => {
  if (res.url().includes('/napplets/')) {
    // assert res.headers()['access-control-allow-origin'] === '*'
  }
});
```

This requires no new packages. `page.route()` can mock napplet responses for offline unit-style E2E tests.

#### Pattern: Trace config for the debug loop

Upgrade the `playwright.config.ts` trace setting from `'on-first-retry'` to `'retain-on-failure'` during active development:

```typescript
// In use block during active debug loop:
trace: 'retain-on-failure',
video: 'retain-on-failure',
```

Switch back to `'on-first-retry'` once specs are stable. No new package required.

---

### Section 3: Multi-Server webServer for Demo Testing

v1.3 will add `apps/demo` as a second Playwright webServer target (the existing harness handles the protocol-level specs; the demo exercises the full UX). Playwright webServer accepts an **array**:

```typescript
// playwright.config.ts — v1.3 extension
webServer: [
  {
    // Existing: test harness for protocol specs
    name: 'harness',
    command: 'pnpm --filter @test/harness preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  {
    // New: demo app for golden-path UI specs
    name: 'demo',
    command: 'pnpm --filter @kehto/demo preview --port 4174',
    url: 'http://localhost:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,  // demo includes napplet builds
  },
],
```

Napplet build artifacts (`apps/demo/napplets/*/dist/`) must be built before `pnpm preview`. This means `pnpm test:build` must include napplet builds via turbo. Add a `turbo.json` task for napplet builds or add them to the `test:build` script:

```json
// turbo.json — add to pipeline
"build:napplets": {
  "dependsOn": ["^build"],
  "outputs": ["apps/demo/napplets/*/dist/**"]
}
```

No new npm packages needed. This is a turbo + playwright config change only.

---

### Section 4: Release Rehearsal Tooling

These are dev-only tools run manually as part of the release-rehearsal phase. All are ESM-compatible CLI tools used via `pnpm dlx` — no installation into package.json required unless you want pinned versions.

#### 4a. publint v0.3.18

**What it does:** Validates each package's `package.json` `exports` map against its actual built output. Catches misconfigured `main`/`module`/`types` fields, missing `.js` extensions in exports, and wrong `type: "module"` settings.

**Why it matters for v1.3:** The release rehearsal phase stages changesets and runs `changeset version`. Before `changeset publish` (deferred), verifying that each @kehto/* package's exports are publish-correct catches issues without an actual npm publish.

**Usage pattern:**
```bash
# Run after pnpm build — check each package
pnpm dlx publint packages/acl
pnpm dlx publint packages/runtime
pnpm dlx publint packages/shell
pnpm dlx publint packages/services
```

**ESM-only note:** publint expects `"type": "module"` packages to have `.js` extension exports and no CJS fallback. @kehto/* packages are ESM-only — publint will validate this correctly.

**Integration point:** Add a `check:publint` script in the root `package.json`:
```json
"check:publint": "turbo run build && for p in acl runtime shell services; do pnpm dlx publint packages/$p; done"
```

**Confidence:** HIGH — publint 0.3.18 is the current version, supports pnpm 10, explicitly handles ESM-only packages.

#### 4b. @arethetypeswrong/cli (attw)

**What it does:** Analyzes TypeScript type resolution correctness across `node10`, `node16`, and `bundler` resolution modes. Detects "CJS resolves to ESM" errors, missing type exports, and phantom types.

**Why it matters for v1.3:** @kehto/* packages are ESM-only with `verbatimModuleSyntax`. attw's `--profile esm-only` flag suppresses false-positive CJS resolution warnings and focuses on the ESM graph only.

**Usage pattern:**
```bash
# After pnpm build — pack and analyze each package
pnpm dlx @arethetypeswrong/cli --pack packages/acl --profile esm-only
pnpm dlx @arethetypeswrong/cli --pack packages/runtime --profile esm-only
pnpm dlx @arethetypeswrong/cli --pack packages/shell --profile esm-only
pnpm dlx @arethetypeswrong/cli --pack packages/services --profile esm-only
```

`--pack` does a local `npm pack` without publishing. `--profile esm-only` ignores CJS resolution failures intentionally.

**Integration point:** Add `check:attw` script alongside `check:publint`. Run both in release rehearsal phase.

**Confidence:** MEDIUM — attw is actively maintained; `--profile esm-only` confirmed in README. Current version not pinned in research (use `pnpm dlx` which fetches latest).

#### 4c. typedoc v0.28

**What it does:** Generates API reference HTML or JSON from TypeScript source + JSDoc comments. With `entryPointStrategy: "packages"` it handles monorepos by building per-package docs and merging.

**Why it matters for v1.3:** The "docs refresh" deliverable updates `docs/` + READMEs. typedoc provides a rendered API reference aligned with the v1.2 public surface.

**Usage pattern:**
```bash
# Install once as root devDep (not pnpm dlx — too slow for iteration)
pnpm add -D -w typedoc@^0.28

# typedoc.json at repo root
{
  "entryPointStrategy": "packages",
  "entryPoints": ["packages/acl", "packages/runtime", "packages/shell", "packages/services"],
  "out": "docs/api",
  "exclude": ["**/*.test.ts", "**/dist/**"]
}
```

Monorepo `entryPointStrategy: "packages"` builds docs for each workspace package and merges into one site. Added in v0.26, current API reference is v0.28.

**Confidence:** MEDIUM — typedoc 0.28 is confirmed (API docs at typedoc.org/api show v0.28.15+). `entryPointStrategy: "packages"` confirmed for monorepos. ESM config file supported.

**Caution:** typedoc is a dev-time docs tool only. Do NOT add it as a turbo pipeline step (slow, not a build artifact). Run manually in the docs-refresh phase.

---

### Section 5: What NOT to Add

| Avoid | Why | Constraint |
|-------|-----|------------|
| `wait-on` npm package | Playwright's `webServer.url` already polls for server readiness — `wait-on` is redundant overhead | No new dep needed |
| `@vitest/browser` / `@vitest/browser-playwright` | Vitest 4's browser mode is for component tests; kehto has zero framework components; the existing vitest/playwright split (unit vs E2E) is correct | Adds CJS surface, wrong layer |
| `playwright-ct` / `@playwright/experimental-ct-*` | Same reason as above — framework component testing wrapper | Wrong abstraction |
| `axe-playwright` / `@axe-core/playwright` | Accessibility auditing; not in v1.3 scope | Scope creep |
| `msw` (Mock Service Worker) | Network mocking for REST APIs; kehto uses postMessage over iframe boundaries, not HTTP service calls that MSW intercepts | Wrong interception layer for this protocol |
| CJS-emitting tsup config | ESM-only constraint is a project hard requirement | Breaks `"type": "module"` in all packages |
| `window.nostr` stubs in test harness | v1.2 hard-removed `window.nostr`; the spec MUST NOT provide it | Violates NIP-5D canonical spec |
| `signer-service` re-introduction | Deleted in v1.2; signing moved inside shell via `relay.publishEncrypted` | Contradicts v1.2 architecture |
| `@microsoft/api-extractor` | Heavyweight Microsoft Rush dependency; overkill for a 4-package library without a dedicated API review process | Complexity cost far exceeds benefit vs typedoc + attw |

---

## Installation Summary

### Immediate (bump existing dep)

```bash
# In root package.json — bump ^1.52.0 → ^1.54.0 (or ^1.59.0)
pnpm update @playwright/test
```

### Add to root devDependencies (pinned)

```bash
# Docs tooling — install once, use in release-rehearsal phase
pnpm add -D -w typedoc@^0.28
```

### Use via pnpm dlx (no install required)

```bash
# Release rehearsal — run once per release candidate
pnpm dlx publint packages/<name>
pnpm dlx @arethetypeswrong/cli --pack packages/<name> --profile esm-only
```

### Config changes only (no new packages)

- `playwright.config.ts` — add demo webServer entry, upgrade trace to `retain-on-failure` during debug loop
- `turbo.json` — add `build:napplets` pipeline task
- `tests/helpers/` — add `console-collector.ts` helper
- Root `package.json` scripts — add `check:publint`, `check:attw`, `docs`

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@playwright/test@^1.54` | Node 22+, pnpm 10, ESM | ESM imports via `import` — no `.cjs` entry; Playwright does not emit ESM itself but is importable as ESM |
| `typedoc@^0.28` | TypeScript ^5.9, Node 22+, ESM config | Config file must be `typedoc.json` (JSON) or `typedoc.config.mjs` (ESM). Works with `verbatimModuleSyntax`. |
| `publint@0.3.x` | pnpm 8/9/10, ESM-only packages | Explicit pnpm support; run after `pnpm build` |
| `@arethetypeswrong/cli` (latest) | Node 22+, ESM-only packages | `--profile esm-only` suppresses intended CJS warnings |

All additions are compatible with the constraint matrix: pnpm 10, Node 22+, ESM-only, turbo/tsup/vitest/Playwright.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `page.consoleMessages()` (Playwright 1.54 built-in) | `page.on('console')` listener per spec | Built-in is cleaner; listener approach litters specs; same data |
| `retain-on-failure` trace during debug | `--headed` manual runs | Trace viewer gives time-travel replay of postMessage flows; manual headed runs don't capture timing |
| `pnpm dlx publint` (no install) | Install publint as dev dep | pnpm dlx always gets latest; release-rehearsal is not a CI step so version pinning is less critical |
| `typedoc --entryPointStrategy packages` | Per-package typedoc runs | Merged site is more useful for a 4-package monorepo |
| `attw --profile esm-only` | `attw` without profile | Without `--profile esm-only`, attw emits false-positive CJS errors for every package because they intentionally have no CJS output |
| Playwright array `webServer` | Single harness server + manual demo testing | Array webServer allows `pnpm test:e2e` to spin up both automatically; maintains one-command test gate |

---

## Sources

- Playwright release notes (playwright.dev/docs/release-notes) — v1.52 through v1.59 feature list; HIGH confidence
- publint.dev/docs — current version 0.3.18, pnpm support, ESM-only guidance; HIGH confidence
- arethetypeswrong/cli README (github.com) — `--pack`, `--profile esm-only` flags; MEDIUM confidence (version not pinned)
- typedoc.org/api — v0.28.15+ confirmed; `entryPointStrategy: "packages"` for monorepos; MEDIUM confidence
- Playwright issue #21816 (github.com/microsoft/playwright) — CDPSession iframe traffic limitation; HIGH confidence (known limitation, unchanged)
- Playwright docs: webServer array config (playwright.dev/docs/test-webserver) — MEDIUM confidence

---

*Stack research for: kehto v1.3 demo-functional + Playwright parity*
*Researched: 2026-04-18*
