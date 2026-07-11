import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  PAJA_ADVERTISED_DOMAINS,
  PAJA_COMPATIBILITY_ALIASES,
  PAJA_DEFERRED_DOMAINS,
  PAJA_HANDSHAKE_DOMAINS,
  PAJA_REQUIRED_SERVICES,
  PAJA_UPSTREAM_WEB_DOMAINS,
  getMissingAdvertisedDomains,
  getMissingServices,
} from './parity.js';

function napPackageRoot(): URL {
  return new URL('../node_modules/@napplet/nap/dist/', import.meta.url);
}

function readNapDomainDirectories(): string[] {
  return readdirSync(napPackageRoot(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith('.'))
    .sort();
}

describe('@kehto/paja parity metadata', () => {
  it('keeps NAP-SHELL mandatory and outside optional capability toggles', () => {
    expect(PAJA_HANDSHAKE_DOMAINS).toEqual(['shell']);
    expect(PAJA_ADVERTISED_DOMAINS).not.toContain('shell');
  });

  it('tracks the current @napplet/nap web domain directories', () => {
    expect(readNapDomainDirectories()).toEqual([...PAJA_UPSTREAM_WEB_DOMAINS]);
  });

  it('covers every upstream domain as advertised, handshake-only, or compatibility alias', () => {
    const advertised = new Set<string>(PAJA_ADVERTISED_DOMAINS);
    const handshakeOnly = new Set<string>(PAJA_HANDSHAKE_DOMAINS);
    const deferred = new Set<string>(PAJA_DEFERRED_DOMAINS);

    for (const domain of PAJA_UPSTREAM_WEB_DOMAINS) {
      if (deferred.has(domain)) {
        expect(advertised.has(domain)).toBe(false);
        continue;
      }
      if (handshakeOnly.has(domain)) {
        expect(advertised.has(domain)).toBe(false);
        continue;
      }
      if (domain in PAJA_COMPATIBILITY_ALIASES) {
        expect(advertised.has(PAJA_COMPATIBILITY_ALIASES[domain as keyof typeof PAJA_COMPATIBILITY_ALIASES])).toBe(true);
        continue;
      }
      expect(advertised.has(domain)).toBe(true);
    }
  });

  it('identifies missing advertised domains and services', () => {
    expect(getMissingAdvertisedDomains({
      domains: [...PAJA_ADVERTISED_DOMAINS],
      protocols: { inc: ['NAP-01', 'NAP-02', 'NAP-03', 'NAP-04', 'NAP-05', 'NAP-06'] },
      naps: [...PAJA_ADVERTISED_DOMAINS],
      sandbox: [],
    })).toEqual([]);
    expect(getMissingAdvertisedDomains({
      domains: PAJA_ADVERTISED_DOMAINS.filter((domain) => domain !== 'upload'),
      protocols: {},
      naps: [],
      sandbox: [],
    })).toEqual(['upload']);
    expect(getMissingServices(PAJA_REQUIRED_SERVICES)).toEqual([]);
    expect(getMissingServices(PAJA_REQUIRED_SERVICES.filter((service) => service !== 'intent'))).toEqual(['intent']);
  });
});
