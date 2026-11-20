/**
 * kehto/web#187: `kehto conformance` against the real Kehto runtime and shell.
 *
 * Runs the built CLI end to end (loopback harness, headless Chromium, the
 * first-party target) for both profiles and every reporter. The failing set
 * must equal KNOWN_KEHTO_FINDINGS exactly: a new failure, or a fix that lands
 * without updating this list, fails the spec. Authority: NIP-5D at
 * dskvr/nips@f60550c3 and napplet/naps@377bf939 (packages/conformance/src/authority.ts).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { KNOWN_KEHTO_FINDINGS } from './helpers/conformance-findings.js';

const CLI = join(process.cwd(), 'packages/cli/dist/index.js');


interface CliRun {
  readonly status: number;
  readonly stdout: string;
}

function cli(args: readonly string[]): CliRun {
  try {
    return { status: 0, stdout: execFileSync(process.execPath, [CLI, 'conformance', ...args], { encoding: 'utf8', timeout: 240_000 }) };
  } catch (error) {
    const failed = error as { status?: number; stdout?: string };
    return { status: failed.status ?? -1, stdout: failed.stdout ?? '' };
  }
}

interface Run {
  readonly ok: boolean;
  readonly statement: string;
  readonly summary: { total: number; pass: number; fail: number; skip: number; specGap: number; errorFailures: number };
  readonly variants: readonly { id: string; advertisedDomains: readonly string[] }[];
  readonly checks: readonly { id: string; variant: string; status: string; severity: string }[];
}

function failingIds(run: Run): string[] {
  return [...new Set(run.checks.filter((check) => check.status === 'fail' && check.severity === 'error').map((check) => check.id))].sort();
}

test.describe('kehto conformance (kehto/web#187)', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  for (const profile of ['minimal', 'full'] as const) {
    test(`--profile ${profile} runs both shell variants and fails only the known findings`, () => {
      const dir = mkdtempSync(join(tmpdir(), 'kehto-conformance-e2e-'));
      const out = join(dir, 'run.json');
      const result = cli(['--profile', profile, '--reporter', 'json', '--out', out]);
      const run = JSON.parse(readFileSync(out, 'utf8')) as Run;
      expect(result.status).toBe(run.ok ? 0 : 1);
      expect(failingIds(run)).toEqual([...KNOWN_KEHTO_FINDINGS].sort());
      expect(run.variants.map((variant) => variant.id)).toEqual([`${profile}/shell-present`, `${profile}/shell-absent`]);
      const absent = run.variants.find((variant) => variant.id.endsWith('shell-absent'));
      expect(absent?.advertisedDomains).not.toContain('shell');
      expect(absent?.advertisedDomains.length).toBeGreaterThan(0);
      for (const id of ['nip5d/readiness-independent', 'shell/optional', 'nip5d/source-binding']) {
        expect(run.checks.find((check) => check.id === id && check.variant === `${profile}/shell-absent`)?.status, id).toBe('pass');
      }
    });
  }

  test('pretty, json and junit report the same counts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kehto-conformance-e2e-'));
    const json = cli(['--profile', 'minimal', '--reporter', 'json', '--out', join(dir, 'run.json')]);
    const junit = cli(['--profile', 'minimal', '--reporter', 'junit', '--out', join(dir, 'run.xml')]);
    const pretty = cli(['--profile', 'minimal']);
    const run = JSON.parse(readFileSync(join(dir, 'run.json'), 'utf8')) as Run;
    const xml = readFileSync(join(dir, 'run.xml'), 'utf8');
    const { summary } = run;
    expect(new Set([json.status, junit.status, pretty.status])).toEqual(new Set([run.ok ? 0 : 1]));
    expect(xml).toContain(`tests="${summary.total}" failures="${summary.errorFailures}" errors="0" skipped="${summary.skip + summary.specGap}"`);
    expect(pretty.stdout).toContain(`${summary.total} checks: ${summary.pass} pass, ${summary.fail} fail (${summary.errorFailures} error), ${summary.skip} skip, ${summary.specGap} spec-gap`);
    expect(pretty.stdout.trimEnd().split('\n').at(-1)).toBe(run.statement);
  });

  test('a usage error exits 2', () => {
    expect(cli(['--profile', 'maximal']).status).toBe(2);
  });
});
