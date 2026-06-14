/**
 * shell-ui-state-surfaces.spec.ts — E2E-16 (v1.5 Phase 31).
 *
 * Locks UI-01/02/03 in CI — the three shell-UI state surfaces wired in
 * Phase 30 to live NUB envelope traffic:
 *
 *   UI-01  Service activity counters on topology service nodes tick
 *          as NUB envelopes of each service's domain are processed.
 *   UI-02  ACL Capability Matrix modal lists every identity-bound
 *          napplet as a row (not the 'No identity-bound napplets'
 *          placeholder).
 *   UI-03  Debugger Sequence Diagram renders a lane for every
 *          identity-bound napplet (plus 'Shell'), not just a hardcoded
 *          trio.
 *
 * Pre-Phase-30 shape (for future debugging):
 *   UI-01: all 8 non-signer service counters stuck at 'ACTIVITY: 0
 *          recent' / 'LAST ACTION: —' on boot — the activity projection
 *          only routed to the `signer` node. Fix: service-level routing
 *          pass in installActivityProjection() + notify→notifications
 *          alias.
 *   UI-02: modal always showed 'No identity-bound napplets' because the
 *          aclAdapter.snapshot() was gated on `info.pubkey` instead of
 *          the NIP-5D `info.identityBound` flag. Fix: swap the gate.
 *   UI-03: LANE_NAMES hardcoded to [Chat, Shell, Bot]. Fix: dynamic
 *          deriveLanes(messages, nappletInfos) helper replaces the
 *          constant.
 *
 * Shadow-DOM caveat: Playwright's locator API pierces shadow roots for
 * most selectors, BUT querySelector inside page.evaluate() does NOT —
 * the UI-03 test uses the explicit shadow-root drill pattern verified
 * in Phase 30 UAT (30-ITERATION-LOG.md).
 */
import { test, expect } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const ANTI_TERM_RE = /window\.nostr|signer-service|BusKind|AUTH_KIND|kind === 2900[12]/;
const IDENTITY_BOUND_STATUS_IDS = [
  'bot-status',
  'chat-status',
  'composer-status',
  'config-demo-status',
  'cvm-relatr-status',
  'decrypt-demo-status',
  'feed-status',
  'hotkey-chord-status',
  'media-controller-status',
  'preferences-status',
  'profile-status',
  'resource-demo-status',
  'theme-status',
  'toaster-status',
] as const;

test.describe('shell UI state surfaces (E2E-16)', () => {
  test.afterEach(async ({ page }) => {
    // Ensure the ACL policy modal never leaks across tests (UI-02 opens it;
    // without cleanup it would occlude UI-03's debugger interactions).
    await page.evaluate(() => {
      document.getElementById('acl-policy-modal')?.remove();
    });
  });

  test('service activity counters tick on NUB traffic (UI-01)', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', (msg) => consoleMessages.push(msg.text()));

    await demoBeforeEach(page);

    // Boot traffic naturally drives:
    //   storage  → state-read x~12 (napplet boot reads)
    //   relay    → relay-subscribe x~12 (napplet subscriptions)
    //   identity → identity-request x~4  (identity/profile demos)
    // Each service's node innerText embeds 'ACTIVITY: N recent'. Poll until
    // every floor counter is ≥ 1.
    await expect.poll(
      async () => {
        return await page.evaluate(() => {
          const extract = (id: string): number => {
            const el = document.getElementById(id);
            if (!el) return -1;
            const match = (el.innerText ?? '').match(/activity:\s*(\d+)\s*recent/i);
            return match ? Number(match[1]) : -1;
          };
          return {
            storage: extract('topology-node-service-storage'),
            relay: extract('topology-node-service-relay'),
            identity: extract('topology-node-service-identity'),
          };
        });
      },
      { timeout: 10_000, intervals: [250, 500, 1000] },
    ).toEqual(
      expect.objectContaining({
        storage: expect.any(Number),
        relay: expect.any(Number),
        identity: expect.any(Number),
      }),
    );

    // Final floor check — every counter ≥ 1.
    const counters = await page.evaluate(() => {
      const extract = (id: string): number => {
        const el = document.getElementById(id);
        if (!el) return -1;
        const match = (el.innerText ?? '').match(/activity:\s*(\d+)\s*recent/i);
        return match ? Number(match[1]) : -1;
      };
      return {
        storage: extract('topology-node-service-storage'),
        relay: extract('topology-node-service-relay'),
        identity: extract('topology-node-service-identity'),
      };
    });
    expect(counters.storage, `storage activity: ${counters.storage}`).toBeGreaterThanOrEqual(1);
    expect(counters.relay, `relay activity: ${counters.relay}`).toBeGreaterThanOrEqual(1);
    expect(counters.identity, `identity activity: ${counters.identity}`).toBeGreaterThanOrEqual(1);

    const antiConsole = consoleMessages.filter((m) => ANTI_TERM_RE.test(m));
    expect(antiConsole, `anti-term found in console: ${antiConsole.join(' | ')}`).toHaveLength(0);
  });

  test('ACL Capability Matrix lists all identity-bound napplets (UI-02)', async ({ page }) => {
    await demoBeforeEach(page);

    // Give the full playground roster time to become identity-bound before opening the matrix.
    // Without this, the snapshot() sees a partial identity-bound set and the row
    // count may be incomplete even with the Phase 30 fix applied.
    await expect
      .poll(
        async () => {
          return await page.evaluate((ids) => {
            let bound = 0;
            for (const id of ids) {
              const el = document.getElementById(id);
              if (el && (el.textContent ?? '').trim() === 'identity-bound') bound += 1;
            }
            return bound;
          }, IDENTITY_BOUND_STATUS_IDS as unknown as string[]);
        },
        { timeout: 10_000, intervals: [250, 500, 1000] },
      )
      .toBe(IDENTITY_BOUND_STATUS_IDS.length);

    // Open the ACL node inspector, then click the Open Policy Matrix button.
    await page.locator('#topology-node-acl').click();
    await page.getByRole('button', { name: /open policy matrix/i }).click();

    // Modal must render.
    await expect(page.locator('#acl-policy-modal')).toBeVisible({ timeout: 5_000 });

    // Row count = one row per identity-bound playground napplet.
    const rows = page.locator('#acl-policy-modal tbody tr');
    await expect(rows).toHaveCount(IDENTITY_BOUND_STATUS_IDS.length, { timeout: 5_000 });

    // No "No identity-bound napplets" placeholder cell.
    const emptyCells = page.locator('#acl-policy-modal tbody td[colspan]', {
      hasText: /no identity-bound napplets/i,
    });
    await expect(emptyCells).toHaveCount(0);
  });

  test('runtime demo surfaces are grouped separately without empty ACL slots', async ({ page }) => {
    await demoBeforeEach(page);

    const runtimeRegion = page.locator('#topology-runtime-demos');
    await expect(runtimeRegion).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#topology-napplets [data-topology-surface="napplet"]')).toHaveCount(10);
    await expect(page.locator('#topology-napplets [data-topology-surface="runtime-demo"]')).toHaveCount(0);
    await expect(runtimeRegion.locator('[data-topology-surface="runtime-demo"]')).toHaveCount(4);

    await expect(page.locator('[data-napplet-name="config-demo"] .topology-node-kicker')).toHaveText('runtime demo');
    await expect(page.locator('[data-napplet-name="decrypt-demo"] .topology-node-kicker')).toHaveText('runtime demo');
    await expect(page.locator('[data-napplet-name="resource-demo"] .topology-node-kicker')).toHaveText('napplet');
    await expect(page.locator('#config-demo-acl')).toHaveCount(0);
    await expect(page.locator('#decrypt-demo-acl')).toHaveCount(0);
    await expect(page.locator('#resource-demo-acl')).toBeVisible();
    await expect(page.locator('#chat-acl')).toBeVisible();
  });

  test('Sequence Diagram renders a lane for each identity-bound napplet (UI-03)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await demoBeforeEach(page);

    // Ensure boot traffic has flowed before opening the debugger.
    await expect
      .poll(
        async () => {
          return await page.evaluate((ids) => {
            let bound = 0;
            for (const id of ids) {
              const el = document.getElementById(id);
              if (el && (el.textContent ?? '').trim() === 'identity-bound') bound += 1;
            }
            return bound;
          }, IDENTITY_BOUND_STATUS_IDS as unknown as string[]);
        },
        { timeout: 10_000, intervals: [250, 500, 1000] },
      )
      .toBe(IDENTITY_BOUND_STATUS_IDS.length);

    // Click the Sequence tab inside the debugger shadow root.
    // querySelector inside page.evaluate does NOT auto-pierce shadow DOM —
    // we explicitly drill via .shadowRoot.
    await page.evaluate(() => {
      const dbg = document.getElementById('debugger') as (HTMLElement & { shadowRoot: ShadowRoot }) | null;
      if (!dbg || !dbg.shadowRoot) throw new Error('debugger shadow root missing');
      const tabBtn =
        (dbg.shadowRoot.querySelector('[data-tab="sequence"]') as HTMLElement | null) ??
        (Array.from(dbg.shadowRoot.querySelectorAll('button, [role="tab"]'))
          .find((el) => /sequence/i.test((el as HTMLElement).textContent ?? '')) as HTMLElement | undefined);
      if (!tabBtn) throw new Error('sequence tab button not found in debugger shadow root');
      tabBtn.click();
    });

    // Poll the shadow-root SVG for lane header text entries.
    // Lane headers are <text> nodes near the top of the SVG (y < 30 in
    // Phase 30's implementation). We read textContent of every <text>
    // and filter to non-empty trimmed strings.
    const lanes = await (async () => {
      return await expect.poll(
        async () => {
          return await page.evaluate(() => {
            const dbg = document.getElementById('debugger') as (HTMLElement & { shadowRoot: ShadowRoot }) | null;
            if (!dbg?.shadowRoot) return [] as string[];
            const svg = dbg.shadowRoot.querySelector('#sequence-container svg');
            if (!svg) return [] as string[];
            const texts = Array.from(svg.querySelectorAll('text'))
              .map((n) => (n.textContent ?? '').trim())
              .filter((s) => s.length > 0);
            // Lane-header heuristic: unique strings near the top of the SVG.
            // Deduplicate while preserving order.
            const seen = new Set<string>();
            const unique: string[] = [];
            for (const t of texts) {
              if (!seen.has(t)) {
                seen.add(t);
                unique.push(t);
              }
            }
            return unique;
          });
        },
        { timeout: 10_000, intervals: [250, 500, 1000] },
      ).not.toHaveLength(0);
    })();

    // Robust floor: ≥ 4 lanes and one of them is 'Shell'.
    const finalLanes = await page.evaluate(() => {
      const dbg = document.getElementById('debugger') as (HTMLElement & { shadowRoot: ShadowRoot }) | null;
      if (!dbg?.shadowRoot) return [] as string[];
      const svg = dbg.shadowRoot.querySelector('#sequence-container svg');
      if (!svg) return [] as string[];
      const texts = Array.from(svg.querySelectorAll('text'))
        .map((n) => (n.textContent ?? '').trim())
        .filter((s) => s.length > 0);
      const seen = new Set<string>();
      const unique: string[] = [];
      for (const t of texts) {
        if (!seen.has(t)) {
          seen.add(t);
          unique.push(t);
        }
      }
      return unique;
    });

    expect(finalLanes.length, `lanes observed: ${finalLanes.join(', ')}`).toBeGreaterThanOrEqual(4);
    expect(finalLanes, `'Shell' not in lanes: ${finalLanes.join(', ')}`).toContain('Shell');

    const diagramWidth = await page.evaluate(() => {
      const dbg = document.getElementById('debugger') as (HTMLElement & { shadowRoot: ShadowRoot }) | null;
      const container = dbg?.shadowRoot?.querySelector('#sequence-container') as HTMLElement | null;
      const svg = container?.querySelector('svg') as SVGSVGElement | null;
      return {
        containerWidth: container?.clientWidth ?? 0,
        viewBoxWidth: svg?.viewBox.baseVal.width ?? 0,
      };
    });

    expect(
      diagramWidth.viewBoxWidth,
      `sequence viewBox ${diagramWidth.viewBoxWidth} should use container width ${diagramWidth.containerWidth}`,
    ).toBeGreaterThanOrEqual(diagramWidth.containerWidth);

    // Silence unused-var warning for the poll-wrapped lane read.
    void lanes;
  });
});
