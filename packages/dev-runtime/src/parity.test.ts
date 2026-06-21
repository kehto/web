import { existsSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  DEV_RUNTIME_ADVERTISED_DOMAINS,
  DEV_RUNTIME_COMPATIBILITY_ALIASES,
  DEV_RUNTIME_HANDSHAKE_DOMAINS,
  DEV_RUNTIME_REQUIRED_SERVICES,
  DEV_RUNTIME_UPSTREAM_WEB_DOMAINS,
  getMissingAdvertisedDomains,
  getMissingServices,
} from './parity.js';

function napPackageRoot(): URL {
  const sibling = new URL('../../../../napplet/packages/nap/src/', import.meta.url);
  if (existsSync(sibling)) return sibling;
  return new URL('../../../node_modules/.pnpm/@napplet+nap@0.13.0/node_modules/@napplet/nap/dist/', import.meta.url);
}

function readNapDomainDirectories(): string[] {
  return readdirSync(napPackageRoot(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith('.'))
    .sort();
}

describe('@kehto/dev-runtime parity metadata', () => {
  it('tracks the current @napplet/nap web domain directories', () => {
    expect(readNapDomainDirectories()).toEqual([...DEV_RUNTIME_UPSTREAM_WEB_DOMAINS]);
  });

  it('covers every upstream domain as advertised, handshake-only, or compatibility alias', () => {
    const advertised = new Set<string>(DEV_RUNTIME_ADVERTISED_DOMAINS);
    const handshakeOnly = new Set<string>(DEV_RUNTIME_HANDSHAKE_DOMAINS);

    for (const domain of DEV_RUNTIME_UPSTREAM_WEB_DOMAINS) {
      if (handshakeOnly.has(domain)) {
        expect(advertised.has(domain)).toBe(false);
        continue;
      }
      if (domain in DEV_RUNTIME_COMPATIBILITY_ALIASES) {
        expect(advertised.has(DEV_RUNTIME_COMPATIBILITY_ALIASES[domain as keyof typeof DEV_RUNTIME_COMPATIBILITY_ALIASES])).toBe(true);
        continue;
      }
      expect(advertised.has(domain)).toBe(true);
    }
  });

  it('identifies missing advertised domains and services', () => {
    expect(getMissingAdvertisedDomains({
      domains: [...DEV_RUNTIME_ADVERTISED_DOMAINS],
      protocols: { inc: ['NAP-01', 'NAP-02', 'NAP-03', 'NAP-04', 'NAP-05', 'NAP-06'] },
      naps: [...DEV_RUNTIME_ADVERTISED_DOMAINS],
      sandbox: [],
    })).toEqual([]);
    expect(getMissingAdvertisedDomains({
      domains: DEV_RUNTIME_ADVERTISED_DOMAINS.filter((domain) => domain !== 'upload'),
      protocols: {},
      naps: [],
      sandbox: [],
    })).toEqual(['upload']);
    expect(getMissingServices(DEV_RUNTIME_REQUIRED_SERVICES)).toEqual([]);
    expect(getMissingServices(DEV_RUNTIME_REQUIRED_SERVICES.filter((service) => service !== 'intent'))).toEqual(['intent']);
  });
});
