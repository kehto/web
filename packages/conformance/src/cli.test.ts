import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runConformanceCli, parseConformanceArgs } from './cli.js';
import { runConformance } from './engine.js';
import { fail, pass } from './model.js';
import { defineScenario } from './scenario.js';
import type { ConformanceTarget } from './target.js';

const target: ConformanceTarget = {
  name: 'fake', packages: {}, requiredDomainPolicy: 'warn',
  async boot(variant) {
    return {
      variant, advertised: () => ({ domains: [], services: [] }),
      loadProbe: () => Promise.reject(new Error('unused')), loadRogue: () => Promise.reject(new Error('unused')),
      destroyEndpoint: async () => undefined, revocations: () => [], transcript: () => [],
      control: async () => undefined, controls: [], dispose: async () => undefined,
    };
  },
};
const runWith = (ok: boolean) => () => runConformance(target, {}, [defineScenario<null>({
  id: 'one', collect: async () => null,
  checks: [{ id: 'x/one', title: 'one', scope: 'nip5d-core', severity: 'error', authority: ['nip5d'], evaluate: () => (ok ? pass('ok') : fail('no')) }],
})]);

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, io: { stdout: { write: (chunk: string) => { out.push(chunk); } }, stderr: { write: (chunk: string) => { err.push(chunk); } } } };
}

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('kehto conformance', () => {
  it('parses every headless option', () => {
    expect(parseConformanceArgs(['--profile', 'minimal', '--domain', 'theme', '--domain', 'inc', '--reporter', 'junit', '--out', 'x.xml', '--ready-timeout', '500', '--settle', '40'])).toEqual({
      help: false,
      options: { profile: 'minimal', domains: ['theme', 'inc'], reporter: 'junit', out: 'x.xml', readyTimeoutMs: 500, settleMs: 40 },
    });
    expect(parseConformanceArgs([])).toEqual({ help: false, options: { profile: 'full', domains: [], reporter: 'pretty' } });
  });

  it('exits 0 when every applicable check passes and 1 on an error failure', async () => {
    const passing = io();
    expect(await runConformanceCli([], passing.io, { execute: runWith(true) })).toBe(0);
    expect(passing.out.join('')).toContain('NIP-5D core and selected NAP checks passed');
    const failing = io();
    expect(await runConformanceCli([], failing.io, { execute: runWith(false) })).toBe(1);
    expect(failing.out.join('')).toContain('NOT conformant');
  });

  it('exits 2 on usage, harness and missing-browser errors', async () => {
    const usage = io();
    expect(await runConformanceCli(['--profile', 'huge'], usage.io)).toBe(2);
    expect(usage.err.join('')).toContain('--profile must be one of minimal, full');
    expect(await runConformanceCli(['--settle', '-1'], io().io)).toBe(2);
    expect(await runConformanceCli(['--nope'], io().io)).toBe(2);
    const harness = io();
    expect(await runConformanceCli([], harness.io, { execute: () => Promise.reject(new Error('target boot failed')) })).toBe(2);
    expect(harness.err.join('')).toContain('harness error: target boot failed');
    const browser = io();
    const chromium = { launch: () => Promise.reject(new Error('Executable does not exist')) };
    expect(await runConformanceCli([], browser.io, { chromium })).toBe(2);
    expect(browser.err.join('')).toContain('browser unavailable: Chromium failed to launch');
  });

  it('writes the selected reporter to --out', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kehto-conformance-'));
    dirs.push(dir);
    const out = join(dir, 'report.xml');
    const streams = io();
    expect(await runConformanceCli(['--reporter', 'junit', '--out', out], streams.io, { execute: runWith(false) })).toBe(1);
    expect(readFileSync(out, 'utf8')).toContain('<failure message="no"');
    expect(streams.out.join('')).toContain(`Wrote junit report to ${out}`);
  });

  it('prints help', async () => {
    const streams = io();
    expect(await runConformanceCli(['--help'], streams.io)).toBe(0);
    expect(streams.out.join('')).toContain('--profile <minimal|full>');
  });
});
