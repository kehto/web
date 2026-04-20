# Phase 31: E2E Coverage + Milestone Iteration Loop - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning
**Mode:** Smart-discuss batch acceptance (user accepted all 3 grey-area recommendations)

<domain>
## Phase Boundary

Close v1.5 by shipping two new Layer-B Playwright specs that lock the DEMO-01/02 and UI-01/02/03 fixes from Phases 29 + 30 in CI, then run the canonical milestone iteration loop and close the phase with anti-term hygiene evidence.

- **E2E-15** — `tests/e2e/demo-concurrent-boot.spec.ts`: load `:4174` demo, poll all 10 napplets' status sentinels, assert each reaches `authenticated` within 10s. Guards DEMO-01 from regressing. Also serves as a smoke gate for DEMO-02 (if media-controller authenticates, downstream play/pause wiring is healthy).
- **E2E-16** — `tests/e2e/shell-ui-state-surfaces.spec.ts`: 3 tests asserting (a) at least 3 service nodes show non-zero `ACTIVITY` counters after boot traffic, (b) ACL Capability Matrix modal renders ≥ 10 authenticated-napplet rows with no "No authenticated napplets" fallback, (c) debugger Sequence Diagram renders ≥ 4 lanes. Guards UI-01/02/03.
- **Milestone iteration loop** — `pnpm clean && pnpm build && pnpm test:e2e` records 49 → 51 spec-count delta (+2 new files). Anti-term hygiene grep sweep across v1.5-touched files + new spec files; 0 real violations expected.

Out of scope:
- New napplets — v1.4 landed the 10th; v1.5 doesn't add an 11th.
- Protocol-level changes — v1.2 remains canonical.
- Automated visual regression testing (pixel screenshots) — out of v1.5 scope.
- Retiring `demo-boot.spec.ts` — it still validates different assertions (STUB_ONLY_SERVICES=[] + 8 service nodes); don't consolidate.

</domain>

<decisions>
## Implementation Decisions

### Area 1: E2E-15 Concurrent-Boot Spec Structure (ACCEPTED)

- **File layout** — single spec file `tests/e2e/demo-concurrent-boot.spec.ts`. Follows `demo-boot.spec.ts` / `demo-debugger.spec.ts` naming convention. Uses `test.use({ baseURL: 'http://localhost:4174' })` + `demoBeforeEach(page)` like siblings. Serial mode (`test.describe.configure({ mode: 'serial' })`).
- **Assertion mechanism** — single test that polls all 10 napplet status sentinels via `page.evaluate()`. Technique:
  ```ts
  const NAPPLETS = [
    { name: 'bot',             statusId: 'bot-status' },
    { name: 'chat',            statusId: 'chat-status' },
    { name: 'composer',        statusId: 'composer-status' },
    { name: 'feed',            statusId: 'feed-status' },
    { name: 'hotkey-chord',    statusId: 'hotkey-chord-status' },
    { name: 'media-controller', statusId: 'media-controller-status' },
    { name: 'preferences',     statusId: 'preferences-status' },
    { name: 'profile-viewer',  statusId: 'profile-status' },
    { name: 'theme-switcher',  statusId: 'theme-status' },
    { name: 'toaster',         statusId: 'toaster-status' },
  ];

  await expect.poll(async () => {
    return await page.evaluate((napplets) => {
      const out = {};
      for (const n of napplets) {
        const el = document.getElementById(n.statusId);
        out[n.name] = el ? el.textContent.trim() : 'MISSING';
      }
      return out;
    }, NAPPLETS);
  }, { timeout: 10_000, intervals: [250, 500, 1000] }).toMatchObject(
    Object.fromEntries(NAPPLETS.map(n => [n.name, 'authenticated']))
  );
  ```
- **Napplet list source** — hardcoded in the spec. Matches `shell-host.ts:DEMO_NAPPLETS` exactly. Note the statusId naming quirk: `profile-viewer` → `profile-status`, `theme-switcher` → `theme-status` (not `profile-viewer-status` / `theme-switcher-status`). Verified during Phase 29 UAT; preserved here.
- **Failure reporting** — `expect.poll().toMatchObject()` displays the full diff of actual vs expected on fail. A missing/stalled napplet will appear as `expected 'authenticated', got 'loading…' or 'MISSING'` — immediately pinpointing which napplet regressed.

### Area 2: E2E-16 Shell-UI State-Surface Spec Structure (ACCEPTED)

- **File layout** — single spec file `tests/e2e/shell-ui-state-surfaces.spec.ts` with 3 named tests inside a describe block:
  - `'service activity counters tick on NUB traffic (UI-01)'`
  - `'ACL Capability Matrix lists all authenticated napplets (UI-02)'`
  - `'Sequence Diagram renders a lane for each authenticated napplet (UI-03)'`

- **UI-01 assertion**:
  ```ts
  await expect.poll(async () => {
    return await page.evaluate(() => {
      const extract = (id) => {
        const el = document.getElementById(id);
        const match = el?.innerText?.match(/activity:\s*(\d+)\s*recent/i);
        return match ? Number(match[1]) : -1;
      };
      return {
        storage: extract('topology-node-service-storage'),
        relay: extract('topology-node-service-relay'),
        identity: extract('topology-node-service-identity'),
      };
    });
  }, { timeout: 10_000 }).toEqual(
    expect.objectContaining({
      storage: expect.any(Number), // matched below
      relay: expect.any(Number),
      identity: expect.any(Number),
    })
  );
  // Separate assertion: each number ≥ 1
  ```
  Actual implementation may use three `expect.poll().toBeGreaterThanOrEqual(1)` calls for clarity. Services chosen: storage (10+ storage.get on boot), relay (4+ relay.subscribe), identity (4+ identity.getPublicKey).

- **UI-02 assertion**:
  1. Click `#topology-node-acl` to open inspector.
  2. Click the `button` inside inspector whose text matches `/open policy matrix/i`.
  3. Poll for `#acl-policy-modal` to exist.
  4. Count rows in `#acl-policy-modal tbody tr` → `toBeGreaterThanOrEqual(10)`.
  5. Assert no `td[colspan]` with text `"No authenticated napplets"` is present.
  6. Extract first-column text of each row; assert set equals the 10 expected napplet names.
  7. Cleanup: remove the modal or click its Close button to avoid DOM leak into subsequent tests.

- **UI-03 assertion**:
  1. Click the Sequence tab via the debugger shadow root. Playwright pierces Shadow DOM in locators: `page.locator('#debugger [data-tab="sequence"]')` works if the `data-tab` attribute is exposed; otherwise use `page.evaluate()` to drill into `document.getElementById('debugger').shadowRoot.querySelector('[data-tab="sequence"]').click()`.
  2. Wait for `#debugger sequence-container svg` to exist via `page.evaluate()` + `expect.poll()`.
  3. Extract lane header text via `page.evaluate()` — read `text` elements near the top of the SVG (y-coord < 30 typically).
  4. Assert lane set includes `'Shell'` AND includes at least 3 napplet names.
  5. Assert full lane set equals the 11 expected entries (10 napplets + Shell) in alphabetical-split order.

- **Shadow-DOM piercing caveat**: Playwright's locator API pierces Shadow DOM transparently for most selectors BUT `querySelector` inside `page.evaluate()` does NOT — use the shadow-root-drill pattern explicitly. Phase 30 UAT confirmed this approach works (`document.getElementById('debugger').shadowRoot.getElementById('sequence-container')`).

### Area 3: Plan Structure + Milestone Iteration Loop (ACCEPTED)

- **2 plans** in 1 parallel wave:
  - `31-01-PLAN.md` (E2E-15) — wave 1, depends_on: []. Files: `tests/e2e/demo-concurrent-boot.spec.ts` (new).
  - `31-02-PLAN.md` (E2E-16 + iteration loop + anti-term sweep) — wave 1, depends_on: []. Files: `tests/e2e/shell-ui-state-surfaces.spec.ts` (new) + `.planning/phases/31-.../31-ITERATION-LOG.md` (new).

- **Parallelization guarantee** — zero file overlap between the 2 plans. 31-01 touches only demo-concurrent-boot.spec.ts; 31-02 touches only shell-ui-state-surfaces.spec.ts + the iteration log. Safe for parallel execution.

- **Iteration loop lives in 31-02** (last-plan convention from Phase 26/27):
  ```bash
  pnpm clean && pnpm build 2>&1 | tee /tmp/phase31-build.log
  pnpm test:e2e 2>&1 | tee /tmp/phase31-e2e.log
  ```
  Expected: build 22/22 clean; e2e 51 passed / 0 failed / 0 skipped.

- **Spec-count delta**: 49 → 51 (+2 new files). Playwright baselines by spec file name in this project (v1.3 baseline was "47 specs / 26 active files"). Each new `.spec.ts` = +1 to the count regardless of inner test count. If observed count differs (e.g., Playwright counts tests not files), document the actual number in the iteration log — don't force a hardcoded number.

- **Anti-term hygiene grep sweep (milestone gate)** — 31-02's iteration log records grep results across:
  ```bash
  grep -rnE "window\.nostr|signer-service|signer\.sign|BusKind|kind === ?2900[12]|core-compat" \
    apps/demo/src/{main,shell-host,node-details,sequence-diagram,debugger}.ts \
    tests/e2e/demo-concurrent-boot.spec.ts \
    tests/e2e/shell-ui-state-surfaces.spec.ts
  ```
  Expected: 0 real violations. Documented false-positives from Phase 28 (JSDoc migration notes, `signer.sign` over-match on legit NIP-46 signer calls) remain acceptable.

- **Milestone-audit handoff** — per autonomous workflow, after Phase 31 verification passes, the lifecycle step runs `gsd:audit-milestone v1.5` → `gsd:complete-milestone v1.5` → `gsd:cleanup`. Phase 31 does NOT duplicate audit scope.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `tests/e2e/helpers/demo-before-each.ts` — canonical setup: navigates to `http://localhost:4174`, waits for initial render. Reuse.
- `tests/e2e/demo-boot.spec.ts` — structural template for a `:4174`-baseURL spec. Uses `test.use({ baseURL })`, `demoBeforeEach(page)`, `ANTI_TERM_RE`, serial describe mode. Mirror this shape.
- `tests/e2e/demo-debugger.spec.ts` — precedent for asserting debugger shadow-root contents. Useful reference for UI-03 test.
- Phase 29 `29-02-DIAGNOSTIC.md` — documents the statusId naming quirks (profile-viewer → profile-status; theme-switcher → theme-status). Cite when writing E2E-15.
- Phase 30 `30-ITERATION-LOG.md` — documents the ACL modal interaction path (topology-node-acl → inspector → "Open Policy Matrix" button → acl-policy-modal). Cite when writing E2E-16.

### Established Patterns

- `baseURL: 'http://localhost:4174'` for demo-driven specs.
- `ANTI_TERM_RE` grep pattern watches console output for hygiene violations.
- Serial describe mode avoids cross-test contamination.
- `expect.poll()` for UI state that settles over time (AUTH flows, NUB traffic bursts).
- Shadow-DOM access via `page.evaluate(() => document.getElementById('debugger').shadowRoot...)`.
- `demoBeforeEach(page)` navigates + waits for shell boot (not per-napplet AUTH) — no `__loadNapplet__` call (multi-napplet context).

### Integration Points

- `tests/e2e/demo-concurrent-boot.spec.ts` — new file (E2E-15).
- `tests/e2e/shell-ui-state-surfaces.spec.ts` — new file (E2E-16).
- `.planning/phases/31-.../31-ITERATION-LOG.md` — new file.
- No changes to harness, helpers, or any shell/runtime/napplet source — spec-only phase.

</code_context>

<specifics>
## Specific Ideas

- **Timeout choice for E2E-15 poll**: 10 seconds. Phase 29's manual UAT showed all 10 napplets auth within 8s on the dev workstation; CI on ubuntu-latest is typically comparable or slightly slower. 10s gives headroom without bloating CI time.
- **E2E-15 failure diagnostic**: if the spec fails, the `toMatchObject` diff will show WHICH napplet(s) didn't reach `'authenticated'`. Example regression-output:
  ```
  Expected: { bot: 'authenticated', chat: 'authenticated', ..., media-controller: 'authenticated' }
  Received: { bot: 'authenticated', chat: 'authenticated', ..., media-controller: 'loading…' }
  ```
- **E2E-16 modal cleanup between tests**: UI-02 test opens the ACL modal; UI-03 test would be polluted if the modal stayed open. Add an `afterEach` that removes `#acl-policy-modal` if present.
- **Playwright test count reporting**: on this project, past iteration logs (26-ITERATION-LOG.md "47 → 48") track file count not inner-test count. E2E-16 has 3 tests but counts as 1 file. Final expected: 49 → 51.
- **Anti-term false-positive classification** (Phase 28 precedent): categories documented in `.planning/milestones/v1.4-phases/28-.../28-ITERATION-LOG.md` — JSDoc migration text, `signer.signEvent` in NIP-46 signer code, spec-docblock anti-feature references. New 31-02 iteration log should reference that file's classification rather than re-derive.

</specifics>

<deferred>
## Deferred Ideas

- **Visual regression testing** (pixel screenshots of ACL matrix, sequence diagram) — out of v1.5 scope.
- **Parallel-worker stability tests** — Phase 27's `page.bringToFront()` pattern already addresses iframe-click throttling under parallel workers; no additional hardening needed.
- **Cross-browser matrix** — v1.5 runs on Chromium only (Playwright default); multi-browser is v1.6+.
- **PERF-01 chat storage batching** — deferred to v1.6.

</deferred>
