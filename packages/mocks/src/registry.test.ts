import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import { createMockNapServices } from './core/aggregate.js';
import { MOCK_NAP_REGISTRY, findMockDomain } from './registry.js';

/**
 * Inventory of every NAP document in napplet/naps (master + open PR heads)
 * at the time this package was written. A new upstream NAP must be added
 * here AND to `domains/` — `scripts/audit-naps.mjs` reports the drift.
 */
const INVENTORY: ReadonlyArray<[domain: string, nap: string, pr: number | 'master']> = [
  ['ble', 'NAP-BLE', 62],
  ['blossom', 'NAP-BLOSSOM', 71],
  ['capture', 'NAP-CAPTURE', 94],
  ['catalog', 'NAP-CATALOG', 95],
  ['class', 'NAP-CLASS', 16],
  ['class-1', 'NAP-CLASS-1', 17],
  ['class-2', 'NAP-CLASS-2', 18],
  ['common', 'NAP-COMMON', 67],
  ['config', 'NAP-CONFIG', 14],
  ['connect', 'NAP-CONNECT', 19],
  ['count', 'NAP-COUNT', 69],
  ['cvm', 'NAP-CVM', 31],
  ['display', 'NAP-DISPLAY', 97],
  ['dm', 'NAP-DM', 74],
  ['fs', 'NAP-FS', 88],
  ['gamepad', 'NAP-GAMEPAD', 130],
  ['git', 'NAP-GIT', 137],
  ['hashtree', 'NAP-HASHTREE', 73],
  ['identity', 'NAP-IDENTITY', 'master'],
  ['inc', 'NAP-INC', 'master'],
  ['intent', 'NAP-INTENT', 'master'],
  ['keys', 'NAP-KEYS', 9],
  ['link', 'NAP-LINK', 53],
  ['lists', 'NAP-LISTS', 68],
  ['llm', 'NAP-LLM', 134],
  ['location', 'NAP-LOCATION', 125],
  ['media', 'NAP-MEDIA', 10],
  ['mesh', 'NAP-MESH', 122],
  ['motion', 'NAP-MOTION', 124],
  ['navigation', 'NAP-NAVIGATION', 126],
  ['notify', 'NAP-NOTIFY', 11],
  ['nzb', 'NAP-NZB', 136],
  ['outbox', 'NAP-OUTBOX', 32],
  ['pow', 'NAP-POW', 39],
  ['relay', 'NAP-RELAY', 2],
  ['resource', 'NAP-RESOURCE', 80],
  ['serial', 'NAP-SERIAL', 61],
  ['shell', 'NAP-SHELL', 'master'],
  ['soulseek', 'NAP-SOULSEEK', 135],
  ['storage', 'NAP-STORAGE', 3],
  ['system', 'NAP-SYSTEM', 64],
  ['theme', 'NAP-THEME', 'master'],
  ['torrent', 'NAP-TORRENT', 72],
  ['upload', 'NAP-UPLOAD', 33],
  ['value', 'NAP-VALUE', 30],
  ['webrtc', 'NAP-WEBRTC', 59],
  ['worker', 'NAP-WORKER', 107],
];

const BUILT_IN_SERVICE_DOMAINS = [
  'relay', 'identity', 'count', 'gamepad', 'media', 'keys', 'notify', 'theme', 'config', 'resource', 'cvm', 'outbox',
  'upload', 'intent', 'link', 'common', 'lists', 'serial', 'ble', 'webrtc', 'dm', 'fs', 'llm',
];

describe('MOCK_NAP_REGISTRY', () => {
  it('covers every inventoried NAP exactly once with a matching spec ref', () => {
    expect(MOCK_NAP_REGISTRY.map((entry) => entry.domain)).toEqual(INVENTORY.map(([domain]) => domain));
    for (const [domain, nap, pr] of INVENTORY) {
      const entry = findMockDomain(domain)!;
      expect(entry.spec.nap, domain).toBe(nap);
      expect(entry.spec.path, domain).toBe(`naps/${nap}.md`);
      expect(entry.spec.sha, domain).toMatch(/^[0-9a-f]{8,40}$/);
      if (pr === 'master') {
        expect(entry.spec.source, domain).toBe('master');
        expect(entry.spec.status, domain).toBe('merged');
      } else {
        expect(entry.spec.source, domain).toBe('pr');
        expect(entry.spec.pr, domain).toBe(pr);
        expect(entry.spec.status, domain).not.toBe('merged');
      }
    }
  });

  it('uses the built-in dispatcher kind for runtime-routed domains and extension elsewhere', () => {
    for (const entry of MOCK_NAP_REGISTRY) {
      if (BUILT_IN_SERVICE_DOMAINS.includes(entry.domain)) {
        expect(entry.kind, entry.domain).toBe('service');
      } else if (entry.kind === 'service') {
        throw new Error(`${entry.domain} is not a built-in runtime domain; use kind 'extension'`);
      }
      if (entry.kind === 'service' || entry.kind === 'extension') {
        expect(typeof entry.create, entry.domain).toBe('function');
      } else {
        expect(entry.create, entry.domain).toBeUndefined();
        expect(entry.note, entry.domain).toBeTruthy();
      }
    }
  });

  it('instantiates every factory with a matching descriptor and route table', () => {
    const mocks = createMockNapServices(MOCK_NAP_REGISTRY, { seed: 11 });
    for (const domain of mocks.domains) {
      const service = mocks.get(domain);
      const entry = findMockDomain(domain)!;
      expect(service.descriptor.name, domain).toBe(domain);
      // NAP-CLASS is push-only (`class.assigned`); every other domain answers requests.
      if (domain !== 'class') expect(service.mock.routes.length, domain).toBeGreaterThan(0);
      for (const route of service.mock.routes) expect(route.startsWith(`${domain}.`), `${domain}: ${route}`).toBe(true);
      if (entry.kind === 'extension') {
        expect(Object.keys(service.messageCapabilities ?? {}), domain).toEqual([...service.mock.routes]);
        // Pushes outside a request only reach a napplet through `pushCapabilities`
        // (ServiceRuntimeContext.sendToEligibleNapplet); every declared type must belong
        // to the domain and must not double as an inbound route.
        for (const type of Object.keys(service.pushCapabilities ?? {})) {
          expect(type.startsWith(`${domain}.`), `${domain} push ${type}`).toBe(true);
          expect(service.mock.routes, `${domain} push ${type}`).not.toContain(type);
        }
      }
      // Unknown types are ignored without throwing.
      service.handleMessage('win-registry', { type: `${domain}.__unknown__`, id: 'x' } as NappletMessage, () => {});
      expect(service.mock.sent, domain).toEqual([]);
      service.onWindowDestroyed?.('win-registry');
      service.mock.reset();
    }
    mocks.resetAll();
  });

  it('supports only/except/overrides selection', () => {
    const subset = createMockNapServices(MOCK_NAP_REGISTRY, { only: ['relay', 'link'], overrides: { link: { seed: 3 } } });
    expect(subset.domains).toEqual(['link', 'relay']);
    expect(() => subset.get('llm')).toThrow(/no mock created/);
    const without = createMockNapServices(MOCK_NAP_REGISTRY, { except: ['relay'] });
    expect(without.domains.includes('relay')).toBe(false);
  });
});
