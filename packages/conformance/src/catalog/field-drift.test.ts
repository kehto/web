import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOMAINS_SCENARIO, packageFieldDrift } from '../scenarios/domains.js';
import { SUPPORTED_DOMAINS } from './domains.js';
import { FIELD_DRIFT_EXCEPTIONS, fieldDrift, fieldDriftReport } from './field-drift.js';
import { INVENTORY, type DomainInventory } from './inventory.js';
import { readPackageFields } from './nap-type-fields.js';
import { parseNapTypes, parseNapWireFields, parseWireFieldCell } from './nap-types-parser.js';

const DIST = join(process.cwd(), 'packages/conformance/node_modules/@napplet/nap/dist');
const RESOURCE = join(DIST, 'resource/types.d.ts');

/**
 * kehto/web#508's motivating drift, as `@napplet/nap@0.41.0` shipped it:
 * `ResourceBytesManyMessage` carried `requests` where NAP-RESOURCE's wire
 * table names `urls`. Operation names are unchanged, so only fields catch it.
 */
function renamedUrlsFixture(): string {
  const source = readFileSync(RESOURCE, 'utf8');
  const start = source.indexOf('interface ResourceBytesManyMessage');
  const end = source.indexOf('}', start);
  const body = source.slice(start, end);
  expect(body, 'the installed declaration still has the field to rename').toMatch(/\burls: /);
  return source.slice(0, start) + body.replace(/\burls: /, 'requests: ') + source.slice(end);
}

function withResourceFields(source: string): Readonly<Record<string, DomainInventory>> {
  const entry = INVENTORY.resource as DomainInventory;
  return { ...INVENTORY, resource: { ...entry, package: parseNapTypes(source, 'resource'), packageFields: readPackageFields(RESOURCE, 'resource', source) } };
}

describe('wire-table payload cells', () => {
  it('reads both optional spellings, alternatives, type hints and none', () => {
    expect(parseWireFieldCell('`id`, `servers?`, `error`? (string)')).toEqual({ fields: { id: 'required', servers: 'optional', error: 'optional' } });
    expect(parseWireFieldCell('`id`, optional `requirements`')).toEqual({ fields: { id: 'required', requirements: 'optional' } });
    expect(parseWireFieldCell('`id`, `model` or `error`')).toEqual({ fields: { id: 'required', model: 'optional', error: 'optional' } });
    expect(parseWireFieldCell('`bindings` (array of `{ actionId, key }`)')).toEqual({ fields: { bindings: 'required' } });
    expect(parseWireFieldCell('(none)')).toEqual({ fields: {} });
  });

  it('marks named-type spreads open and keeps unreadable prose, never guessing fields', () => {
    expect(parseWireFieldCell('`id`, `DmStatus` or `DmError`')).toEqual({ fields: { id: 'required' }, open: true });
    expect(parseWireFieldCell('Delta fields; no separate `id`')).toEqual({ fields: {}, unparsed: 'Delta fields; no separate `id`' });
  });

  it('rejects one type with two different payload rows', () => {
    const table = ['| `x.a` | napplet -> shell | `id` |', '| `x.a` | napplet -> shell | `id`, `b` |'].join('\n');
    expect(() => parseNapWireFields(table, 'x')).toThrow(/two wire-table rows/);
  });
});

describe('packaged message fields', () => {
  it('resolves inherited @napplet/core fields and merges result-or-error unions', () => {
    const dm = readPackageFields(join(DIST, 'dm/types.d.ts'), 'dm');
    expect(dm['dm.send']?.fields).toMatchObject({ id: 'required' });
    expect(Object.keys(dm['dm.send']?.fields ?? {}).length).toBeGreaterThan(1);
    const llm = readPackageFields(join(DIST, 'llm/types.d.ts'), 'llm');
    // `Reply<'model', LlmModel>`: exactly one of `model` or `error`.
    expect(llm['llm.select.result']?.fields).toEqual({ id: 'required', model: 'optional', error: 'optional' });
  });
});

describe('catalog/package-field-drift (kehto/web#508)', () => {
  const evaluate = DOMAINS_SCENARIO.checks.find((check) => check.id === 'catalog/package-field-drift');

  it('is registered next to catalog/package-drift', () => {
    expect(evaluate?.severity).toBe('error');
    expect(DOMAINS_SCENARIO.checks.map((check) => check.id)).toContain('catalog/package-drift');
  });

  it('catches the requests-vs-urls rename, and only through this check', () => {
    const mutated = renamedUrlsFixture();
    const inventory = withResourceFields(mutated);
    expect(fieldDrift('resource', inventory)).toEqual([
      { type: 'resource.bytesMany', field: 'requests', spec: 'absent', package: 'required' },
      { type: 'resource.bytesMany', field: 'urls', spec: 'required', package: 'absent' },
    ]);
    const outcome = packageFieldDrift({ selected: ['resource'] }, fieldDriftReport(['resource'], inventory));
    expect(outcome.status).toBe('fail');
    expect(outcome.detail).toContain('resource.bytesMany');
    // The operation inventory cannot see it: catalog/package-drift's input is unchanged.
    expect(parseNapTypes(mutated, 'resource')).toEqual(INVENTORY.resource?.package);
    expect(fieldDrift('resource')).toEqual([]);
  });

  it('flags a required field turned optional', () => {
    const source = readFileSync(RESOURCE, 'utf8');
    const start = source.indexOf('interface ResourceBytesManyMessage');
    const mutated = source.slice(0, start) + source.slice(start).replace(/\burls: /, 'urls?: ');
    expect(fieldDrift('resource', withResourceFields(mutated))).toEqual([{ type: 'resource.bytesMany', field: 'urls', spec: 'required', package: 'optional' }]);
  });

  it('applies every exception to a live row, so none goes stale', () => {
    const live = SUPPORTED_DOMAINS.flatMap((domain) => fieldDrift(domain));
    for (const exception of FIELD_DRIFT_EXCEPTIONS) {
      expect(live, `${exception.type} ${exception.field}`).toContainEqual({ type: exception.type, field: exception.field, spec: exception.spec, package: exception.package });
    }
  });

  it('pins the real findings against nap 0.43 and the pinned NAP refs', () => {
    const report = fieldDriftReport(SUPPORTED_DOMAINS);
    expect(report.findings).toEqual([
      { type: 'cvm.discover.result', field: 'servers', spec: 'optional', package: 'required' },
      { type: 'upload.info.result', field: 'info', spec: 'required', package: 'optional' },
      { type: 'upload.status.result', field: 'status', spec: 'required', package: 'optional' },
      { type: 'upload.upload.result', field: 'result', spec: 'required', package: 'optional' },
      { type: 'intent.available.result', field: 'availability', spec: 'required', package: 'optional' },
      { type: 'intent.handlers.result', field: 'handlers', spec: 'required', package: 'optional' },
    ]);
    expect(report.contradictions.map((row) => row.type)).toEqual(['identity.getProfile.result']);
  });

  it('lists every row it cannot fully compare, so the list cannot grow quietly', () => {
    const report = fieldDriftReport(SUPPORTED_DOMAINS);
    expect(report.uncompared).toEqual([
      { type: 'dm.conversations', reason: 'open' },
      { type: 'dm.conversations.result', reason: 'open' },
      { type: 'dm.messages', reason: 'open' },
      { type: 'dm.messages.result', reason: 'open' },
      { type: 'dm.send', reason: 'open' },
      { type: 'dm.send.result', reason: 'open' },
      { type: 'dm.status.result', reason: 'open' },
      { type: 'dm.subscribe', reason: 'open' },
      { type: 'dm.subscribe.result', reason: 'open' },
      { type: 'dm.unsubscribe.result', reason: 'open' },
      { type: 'llm.delta', reason: 'unparsed', cell: 'Delta fields; no separate `id`' },
    ]);
  });

  it('reports a table-versus-prose contradiction as a spec gap, not a pass', () => {
    expect(packageFieldDrift({ selected: ['identity'] }).status).toBe('spec-gap');
    expect(packageFieldDrift({ selected: ['theme', 'storage', 'resource'] }).status).toBe('pass');
  });
});
