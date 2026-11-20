/**
 * kehto/web#187: prove the conformance checks are not decorative.
 *
 * Each named mutation in @kehto/conformance/src/mutations.ts breaks one
 * property of the real first-party target. The run must then fail exactly the
 * mutation's stable check ids plus the target's known findings: a mutation that
 * breaks unrelated checks, or one that changes nothing, fails this spec.
 */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { KNOWN_KEHTO_FINDINGS } from './helpers/conformance-findings.js';

const CLI_MODULE = pathToFileURL(join(process.cwd(), 'packages/conformance/dist/cli.js')).href;
const BUNDLE = pathToFileURL(join(process.cwd(), 'packages/conformance/dist/browser/conformance.js'));

interface MutationResult {
  readonly expect: readonly string[];
  readonly applied: number;
  readonly failing: readonly string[];
  readonly passing: number;
}

async function runMutation(page: Page, url: string, name: string): Promise<MutationResult> {
  await page.goto(url);
  await page.waitForFunction(() => Boolean((window as unknown as Record<string, unknown>).__kehtoConformance));
  return page.evaluate(async (mutation) => {
    type Api = { runKehtoMutation(name: string, options: object): Promise<{ run: { checks: { id: string; status: string; severity: string }[] }; expect: string[]; applied: number }> };
    const api = (window as unknown as { __kehtoConformance: Api }).__kehtoConformance;
    const { run, expect: expected, applied } = await api.runKehtoMutation(mutation, { profile: 'minimal' });
    const failing = [...new Set(run.checks.filter((check) => check.status === 'fail' && check.severity === 'error').map((check) => check.id))].sort();
    return { expect: expected, applied, failing, passing: run.checks.filter((check) => check.status === 'pass').length };
  }, name);
}

const MUTATION_NAMES = [
  'inject-window-nostr',
  'accept-forged-source',
  'omit-granted-shell',
  'duplicate-shell-init',
  'gate-on-shell-ready',
  'supports-depends-on-init',
  'init-invents-domain',
];

test.describe('conformance mutation self-tests (kehto/web#187)', () => {
  test.describe.configure({ timeout: 120_000 });
  let server: { url: string; close(): Promise<void> };
  let names: string[] = [];

  test.beforeAll(async () => {
    const cli = (await import(CLI_MODULE)) as { startHarnessServer(bundle: URL): Promise<{ url: string; close(): Promise<void> }> };
    server = await cli.startHarnessServer(BUNDLE);
  });
  test.afterAll(async () => { await server?.close(); });

  test('the registry lists every mutation this spec runs', async ({ page }) => {
    await page.goto(server.url);
    await page.waitForFunction(() => Boolean((window as unknown as Record<string, unknown>).__kehtoConformance));
    names = await page.evaluate(() => (window as unknown as { __kehtoConformance: { MUTATIONS: { name: string }[] } }).__kehtoConformance.MUTATIONS.map((mutation) => mutation.name));
    expect(names).toEqual(MUTATION_NAMES);
  });

  for (const name of MUTATION_NAMES) {
    test(`${name} fails only its intended checks`, async ({ page }) => {
      const result = await runMutation(page, server.url, name);
      expect(result.applied, `${name} never applied`).toBeGreaterThan(0);
      expect(result.failing).toEqual([...new Set([...result.expect, ...KNOWN_KEHTO_FINDINGS])].sort());
      expect(result.passing, 'unrelated checks still pass').toBeGreaterThan(10);
    });
  }
});

