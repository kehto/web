import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NAP_PACKAGE_VERSION } from '../authority.js';
import { FIXTURES } from '../fixtures/index.js';
import { SUPPORTED_DOMAINS, UNROUTED_PACKAGE_DOMAINS } from './domains.js';
import { INVENTORY, outboundOperations } from './inventory.js';
import { readPackageFields } from './nap-type-fields.js';
import { parseNapTypes, parseNapWireTable } from './nap-types-parser.js';

const PACKAGE = join(process.cwd(), 'packages/conformance/node_modules/@napplet/nap');
const DIST = join(PACKAGE, 'dist');

function packagedDomains(): string[] {
  return readdirSync(DIST, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(DIST, entry.name, 'types.d.ts')))
    .map((entry) => entry.name)
    .sort();
}

function shellDomainList(name: string): string[] {
  const source = readFileSync(join(process.cwd(), 'packages/shell/src/shell-init.ts'), 'utf8');
  const block = new RegExp(`const ${name} = \\[([^\\]]+)\\]`).exec(source)?.[1] ?? '';
  return [...block.matchAll(/'([a-z]+)'/g)].map((match) => match[1] as string);
}

describe('operation inventory drift guard', () => {
  it('pins the installed @napplet/nap version', () => {
    expect(JSON.parse(readFileSync(join(PACKAGE, 'package.json'), 'utf8')).version).toBe(NAP_PACKAGE_VERSION);
  });

  it('classifies every packaged domain as supported or deliberately unrouted', () => {
    const classified = [...SUPPORTED_DOMAINS, ...Object.keys(UNROUTED_PACKAGE_DOMAINS)].sort();
    expect(packagedDomains()).toEqual(classified);
  });

  it('supports exactly the domains the shell can advertise', () => {
    const shell = [...shellDomainList('RUNTIME_NATIVE_DOMAINS'), ...shellDomainList('SERVICE_ONLY_DOMAINS')].sort();
    expect(shell.length).toBeGreaterThan(20);
    expect([...SUPPORTED_DOMAINS].sort()).toEqual(shell);
  });

  it('matches every supported domain against its packaged types (regenerate with scripts/generate-inventory.ts)', () => {
    for (const domain of SUPPORTED_DOMAINS) {
      const parsed = parseNapTypes(readFileSync(join(DIST, domain, 'types.d.ts'), 'utf8'), domain);
      expect(parsed.outbound.length, `${domain} parsed no outbound operations`).toBeGreaterThan(0);
      expect(INVENTORY[domain]?.package, `${domain} packaged operations`).toEqual(parsed);
      expect(INVENTORY[domain]?.spec.outbound.length, `${domain} has no pinned wire table`).toBeGreaterThan(0);
    }
  });

  it('matches every supported domain against its packaged message fields (regenerate with scripts/generate-inventory.ts)', () => {
    for (const domain of SUPPORTED_DOMAINS) {
      const fields = readPackageFields(join(DIST, domain, 'types.d.ts'), domain);
      expect(INVENTORY[domain]?.packageFields, `${domain} packaged fields`).toEqual(fields);
      const entry = INVENTORY[domain];
      // Every operation either source types has field data on that side.
      expect(Object.keys(fields).sort(), `${domain} packaged messages`).toEqual([...new Set([...(entry?.package.outbound ?? []), ...(entry?.package.inbound ?? [])])].sort());
      expect(Object.keys(entry?.specFields ?? {}).sort(), `${domain} wire-table messages`).toEqual([...new Set([...(entry?.spec.outbound ?? []), ...(entry?.spec.inbound ?? [])])].sort());
    }
    // Parsing every packaged d.ts takes ~1.6 s alone and over 5 s on a loaded CI runner.
  }, 30_000);

  it('has a fixture for every supported domain, covering every inventoried request', () => {
    for (const domain of SUPPORTED_DOMAINS.filter((name) => name !== 'shell')) {
      const fixture = FIXTURES[domain];
      expect(fixture, `${domain} has no fixture`).toBeDefined();
      const covered = new Set([
        ...(fixture?.cases ?? []).map((item) => item.type),
        ...(fixture?.pushes ?? []).flatMap((push) => [push.subscribe?.type, push.unsubscribe?.type, ...(push.then ?? []).map((item) => item.type)]),
        ...(fixture?.gaps ?? []).filter((gap) => gap.kind === 'spec-gap').map((gap) => gap.type),
      ]);
      const missing = outboundOperations(domain).filter((operation) => !covered.has(operation.type)).map((operation) => operation.type);
      expect(missing, `${domain} operations without a case or spec-gap row`).toEqual([]);
    }
  });
});

describe('NAP wire-table parser', () => {
  it('reads both directions, the target-napplet form and role-to-role rows', () => {
    const table = [
      '| `x.get` | napplet -> shell | `id` |',
      '| `x.get.result` | shell -> napplet | `id` |',
      '| `x.opened` | shell -> target napplet | `peer` |',
      '| `x.state` | owner -> peer | `state` |',
      '| `y.other` | napplet -> shell | ignored domain |',
    ].join('\n');
    expect(parseNapWireTable(table, 'x')).toEqual({ outbound: ['x.get', 'x.state'], inbound: ['x.get.result', 'x.opened', 'x.state'] });
  });

  it('resolves union members to their literal types', () => {
    const source = [
      "interface XGetMessage extends NappletMessage { type: 'x.get'; id: string; }",
      "interface XGetResultMessage extends NappletMessage { type: 'x.get.result'; }",
      "interface XBase { type: `x.${string}`; }",
      'type XOutboundMessage = XGetMessage;',
      'type XInboundMessage = XGetResultMessage;',
    ].join('\n');
    expect(parseNapTypes(source, 'x')).toEqual({ outbound: ['x.get'], inbound: ['x.get.result'] });
  });
});
