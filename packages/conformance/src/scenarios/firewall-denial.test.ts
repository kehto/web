import { describe, expect, it } from 'vitest';
import { runConformance } from '../engine.js';
import type { ConformanceTarget, TargetSession, TargetVariant } from '../target.js';
import { FIREWALL_DENIAL_SCENARIO, judgeFirewallDenial, type FirewallRow } from './firewall-denial.js';

const row = (overrides: Partial<FirewallRow>): FirewallRow => ({
  domain: 'link', request: 'link.open', canonical: 'link.open.result',
  rejections: 1, backendCalls: 0, replies: [], pushes: [], ...overrides,
});

describe('judgeFirewallDenial (kehto/web#494)', () => {
  it('accepts silence and the canonical reply', () => {
    expect(judgeFirewallDenial(row({}))).toBeNull();
    expect(judgeFirewallDenial(row({ replies: [{ type: 'link.open.result', status: 'denied', error: 'x' }] }))).toBeNull();
  });

  it('rejects the generic <type>.error a NAP does not define', () => {
    expect(judgeFirewallDenial(row({ replies: [{ type: 'link.open.error', error: 'x' }] }))).toContain('link.open.error');
  });

  it('judges every reply, so a fire-and-forget request with no id is covered', () => {
    const gamepad = row({ domain: 'gamepad', request: 'gamepad.subscribe', canonical: 'gamepad.state' });
    expect(judgeFirewallDenial({ ...gamepad, replies: [{ type: 'gamepad.state', available: false }] })).toBeNull();
    expect(judgeFirewallDenial({ ...gamepad, replies: [{ type: 'gamepad.subscribe.error' }] })).toContain('gamepad.subscribe.error');
  });

  it('allows a NAP-defined push racing the request, and only resource keeps .error', () => {
    expect(judgeFirewallDenial(row({ pushes: ['link.changed'], replies: [{ type: 'link.changed' }] }))).toBeNull();
    const resource = row({ domain: 'resource', request: 'resource.info', canonical: 'resource.info.result' });
    expect(judgeFirewallDenial({ ...resource, replies: [{ type: 'resource.info.error' }] })).toBeNull();
  });

  it('fails when the gate never fired or the backend ran', () => {
    expect(judgeFirewallDenial(row({ rejections: 0 }))).toContain('never saw');
    expect(judgeFirewallDenial(row({ backendCalls: 1 }))).toContain('backend ran');
  });
});

describe('catalog/firewall-denial without a legacy Firewall gate', () => {
  it('skips on a target that does not offer openLegacyFirewall', async () => {
    const target: ConformanceTarget = {
      name: 'fake', packages: {}, requiredDomainPolicy: 'warn',
      async boot(variant: TargetVariant): Promise<TargetSession> {
        return {
          variant, advertised: () => ({ domains: ['link'], services: [] }),
          loadProbe: () => Promise.reject(new Error('not used')), loadRogue: () => Promise.reject(new Error('not used')),
          destroyEndpoint: async () => undefined, revocations: () => [], transcript: () => [],
          control: async () => undefined, controls: [], dispose: async () => undefined,
        };
      },
    };
    const run = await runConformance(target, { profile: 'full' }, [FIREWALL_DENIAL_SCENARIO]);
    expect(run.checks.map((check) => [check.id, check.status])).toEqual([
      ['catalog/firewall-denial', 'skip'], ['catalog/firewall-denial', 'skip'],
    ]);
  });
});
