import { describe, expect, it } from 'vitest';
import { runConformance } from '../engine.js';
import { fail, pass, skip, specGap } from '../model.js';
import { defineScenario } from '../scenario.js';
import type { ConformanceTarget } from '../target.js';
import { formatReport } from './index.js';

const target: ConformanceTarget = {
  name: 'fake', packages: {}, requiredDomainPolicy: 'warn',
  async boot(variant) {
    return {
      variant, advertised: () => ({ domains: ['theme'], services: [] }),
      loadProbe: () => Promise.reject(new Error('unused')), loadRogue: () => Promise.reject(new Error('unused')),
      destroyEndpoint: async () => undefined, revocations: () => [], transcript: () => [],
      control: async () => undefined, controls: [], dispose: async () => undefined,
    };
  },
};

const catalog = [defineScenario<null>({
  id: 'mixed',
  collect: async () => null,
  checks: [
    { id: 'x/pass', title: 'p', scope: 'nip5d-core', severity: 'error', authority: ['nip5d'], evaluate: () => pass('fine') },
    { id: 'x/fail', title: 'f', scope: 'nap-spec', severity: 'error', authority: ['nap-theme'], evaluate: () => fail('broken <here> & "there"', { got: 1 }) },
    { id: 'x/warn', title: 'w', scope: 'kehto-policy', severity: 'warning', authority: ['nip5d'], evaluate: () => fail('soft') },
    { id: 'x/skip', title: 's', scope: 'wire-contract', severity: 'error', authority: ['nap-package'], evaluate: () => skip('n/a') },
    { id: 'x/gap', title: 'g', scope: 'nap-spec', severity: 'error', authority: ['nap-theme'], evaluate: () => specGap('NAP-THEME does not decide Z; policy W') },
  ],
})];

describe('reporters', () => {
  it('pretty, json and junit agree on failures and counts', async () => {
    const run = await runConformance(target, { profile: 'minimal' }, catalog);
    const json = JSON.parse(formatReport(run, 'json')) as typeof run;
    expect(json.summary).toEqual(run.summary);
    expect(json.checks.filter((check) => check.status === 'fail').map((check) => check.id)).toEqual(['x/fail', 'x/warn', 'x/fail', 'x/warn']);

    const pretty = formatReport(run, 'pretty');
    expect(pretty).toContain('10 checks: 2 pass, 4 fail (2 error), 2 skip, 2 spec-gap');
    expect(pretty.trimEnd().split('\n').at(-1)).toBe(run.statement);
    expect(pretty).toContain('GAP  x/gap [nap-spec] NAP-THEME does not decide Z');
    expect(pretty).toContain('nap-theme: merged https://github.com/napplet/naps/blob/');

    const junit = formatReport(run, 'junit');
    expect(junit).toContain(`<testsuites name="kehto-conformance" tests="10" failures="2" errors="0" skipped="4">`);
    expect((junit.match(/<failure /g) ?? []).length).toBe(run.summary.errorFailures);
    expect((junit.match(/<skipped message="spec-gap/g) ?? []).length).toBe(run.summary.specGap);
    expect(junit).toContain('<property name="spec-gap" value="2"/>');
    expect(junit).toContain('broken &lt;here&gt; &amp; &quot;there&quot;');
    expect(junit).not.toContain('<here>');
  });
});
