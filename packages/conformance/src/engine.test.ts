import { describe, expect, it } from 'vitest';
import { ConformanceHarnessError, conformanceStatement, runConformance } from './engine.js';
import { fail, pass, skip, specGap, type CheckOutcome } from './model.js';
import { defineScenario, type Scenario } from './scenario.js';
import type { ConformanceTarget, TargetSession, TargetVariant } from './target.js';

function fakeTarget(domains: readonly string[], boot?: () => never): ConformanceTarget {
  return {
    name: 'fake',
    packages: { fake: '1.0.0' },
    requiredDomainPolicy: 'warn',
    async boot(variant: TargetVariant): Promise<TargetSession> {
      if (boot) boot();
      const advertised = variant.shell === 'shell-present' ? ['shell', ...domains] : [...domains];
      return {
        variant,
        advertised: () => ({ domains: advertised, services: [] }),
        loadProbe: () => Promise.reject(new Error('not used')),
        loadRogue: () => Promise.reject(new Error('not used')),
        destroyEndpoint: async () => undefined,
        revocations: () => [],
        transcript: () => [{ seq: 99, at: 1, variant: `${variant.profile}/${variant.shell}`, endpoint: 'ep-1', direction: 'napplet->runtime', tap: 'host', envelope: { type: 'theme.get', id: 'x' } }],
        control: async () => undefined,
        controls: [],
        dispose: async () => undefined,
      };
    },
  };
}

function scenario(outcomes: Record<string, CheckOutcome | ((shell: boolean) => CheckOutcome)>, collect?: () => never): Scenario {
  return defineScenario<{ shell: boolean }>({
    id: 'fake',
    async collect(context) {
      if (collect) collect();
      return { shell: context.variant.shell === 'shell-present' };
    },
    checks: Object.entries(outcomes).map(([id, outcome]) => ({
      id, title: id, scope: 'nip5d-core' as const, severity: id.startsWith('warn/') ? 'warning' as const : 'error' as const, authority: ['nip5d'],
      evaluate: (facts: { shell: boolean }) => (typeof outcome === 'function' ? outcome(facts.shell) : outcome),
    })),
  });
}

describe('runConformance', () => {
  it('runs both shell variants and derives ok only from error-severity failures', async () => {
    const run = await runConformance(fakeTarget(['theme']), { profile: 'minimal' }, [scenario({
      'a/pass': pass('ok'),
      'warn/fails': fail('warning only'),
      'a/gap': specGap('missing decision X; policy Y'),
      'a/skip-absent': (shell) => (shell ? pass('ok') : skip('n/a')),
    })]);
    expect(run.variants.map((variant) => variant.id)).toEqual(['minimal/shell-present', 'minimal/shell-absent']);
    expect(run.variants[1]?.advertisedDomains).toEqual(['theme']);
    expect(run.summary).toMatchObject({ total: 8, pass: 3, fail: 2, skip: 1, specGap: 2, errorFailures: 0 });
    expect(run.ok).toBe(true);
    expect(run.statement).toContain('2 semantic spec-gap results');
    expect(run.statement).toContain('not a claim of full NAP conformance');
    expect(run.transcript.map((entry) => entry.seq)).toEqual([1, 2]);
  });

  it('fails the run on an error-severity failure and says so first', async () => {
    const run = await runConformance(fakeTarget(['theme']), {}, [scenario({ 'a/fails': fail('broken') })]);
    expect(run.ok).toBe(false);
    expect(run.summary.errorFailures).toBe(2);
    expect(run.statement.startsWith('NOT conformant: 2 error-severity checks failed')).toBe(true);
  });

  it('turns a collection error into failures of that scenario only', async () => {
    const run = await runConformance(fakeTarget([]), {}, [
      scenario({ 'b/throws': pass('never') }, () => { throw new Error('boom'); }),
      scenario({ 'c/ok': pass('fine') }),
    ]);
    const statuses = Object.fromEntries(run.checks.filter((check) => check.variant.endsWith('present')).map((check) => [check.id, check.status]));
    expect(statuses).toEqual({ 'b/throws': 'fail', 'c/ok': 'pass' });
    expect(run.checks.find((check) => check.id === 'b/throws')?.detail).toContain('Error: boom');
  });

  it('reports a target that cannot boot as a harness error', async () => {
    await expect(runConformance(fakeTarget([], () => { throw new Error('no dom'); }), {}, [])).rejects.toBeInstanceOf(ConformanceHarnessError);
  });
});

describe('conformanceStatement', () => {
  it('never claims full conformance and states the gap counts', () => {
    const text = conformanceStatement({ total: 3, pass: 3, fail: 0, skip: 0, specGap: 0, errorFailures: 0, wireOnlyOperations: 4, specOperations: 2, gapOperations: 0 });
    expect(text).toBe('NIP-5D core and selected NAP checks passed (3 passed, 0 warning-severity failures, 0 skipped); 2 operations exercised against a pinned NAP revision; 4 operations have wire-contract coverage only; no semantic spec gaps recorded. This is not a claim of full NAP conformance.');
  });
});
