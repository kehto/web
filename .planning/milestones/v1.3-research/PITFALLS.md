# Pitfalls Research

**Domain:** Demo + Playwright iframe-sandboxed Nostr runtime (kehto v1.3)
**Researched:** 2026-04-18
**Confidence:** HIGH (derived from direct codebase analysis — harness.ts, shell-bridge.ts, origin-registry.ts, vite configs, existing specs, pnpm overrides, and vite-plugin source)

---

## Critical Pitfalls

### Pitfall 1: Playwright frameLocator Timing on Sandboxed Iframes Without `allow-same-origin`

**What goes wrong:**
`page.frameLocator('#some-iframe')` returns a frame locator immediately, but the actual frame is not attached until the iframe's `load` event fires. When `allow-same-origin` is absent from `sandbox` (as in the harness — only `allow-scripts`), Playwright cannot introspect `contentDocument` at all via the CDP frame tree. Attempting `.locator()` calls inside the frame locator before it is fully loaded results in "Frame not found" or "Execution context was destroyed" errors that look like test flakiness but are deterministic timing failures.

The existing `demo-audit-correctness.spec.ts` uses `page.frameLocator('#chat-frame-container iframe')` and queries elements inside the iframe directly. This works in dev mode (`vite dev`) where the napplet is served on the same origin as the shell (`localhost:5174`), but breaks in `vite preview` mode when napplets are served as static files from the `dist/napplets/` path — the origin becomes `null` for sandboxed iframes loaded via `src=` pointing to a different path origin.

**Why it happens:**
Two independent problems stack:
1. `frameLocator` resolves the frame by matching a CSS selector in the parent page. If the iframe element exists in the DOM but the frame has not committed navigation yet, Playwright finds the element but the frame context is unready.
2. Without `allow-same-origin`, the browser treats the iframe's origin as `null` (opaque origin). Playwright's CDP-based frame introspection relies on the frame's execution context being accessible in the same origin tree. With opaque origin, Playwright's `frameLocator` still works for locating elements IF the browser exposes the frame via CDP — Chromium does expose sandboxed frames — but only after navigation commits, not immediately after iframe insertion.

**How to avoid:**
- Always `await page.waitForFunction(() => document.querySelector('#iframe-id')?.contentWindow !== null)` after napplet load before using `frameLocator`.
- For the demo specs that use `frameLocator`, add an explicit iframe readiness guard: wait for a sentinel value the napplet writes to its own DOM (e.g., `#status` element text), not for the parent page's ACL state.
- In the Playwright spec helpers, wrap `frameLocator` calls in a retry-aware pattern using `expect.poll` rather than a naked `await frame.locator().click()`.
- Do not use `contentFrame()` (Playwright's `ElementHandle.contentFrame()`) as a substitute — it requires same-origin access and returns `null` for opaque-origin sandboxed iframes.

**Warning signs:**
- Tests pass reliably in `pnpm test:e2e` locally (fast machine, napplets load quickly) but fail ~20% of the time in a slower environment or when the napplet dist is large.
- "Frame not found" Playwright errors with a selector that clearly exists in the DOM.
- Any test that does `frameLocator(...)` immediately after `page.evaluate(() => __loadNapplet__(...))` without a wait.

**Phase to address:**
Demo rewire phase (Phase 16 or equivalent). Before writing a single demo-functional Playwright spec, establish a shared `waitForNappletReady(page, frameSelector)` helper that polls for the napplet's sentinel element. Make this helper a success criterion of the spec scaffolding plan.

---

### Pitfall 2: postMessage Origin Mismatch for `allow-scripts`-only Sandboxed Iframes

**What goes wrong:**
The shell-bridge sends `shell.init` and subsequent NIP-5D envelopes via `win.postMessage(msg, '*')` — the wildcard target origin is intentional. However, in the napplet (shim side), `event.origin` for messages received inside an `allow-scripts`-only sandboxed iframe is `"null"` (the string literal, not the JavaScript `null`). If the shim or any napplet code validates `event.origin !== parentOrigin`, it will always fail because the parent's real origin (e.g., `http://localhost:5174`) does not match the `"null"` string that the sandbox produces for the child's `event.origin`.

The current shell-bridge correctly uses `event.source` (the `Window` reference) as the unforgeable identity check, not `event.origin`. But the napplet side (shim) may still reject messages if it checks `event.origin`. When adding new napplets to the demo showcase (feed, composer, profile-viewer), developers typically copy a reference shim integration and may add defensive origin checks that silently drop all shell messages.

Additionally: when the shell sends a message to the napplet iframe via `win.postMessage(envelope, '*')`, the napplet iframe receives `event.origin === "null"` (the string) if the iframe itself has an opaque origin (served from `blob:` URL or `srcdoc`). But when the iframe is loaded via `src=http://localhost:5174/napplets/feed/index.html`, the iframe's own `window.location.origin` is `http://localhost:5174` — the event.origin in the iframe's listener correctly shows the shell's origin. The confusion arises only when mixing `srcdoc` or `blob:` iframe loading patterns.

**Why it happens:**
Developers conflate two origins:
- The origin of the **sender** as seen by the **receiver** (`event.origin` in the napplet's listener when the shell posts) — this is the shell's real origin.
- The origin of the **iframe itself** as seen by the **parent** (`event.origin` in the shell's listener when the napplet posts) — this is `"null"` when sandbox excludes `allow-same-origin`.

The shell currently receives napplet messages with `event.origin === "null"` and correctly ignores origin, relying only on `event.source`. The napplet receives shell messages with `event.origin === "http://localhost:5174"` (the real shell origin). This asymmetry confuses developers who think both sides see `"null"`.

**How to avoid:**
- In new napplet showcase implementations, never validate `event.origin` against a hardcoded value. Instead, verify `event.source === window.parent` (for direct parent communication). The `@napplet/shim` already does this correctly — do not add extra defensive origin checks in the napplet demo code.
- If using `srcdoc` or `blob:` to load napplet content (as an alternative to serving from `dist/`), both sides will see `"null"` as origin. In this case, validate exclusively via `event.source` and the protocol envelope shape (`typeof event.data.type === 'string'`).
- Document the asymmetry in the demo's napplet template so future showcase napplets do not re-introduce broken origin guards.

**Warning signs:**
- Napplet appears in the DOM, `originRegistry.register()` is called, but no `shell.ready` message is ever received by the shell.
- Shell sends `shell.init` (visible in DevTools Network/Messages), but napplet never sends a protocol request.
- Console shows no errors in either frame — silent message drop due to origin guard.

**Phase to address:**
Napplet showcase expansion phase. Add an explicit integration-test assertion that `shell.ready` is received within 2 seconds of napplet load for every new napplet added to the demo.

---

### Pitfall 3: Vite Dev-Mode vs Preview-Mode Drift — `napplet-aggregate-hash` Meta Tag

**What goes wrong:**
The `@napplet/vite-plugin` (`nip5aManifest`) injects `<meta name="napplet-aggregate-hash" content="">` with an **empty content** in dev mode (`vite dev`). The `closeBundle` hook (which computes the real SHA-256 aggregate hash and rewrites the meta tag) only fires during `vite build`. As a result:

- In `pnpm dev`, the napplet's `aggregateHash` as seen by the shell runtime is `""` (empty string).
- In `pnpm build` + `pnpm preview`, the napplet's `aggregateHash` is a real 64-character hex string.

The runtime's `sessionRegistry` and `aclStore` both key their entries on `(pubkey, dTag, aggregateHash)`. Any ACL entry written during dev testing (with `aggregateHash = ""`) will NOT match in preview mode (with a real hash). This means:
- ACL tests that pass in dev fail in preview because the grant/revoke persisted in localStorage uses `""` as the hash key.
- The demo's ACL panel, which shows per-napplet capability state, shows a different napplet identity between dev and preview.
- `sessionRegistry.getEntry(pubkey)` returns entries with different `aggregateHash` values depending on whether the napplet was loaded from dev server or from built dist.

**Why it happens:**
`closeBundle` is the only hook where Vite provides the complete output file list with resolved paths. The plugin correctly skips hash computation in dev mode (the files do not exist yet in `dist/`). The empty-string sentinel is a deliberate design decision in the plugin — but downstream callers must not assume it remains stable across build modes.

**How to avoid:**
- Always build napplets (`pnpm build` from each napplet dir or `turbo run build`) before running `pnpm test:e2e` or the `pnpm preview` demo. The existing `test:e2e` script does `pnpm test:build` first — maintain this discipline for demo-functional specs too.
- In Playwright demo specs, never rely on a hardcoded `aggregateHash` value in assertions. Instead read the hash from the runtime via the harness globals or from the napplet's DOM: `await page.frameLocator('...').locator('meta[name="napplet-aggregate-hash"]').getAttribute('content')`.
- Add a build-phase smoke check: if a Playwright spec sees `aggregateHash === ""` in `__getNappEntry__()`, the test should fail with `throw new Error('napplet not built — run pnpm build first')` rather than proceeding with a poisoned identity.

**Warning signs:**
- Demo works locally in `pnpm dev` but ACL panel shows wrong state or no entries after `pnpm preview`.
- `aclStore.getEntry(pubkey, dTag, '')` resolves but `aclStore.getEntry(pubkey, dTag, '<real-hash>')` returns undefined.
- `changeset version` dry-run passes but the demo cannot authenticate napplets post-build.

**Phase to address:**
Demo rewire phase. Add to the phase's success criteria: "Run `pnpm test:e2e` against `vite preview` (not `vite dev`) and verify all demo napplets have non-empty `aggregateHash`."

---

### Pitfall 4: pnpm Workspace Symlink Deduplication Breaking `@napplet/*` Peer Deps

**What goes wrong:**
The root `package.json` uses `pnpm.overrides` to link all `@napplet/*` packages to `/home/sandwich/Develop/napplet/packages/*`. When packages inside kehto (e.g., `packages/runtime`) declare `@napplet/core` as a peer dependency AND `apps/demo` also declares it as a dependency, pnpm may resolve two different instances of `@napplet/core`: one symlink for the package, one for the app.

This causes the most insidious failure: `instanceof` checks and `===` comparisons on types/constants from `@napplet/core` return `false` when comparing objects created by one instance against types imported from another instance. In the kehto runtime, this could surface as NUB domain type guards failing silently — an envelope that passes the napplet's shim type guard fails the shell's type guard because each side imported `isNappletMessage` from a different module instance.

The specific pnpm failure mode: `link:` overrides apply workspace-wide, but if any transitive dep also declares `@napplet/core` as a non-peer dependency (e.g., `@napplet/shim` has it as a regular dep), pnpm may install a second copy in that package's own `node_modules`, bypassing the workspace override.

**Why it happens:**
`pnpm.overrides` applies to direct and transitive dependencies in packages within the workspace. However, `link:` protocol overrides are filesystem symlinks, not virtual packages. When a package is symlinked, pnpm may not deduplicate it against other resolved copies if the version ranges differ or if the symlinked package is not itself a workspace package (it is an external workspace at a different path). The napplet repo at `/home/sandwich/Develop/napplet/` is not listed in kehto's `pnpm-workspace.yaml` — it is referenced only via `link:` overrides.

**How to avoid:**
- After any `pnpm install`, verify deduplication: `pnpm ls @napplet/core --depth 5` and confirm only one instance appears in the resolution tree. If two appear, add an explicit `pnpm dedupe` step.
- In the demo app's `package.json`, do NOT add `@napplet/core` as a direct dependency. It should only arrive as a transitive dep from `@napplet/shim` and `@napplet/sdk` — the workspace override then handles all copies.
- For new showcase napplets (`apps/demo/napplets/*`), keep dependencies minimal: only `@napplet/shim` and `@napplet/sdk`. Do not add individual nub packages as direct deps — they are bundled by the sdk.
- Smoke test: if a napplet loads but `shell.ready` is never dispatched, check whether `@napplet/shim`'s internal `NIP_5D_PROTOCOL_VERSION` constant matches the one in `@kehto/runtime`. A version mismatch from dual instances will cause the shim to skip the handshake silently.

**Warning signs:**
- `pnpm ls @napplet/core` shows multiple entries at different depths.
- Napplet sends `shell.ready` but shell-bridge's `msg.type === 'shell.ready'` check fails despite the object visually looking correct in DevTools.
- TypeScript type errors complaining about "Type X is not assignable to type X" — identical type name but different declaration source.

**Phase to address:**
Demo rewire phase (first plan). Add `pnpm ls @napplet/core --depth 5` as a setup verification step and document the expected output (single instance).

---

### Pitfall 5: ACL State Bleed Between Playwright Tests via `localStorage` Singleton

**What goes wrong:**
The `originRegistry` in `packages/shell/src/origin-registry.ts` is a module-level singleton (`const registry = new Map<Window, OriginEntry>()`). The `aclStore` similarly reads and writes `localStorage` under a fixed key (`'napplet:acl'` as seen in `acl-enforcement.spec.ts`). When Playwright runs specs with `fullyParallel: true` (the current config), multiple test workers share the same browser profile and therefore the same `localStorage` namespace if they hit the same origin.

Even in serial mode (`test.describe.configure({ mode: 'serial' })`), if a test fails mid-run and the `afterEach` cleanup (`__aclClear__()` and `__clearLocalStorage__()`) does not execute (Playwright skips `afterEach` on hard process exit), the next test starts with poisoned `localStorage` state. The existing `acl-enforcement.spec.ts` does call `__aclClear__()` and `__clearLocalStorage__()` in `beforeEach` — this is the correct pattern — but it only works because those calls happen on a fresh page load (`page.goto('/')`) which re-creates the singleton maps in memory. If a test reuses a page across tests without a full navigate, the in-memory singleton is not reset.

**Why it happens:**
Module-level singletons (Map instances) in the harness bundle are not reset between Playwright tests within the same page. `page.goto('/')` creates a new JavaScript context, which re-executes the module and resets the Map. But `page.reload()` or continuing on the same page does NOT reset module-level state. The `originRegistry` and session registry in the shell's runtime instance persist for the lifetime of the page.

**How to avoid:**
- Always use `page.goto('/')` (not `page.reload()`) in `beforeEach` for specs that depend on clean ACL or session state. The harness re-initializes all singletons on navigation.
- The `beforeEach` pattern already in `acl-enforcement.spec.ts` — `goto('/') → waitForFunction(__SHELL_READY__) → __aclClear__() → __clearLocalStorage__()` — is canonical. New demo-functional specs must follow the same pattern exactly.
- For demo specs that start a Vite dev/preview server (`demo-audit-correctness.spec.ts` already does this), add explicit `localStorage.clear()` via `page.evaluate(() => localStorage.clear())` before each test, not just between describes.
- Do NOT rely on `fullyParallel: true` for any spec that touches `localStorage`. Either run demo specs in `mode: 'serial'` or use separate browser contexts per spec file (`use: { storageState: ... }` in per-file project config).

**Warning signs:**
- Tests pass individually (`--grep`) but fail when the full suite runs.
- ACL-01 passes but ACL-03 (which follows) fails with an unexpected `denied:` response — suggesting a previous test's revoke persisted.
- `__getLocalStorageItem__('napplet:acl')` returns non-null in `beforeEach` even after `__clearLocalStorage__()` was called in the previous test's `afterEach`.

**Phase to address:**
Playwright suite rewrite phase (triage + migration). Add a global `beforeEach` in the suite's `playwright.config.ts` or a shared test fixture that always calls `page.evaluate(() => localStorage.clear())` as the first step, before any test-specific setup.

---

### Pitfall 6: Test-Only Escape Hatches Leaking Into Production Builds

**What goes wrong:**
The harness (`tests/e2e/harness/harness.ts`) exposes `window.__SHELL_READY__`, `window.__loadNapplet__`, `window.__aclGrant__`, `window.__injectShellEvent__`, and 20+ other test globals on `window`. These are only present in the harness build and are correctly isolated in `tests/e2e/harness/`. However, the pattern creates a risk: if a demo app developer copies the harness initialization code into `apps/demo/src/` (to "get ACL controls working quickly"), those `window.__*` globals will be included in the production demo build.

Similarly, the `@kehto/shell` package exposes `bridge.runtime` (the `get runtime()` accessor on `ShellBridge`). In production, this provides advanced access to internals. In tests, it is used to directly manipulate `aclState` and `sessionRegistry`. If the demo app uses `bridge.runtime.aclState.grant(...)` directly (bypassing the consent and audit hooks) to implement its ACL panel UI, this is a test-only pattern masquerading as production code.

**Why it happens:**
The harness API is convenient — it solves the "how do I control the shell from a test" problem cleanly. Developers building the demo ACL panel face the same problem: "how do I let the user grant/revoke capabilities." The temptation is to import from the harness or replicate its `window.__*` pattern in the demo.

**How to avoid:**
- The demo's ACL panel must use the shell's public `ShellBridge` API exclusively (`bridge.publishTheme`, `bridge.registerConsentHandler`, `bridge.injectEvent`). For grant/revoke controls, the demo should expose these through a defined `ShellAdapter.acl` hook surface, NOT by accessing `bridge.runtime.aclState` directly.
- Add a build check: a simple `grep` in the build step asserting `window.__` does not appear in `apps/demo/dist/`.
- Keep `tests/e2e/harness/` in `pnpm-workspace.yaml` but ensure no `apps/demo` package has it as a dependency. The current workspace config already separates them — maintain this separation when adding new packages.
- When the demo needs "debug mode" UI (showing protocol message logs like `demo-node-inspector.spec.ts`), implement it as a first-class UI feature behind an env flag (`import.meta.env.DEV`), not by reading `window.__TEST_MESSAGES__`.

**Warning signs:**
- `apps/demo/package.json` gains `@test/harness` or a relative path to `tests/e2e/harness` as a dependency.
- `apps/demo/src/` files import from `../../tests/`.
- `window.__SHELL_READY__` is defined in the browser console when visiting the demo in production.

**Phase to address:**
Demo rewire phase (ACL panel implementation plan). Add a success criterion: "Demo build does not contain any `window.__` escape hatches; verify via `grep -r 'window\.__' apps/demo/dist/`."

---

### Pitfall 7: `changeset version` Dry-Run Fails When `@napplet/core` Is Unpublished

**What goes wrong:**
Running `changeset version` reads the workspace's changesets and attempts to update `package.json` versions and peer dependency ranges. When `@napplet/*` packages are linked via `pnpm.overrides` using the `link:` protocol, changesets does not know their npm version. If any kehto package has `@napplet/core` listed in `peerDependencies` with a range like `^0.1.0`, `changeset version` may attempt to bump this range to match a new version that does not exist on npm yet. The resulting `package.json` files contain version strings that cannot be resolved by downstream `npm install` or `pnpm install` without the same `link:` overrides — breaking any CI that runs without the local napplet repo.

The specific failure: changesets reads `peerDependencies["@napplet/core"]: "^0.1.0"` and emits it unchanged, but the `changelog` and bumped `package.json` reference a version that npm cannot resolve. This does not fail `changeset version` itself, but the resulting release artifacts are unpublishable until `@napplet/core` ships to npm with a compatible version.

**Why it happens:**
Changesets operates on the workspace packages it discovers, plus the version ranges in `package.json`. It does not validate that peer dep ranges are resolvable on npm — that is a publish-time concern. The `link:` override silently satisfies the dep locally, hiding the unresolvable range from the developer until `changeset publish` runs or a downstream consumer tries to install.

**How to avoid:**
- Before `changeset version`, run a deliberate check: `pnpm ls @napplet/core` and verify the linked version matches the peer dep range in every kehto package's `package.json`. If the linked version is `0.1.0-dev` and the peer dep range is `^0.1.0`, the publish would reference a non-existent npm package.
- After `changeset version`, run `pnpm install --frozen-lockfile` to catch any resolution errors introduced by the bumped versions. This will fail if the bumped peer dep range cannot be satisfied locally.
- Document in the release rehearsal plan: "`changeset publish` is intentionally deferred. The dry-run (`changeset version`) succeeds locally only because of `link:` overrides. Actual publish requires `@napplet/core` to be on npm first."
- Do not push `changeset version`-modified `package.json` files to the main branch until the upstream publish is confirmed. Stage them only for the release rehearsal review.

**Warning signs:**
- `changeset version` completes without errors but `pnpm install` after it fails with "No matching version found for @napplet/core@^X.Y.Z".
- Generated CHANGELOG.md references versions that do not match the linked napplet repo's current package.json version.
- `pnpm publish --dry-run` warns about peer dependency resolution failures.

**Phase to address:**
Release rehearsal phase (final phase of v1.3). Add explicit success criterion: "After `changeset version` dry-run, run `pnpm install --frozen-lockfile`. Document any resolution warnings rather than silently ignoring them."

---

### Pitfall 8: Build-Run-Fix Loop Anti-Patterns

**What goes wrong (three sub-patterns):**

**8a — Fixing the symptom, not the root cause.**
The iteration loop is: `pnpm build` → `pnpm preview` → Playwright run → read failure → fix → repeat. The failure visible to Playwright (e.g., "Element not found: #chat-status") is almost always a symptom. The root cause is typically one of: (a) the napplet's dist was not rebuilt after a code change, (b) the `shell.ready` handshake timed out silently, or (c) the ACL state in localStorage from a previous session poisoned the current test. Developers fix the Playwright assertion (loosening the timeout, adding a `.waitForSelector`) without diagnosing which of these three caused the symptom.

**8b — Ignoring console errors that precede the observable failure.**
The shell-bridge drops messages silently when `event.source` is not in `originRegistry` (`if (!windowId) return`). The napplet shim similarly drops messages when `event.origin` does not match expected patterns. Both are intentional security behaviors. But in the debug loop, a developer sees "message not received" and adds longer waits rather than checking whether the message was silently dropped upstream. The first console error in the sequence (e.g., `[nip5a-manifest] VITE_DEV_PRIVKEY_HEX not set`) or the first dropped message in the network inspector precedes the observable Playwright failure by seconds.

**8c — Not pinning which build artifact the test is running against.**
`pnpm test:e2e` calls `pnpm test:build` first (which runs `pnpm build` — turborepo, so it skips unchanged packages). If a napplet file changed but the napplet's package was not added to turbo's input set, turbo skips the rebuild. The test runs against stale dist. The symptom is "my code change had no effect."

**Why it happens:**
All three are variants of the same root cause: the feedback loop is long (build + preview start + Playwright run = 30-90 seconds) and developers optimize for speed by skipping steps or accepting partial information.

**How to avoid:**

For 8a: Before fixing any Playwright assertion, run the three-question diagnostic:
1. Is the napplet's dist up to date? (`ls -la apps/demo/napplets/*/dist/` — check mtime vs source mtime)
2. Is the shell-bridge receiving the `shell.ready` message? (Add `page.on('console', msg => console.log(msg.text()))` to the failing test to surface `[harness]` log lines)
3. Is localStorage clean? (`await page.evaluate(() => localStorage.clear())` at test start)

For 8b: Add `page.on('console', ...)` and `page.on('pageerror', ...)` listeners in the shared test setup fixture. Any console error in the iframe or the shell host during a failing test is logged before the Playwright assertion failure. Treat the first console error as the primary failure, not the Playwright timeout.

For 8c: Add napplet source directories to turbo's input configuration explicitly. Until that is done, run `pnpm build --force` when any napplet source changes, not the default `pnpm build`.

**Warning signs:**
- Playwright retry count climbs (`retries: 2` catches an intermittent failure) — intermittency is almost always a timing issue masking a deterministic root cause.
- The fix to a Playwright failure is a timeout increase or a `.waitForTimeout()` addition — this suppresses the symptom without identifying the cause.
- The same test failure appears again two iterations later with a different error message — the root cause was not fixed, only a downstream symptom.

**Phase to address:**
Every phase that includes a "build → run → Playwright → fix" loop. Add to each phase's iteration discipline section: "Before any fix, run the three-question diagnostic. Log the console output of failing tests before reading the Playwright assertion error."

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using `window.__KEHTO_RUNTIME__` in demo code | Easy debug access to runtime internals from browser console | Escape hatch in production; bypasses consent/audit hooks; signals to future maintainers that direct runtime access is acceptable | Never — use `ShellBridge` public API |
| Using `page.waitForTimeout(N)` in Playwright specs | Stops flakiness quickly | Masks timing bugs; makes suite slow; N drifts upward over time | Only as temporary diagnostic tool — remove before merge |
| Running `pnpm dev` (not `pnpm build + preview`) for demo testing | Faster iteration | Misses build-mode differences (aggregateHash empty, module resolution differs, HMR state differs) | Local development iteration only — never for spec writing |
| Hardcoding `aggregateHash` values in test assertions | Test is simple to write | Breaks on any napplet file change; silently passes with stale hash | Never |
| Adding `allow-same-origin` to iframe sandbox for easier Playwright frame access | Playwright `frameLocator` works without complex waits | Breaks the security model — napplet can access shell's localStorage/cookies | Never |
| Using `srcdoc` to load napplets instead of `src=` URL | Avoids serving infrastructure | `event.origin` is `"null"` on both sides; breaks any origin-keyed logic; napplet cannot load ES module imports | Test fixtures only — not demo app |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Playwright + sandboxed iframe | Using `page.frames()` to find the frame — returns empty for opaque-origin iframes not yet navigated | Use `page.frameLocator(selector)` and add a guard that waits for a sentinel element inside the frame |
| Vite preview + napplet serve middleware | Forgetting `configurePreviewServer` — only `configureServer` is added | The `serveDemoNapplets()` plugin already handles both; verify new plugins do the same |
| pnpm link: overrides + TypeScript | `tsconfig.json` `paths` not aligned with `pnpm.overrides` — type-check succeeds but runtime resolution fails | Verify `paths` in root `tsconfig.json` mirrors every entry in `pnpm.overrides` |
| `@napplet/vite-plugin` + turborepo | Turbo caches napplet builds; changing vite-plugin source does not invalidate the cache | Add `@napplet/vite-plugin` source to turbo's `inputs` for napplet build tasks |
| Changesets + unpublished peer dep | `changeset version` rewrites version ranges silently | Run `pnpm install --frozen-lockfile` after `changeset version` to surface resolution errors |
| Playwright MCP + headed Chromium | MCP runs Playwright headless; DevTools timeline is unavailable | Use `page.on('console', ...)` for in-test debugging instead of DevTools |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `fullyParallel: true` with shared `localhost:4173` Vite server | Tests interfere via shared state (localStorage, in-memory singletons) | Run demo specs in `mode: 'serial'`; use `webServer.reuseExistingServer` carefully | Immediately when two workers run ACL tests concurrently |
| Each Playwright spec starts its own Vite server (like `demo-audit-correctness.spec.ts`) | Suite startup time grows proportional to spec count | Hoist server lifecycle to `globalSetup` / `globalTeardown` using `playwright.config.ts` `globalSetup` option | Beyond 5-10 specs that each need a server |
| Building all napplets on every `pnpm test:e2e` run | Slow CI feedback (all napplets rebuild even if unchanged) | Configure turbo inputs precisely; use turbo's remote cache | From the first run — already slow |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Adding `allow-same-origin` to napplet iframe sandbox | Napplet can access shell's localStorage, cookies, and DOM — full privilege escalation | Never add `allow-same-origin` to sandbox attribute for untrusted napplets; Playwright frame introspection works without it via CDP |
| Posting `shell.init` with `targetOrigin: iframeOrigin` instead of `'*'` | `targetOrigin` check fails for opaque-origin iframes (origin = `"null"`), so message is dropped | Always use `'*'` as target origin when posting to sandboxed iframes — the shell-bridge already does this correctly; do not "fix" it |
| Exposing `bridge.runtime.aclState` in demo UI for user manipulation | Demo users can grant arbitrary capabilities to themselves via browser console | ACL mutations must go through consent-gated hooks on `ShellAdapter`; expose a read-only `aclState` view at most |
| Using `event.origin` to validate napplet identity | `event.origin === "null"` for all sandboxed iframes; trivially spoofable for same-origin iframes | Use `event.source` (Window reference) via `originRegistry.getWindowId()` — the existing shell-bridge does this correctly |

## "Looks Done But Isn't" Checklist

- [ ] **Demo napplet handshake:** Napplet appears in iframe and loads HTML — but has `shell.ready` been sent AND `shell.init` received? Verify via `__TEST_MESSAGES__` or network inspector.
- [ ] **ACL panel:** Revoke button updates ACL state in memory — but does it persist via `aclStore.persist()`? And does it reload correctly after page refresh? Verify via `__getLocalStorageItem__('napplet:acl')` before and after.
- [ ] **Playwright spec isolation:** New spec calls `__aclClear__()` in `beforeEach` — but does it also call `__clearLocalStorage__()`? Both are required; the first clears in-memory state, the second clears the persistence layer.
- [ ] **Napplet build:** `dist/` directory exists for every napplet loaded by demo or harness — but does it contain the correct `napplet-aggregate-hash` meta tag (non-empty)? Verify via `grep napplet-aggregate-hash apps/demo/napplets/*/dist/index.html`.
- [ ] **Vite preview server middleware:** `configurePreviewServer` is defined in addition to `configureServer` for any custom plugin — otherwise napplets 404 in preview mode. The existing `serveDemoNapplets` plugin handles this; verify any new plugins follow the same pattern.
- [ ] **frameLocator readiness:** Playwright spec uses `frameLocator(...)` and immediately queries an element — but has the spec added a wait for a sentinel element inside the frame to confirm it is ready?
- [ ] **Changeset dry-run:** `changeset version` completed without errors — but was `pnpm install --frozen-lockfile` run afterward? And were the resulting version changes reviewed for unresolvable `@napplet/*` ranges?

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Playwright frameLocator timing failures in CI | LOW | Add `waitForNappletReady()` helper; replace all naked `frameLocator().locator()` calls with helper-gated versions |
| ACL state bleed between tests | LOW | Add `localStorage.clear()` to global Playwright `beforeEach` fixture; run `pnpm test:e2e --grep failing-spec` in isolation to confirm fix |
| Dev/preview drift (empty aggregateHash) | LOW | Force rebuild: `pnpm --filter @kehto/demo-bot build && pnpm --filter @kehto/demo-chat build`; re-run `pnpm preview` |
| pnpm symlink deduplication creating two `@napplet/core` instances | MEDIUM | `pnpm dedupe`; then `pnpm ls @napplet/core --depth 5` to confirm single instance; may require clearing `.pnpm` store |
| Test-only escape hatches in demo build | MEDIUM | `grep -r 'window\.__' apps/demo/dist/`; trace the import; refactor to use `ShellBridge` public API |
| `changeset version` producing bad peer dep ranges | LOW | Revert the `package.json` changes; document the expected final state; do not push until upstream is published |
| Iteration loop cycles without fixing root cause | HIGH (time) | Stop the loop; instrument the test with `page.on('console', ...)` and read the first error; fix root cause before resuming |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| frameLocator timing on sandboxed iframes | Demo spec scaffolding (first Playwright plan) | `waitForNappletReady()` helper exists and is used in all frame-touching specs |
| postMessage origin mismatch in sandboxed iframes | Napplet showcase expansion (first new napplet plan) | Every new napplet's `shell.ready` confirmed within 2s via assertion |
| Vite dev vs preview aggregateHash drift | Demo rewire (first plan, setup verification) | `pnpm test:e2e` runs against `vite preview`; all hashes non-empty |
| pnpm symlink deduplication | Demo rewire (setup verification step) | `pnpm ls @napplet/core --depth 5` shows single instance |
| ACL state bleed between tests | Playwright suite rewrite (triage plan) | Global `beforeEach` in place; suite runs clean in `--repeat-each 3` |
| Test-only escape hatches in demo build | Demo ACL panel plan | `grep -r 'window\.__' apps/demo/dist/` returns no matches |
| `changeset version` peer dep dry-run issues | Release rehearsal phase | `pnpm install --frozen-lockfile` passes after `changeset version`; discrepancies documented |
| Iteration loop anti-patterns | Every phase with build-run-fix loop | Phase plan includes "three-question diagnostic" and `page.on('console')` requirement before any fix |

## Sources

- Direct codebase analysis: `tests/e2e/harness/harness.ts` — singleton pattern, `originRegistry` module-level map, test globals pattern, iframe sandbox attribute (`allow-scripts` only, no `allow-same-origin`)
- Direct codebase analysis: `packages/shell/src/origin-registry.ts` — module-level singleton registry, `event.source`-based identity
- Direct codebase analysis: `packages/shell/src/shell-bridge.ts` — `postMessage(msg, '*')` wildcard pattern, `shell.ready` handling, `bridge.runtime` accessor
- Direct codebase analysis: `packages/runtime/src/session-registry.ts` — factory pattern (not singleton), `(pubkey, dTag, aggregateHash)` keying
- Direct codebase analysis: `apps/demo/vite.config.ts` — `configurePreviewServer` present alongside `configureServer`; napplet serve middleware
- Direct codebase analysis: `tests/e2e/harness/vite.config.ts` — CORS headers for sandboxed iframe script loading
- Direct codebase analysis: `/home/sandwich/Develop/napplet/packages/vite-plugin/src/index.ts` — `closeBundle` only fires in build mode; `transformIndexHtml` emits empty `aggregateHash` in dev
- Direct codebase analysis: root `package.json` `pnpm.overrides` — 8 `link:` entries pointing to `/home/sandwich/Develop/napplet/packages/*`
- Direct codebase analysis: `playwright.config.ts` — `fullyParallel: true`, `baseURL: 'http://localhost:4173'`, `webServer` points to harness dev server
- Direct codebase analysis: `tests/e2e/acl-enforcement.spec.ts` — `beforeEach` ACL reset pattern; localStorage isolation approach
- Direct codebase analysis: `tests/e2e/demo-audit-correctness.spec.ts` — per-spec Vite server spawning via `beforeAll`; `frameLocator` usage without explicit frame-ready guards
- Playwright documentation: frame locator behavior with sandboxed iframes and opaque origins (Chromium exposes sandboxed frames via CDP after navigation commits, not at insertion)

---
*Pitfalls research for: kehto v1.3 Demo + Playwright iframe-sandboxed Nostr runtime*
*Researched: 2026-04-18*
