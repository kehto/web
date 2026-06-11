/**
 * E2E-26 (v1.7 Phase 41 / Plan 41-04 / NIP66-07) — NIP-66 demo suggestions panel.
 *
 * Phase 41 (v1.7 / Plan 41-04) — Polish Wave Layer-B E2E.
 * Runs against the built :4174 demo (pnpm test:serve:demo). Locks the
 * NIP66-06/07 contract: the shell chrome panel `#nip66-suggestions-list`
 * surfaces relay URLs from `createNip66Aggregator` fed by kind-30166
 * fixtures in `apps/playground/src/playground-relay-fixtures.ts`.
 *
 * Anti-features verified:
 *   - M-03 (SimplePool resource leak): the aggregator is instantiated inside
 *     createDemoHooks and disposed via beforeunload (Plan 41-01 Task 2 Step 4).
 *     This spec does not assert on unload behavior directly — the Vitest unit
 *     tests cover stop() semantics (Plan 41-01 Task 1).
 *
 * Flow:
 *   1. Load demo; wait for #nip66-suggestions-list to exist.
 *   2. Wait for at least one <li> in the list (D7 contract verbatim).
 *   3. Tighten: assert at least one <li> text content starts with 'wss://'
 *      (excludes the 'no suggestions yet' placeholder — main.ts clears the
 *      placeholder before inserting real items per Plan 41-01 Task 2 Step 4).
 */
import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://localhost:4174' });

test.describe('NIP-66 demo suggestions (E2E-26 / NIP66-07)', () => {
  test('#nip66-suggestions-list surfaces at least one relay URL from fixture discovery events', async ({ page }) => {
    test.setTimeout(30_000);

    await page.goto('/');

    // Panel must exist in the DOM immediately after boot.
    await page.waitForSelector('#nip66-suggestions-list', { timeout: 10_000 });

    // D7 contract (verbatim from 41-CONTEXT.md Grey Area 2):
    //   at least one <li> lands in the list within 5s.
    await page.waitForFunction(
      () => document.querySelectorAll('#nip66-suggestions-list li').length >= 1,
      null,
      { timeout: 5000 },
    );

    // Tightened assertion: at least one <li> has textContent starting with
    // 'wss://' — rules out the 'no suggestions yet' placeholder. The three
    // fixture URLs are 'wss://relay.fixture-{one,two,three}.test'.
    await expect
      .poll(
        async () =>
          page.evaluate(() =>
            Array.from(
              document.querySelectorAll('#nip66-suggestions-list li'),
            ).some((li) => (li.textContent ?? '').startsWith('wss://')),
          ),
        { timeout: 5000, intervals: [200] },
      )
      .toBe(true);
  });
});
