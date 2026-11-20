import { describe, expect, it } from 'vitest';
import { runConformance } from '../engine.js';
import { fail, pass, specGap } from '../model.js';
import { defineScenario } from '../scenario.js';
import type { ConformanceTarget } from '../target.js';
import { selectionFromUrl, selectionToSearch } from './app.js';
import { escapeHtml, renderRun } from './render.js';

const target: ConformanceTarget = {
  name: 'fake', packages: {}, requiredDomainPolicy: 'warn',
  async boot(variant) {
    return {
      variant, advertised: () => ({ domains: ['theme'], services: [] }),
      loadProbe: () => Promise.reject(new Error('unused')), loadRogue: () => Promise.reject(new Error('unused')),
      destroyEndpoint: async () => undefined, revocations: () => [],
      transcript: () => [{ seq: 1, at: 1, variant: `${variant.profile}/${variant.shell}`, endpoint: 'ep-1', direction: 'napplet->runtime', tap: 'frame', envelope: { type: 'theme.get', id: '<x>' } }],
      control: async () => undefined, controls: [], dispose: async () => undefined,
    };
  },
};

const catalog = [defineScenario<null>({
  id: 'ui', collect: async () => null,
  checks: [
    { id: 'x/pass', title: 'p', scope: 'nip5d-core', severity: 'error', authority: ['nip5d'], evaluate: () => pass('fine') },
    { id: 'x/fail', title: 'f', scope: 'wire-contract', severity: 'error', domain: 'theme', authority: ['nap-theme'], evaluate: () => fail('broken <b>', { got: '<script>' }) },
    { id: 'x/gap', title: 'g', scope: 'nap-spec', severity: 'error', authority: ['nap-theme'], evaluate: () => specGap('missing decision') },
    { id: 'x/policy', title: 'k', scope: 'kehto-policy', severity: 'error', authority: ['nip5d'], evaluate: () => pass('strict') },
    { id: 'x/catalog', title: 'c', scope: 'catalog', severity: 'error', authority: ['nap-package'], evaluate: () => pass('covered') },
  ],
})];

describe('conformance UI rendering', () => {
  it('shows verdict, counts, scope groups, the matrix and the transcript, escaped', async () => {
    const run = await runConformance(target, { profile: 'minimal' }, catalog);
    const html = renderRun(run);
    expect(html).toContain('2 error-severity checks failed');
    expect(html).toContain(escapeHtml(run.statement));
    for (const label of ['NIP-5D core', 'NAP semantics', 'Wire contract', 'Kehto policy', 'Catalog']) expect(html).toContain(label);
    expect(html).toContain('badge-spec-gap');
    expect(html).toContain('minimal/shell-present');
    expect(html).toContain('<code>theme</code>');
    expect(html).toContain('broken &lt;b&gt;');
    expect(html).toContain('&quot;&lt;script&gt;&quot;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('https://github.com/napplet/naps/blob/');
  });

  it('reads and writes deep links for profile and domains', () => {
    expect(selectionFromUrl('?profile=minimal&domain=theme&domain=inc,relay')).toEqual({ profile: 'minimal', domains: ['theme', 'inc', 'relay'] });
    expect(selectionFromUrl('')).toEqual({ profile: 'full', domains: [] });
    expect(selectionToSearch('minimal', ['theme', 'inc'])).toBe('?profile=minimal&domain=theme&domain=inc');
  });
});
