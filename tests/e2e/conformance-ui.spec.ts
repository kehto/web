/**
 * kehto/web#187: `kehto conformance --ui` serves the live web UI, and a change
 * to the served bundle triggers exactly one debounced re-run.
 *
 * The `--exec` companion command stands in for a watch build: it touches the
 * bundle three times in quick succession, which must collapse into one
 * `rerun` event, one page reload and one fresh run.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const CLI = join(process.cwd(), 'packages/cli/dist/index.js');
const BUNDLE = join(process.cwd(), 'packages/conformance/dist/browser/conformance.js');
// Three appends 40 ms apart, 15 s after start (after the first run finished).
const TOUCH = `node -e "const fs=require('fs');let n=0;setTimeout(function t(){fs.appendFileSync('${BUNDLE}','\\n// touched by conformance-ui.spec\\n');if(++n<3)setTimeout(t,40)},15000)"`;

interface Served {
  readonly child: ChildProcess;
  readonly url: string;
  readonly stderr: string[];
}

function serve(args: readonly string[]): Promise<Served> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, 'conformance', '--ui', '--no-open', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    const stderr: string[] = [];
    child.stderr?.on('data', (chunk: Buffer) => { stderr.push(chunk.toString()); });
    child.stdout?.on('data', (chunk: Buffer) => {
      const match = /Kehto conformance UI: (\S+)/.exec(chunk.toString());
      if (match?.[1]) resolve({ child, url: match[1], stderr });
    });
    child.once('exit', (code) => reject(new Error(`kehto conformance --ui exited early with ${code}: ${stderr.join('')}`)));
  });
}

test.describe('kehto conformance --ui (kehto/web#187)', () => {
  test.describe.configure({ timeout: 180_000 });

  test('serves the live UI and a bundle change triggers one debounced re-run', async ({ page }) => {
    const served = await serve(['--profile', 'minimal', '--domain', 'theme', '--exec', TOUCH]);
    try {
      expect(served.url).toContain('?profile=minimal&domain=theme');
      const html = await (await fetch(served.url)).text();
      expect(html).toContain('mountKehtoConformanceUi');
      expect(html).toContain('./events');

      await page.goto(served.url);
      await page.waitForFunction(() => (window as unknown as { __kehtoConformanceUi?: { runs: number } }).__kehtoConformanceUi?.runs === 1, null, { timeout: 60_000 });
      await expect(page.locator('select[name="profile"]')).toHaveValue('minimal');
      await expect(page.locator('.verdict')).toBeVisible();
      await expect(page.locator('.matrix')).toContainText('theme');

      // The --exec command touches the bundle three times; the page reloads once and runs again.
      await page.waitForEvent('load', { timeout: 60_000 });
      await page.waitForFunction(() => (window as unknown as { __kehtoConformanceUi?: { runs: number } }).__kehtoConformanceUi?.runs === 1, null, { timeout: 60_000 });
      await page.waitForTimeout(1500);
      const reruns = served.stderr.join('').match(/bundle changed; re-run \d+/g) ?? [];
      expect(reruns).toEqual(['bundle changed; re-run 1']);
    } finally {
      served.child.kill();
    }
  });
});
