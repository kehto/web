import { describe, expect, it } from 'vitest';

// @ts-expect-error -- plain ESM script without type declarations
import { parseBinding, payloadFields, sectionRows } from '../scripts/generate-napplet-bindings.mjs';
import { MOCK_NAP_REGISTRY } from '../src/registry.js';
import { MOCK_NAPPLET_BINDINGS } from '../src/napplet-bindings.js';

const EXTENSIONS = MOCK_NAP_REGISTRY.filter((entry) => entry.kind === 'extension');

describe('MOCK_NAPPLET_BINDINGS', () => {
  it('covers exactly the extension mocks, generated from the same spec refs', () => {
    expect(Object.keys(MOCK_NAPPLET_BINDINGS).sort()).toEqual(EXTENSIONS.map((entry) => entry.domain).sort());
    for (const entry of EXTENSIONS) {
      expect(MOCK_NAPPLET_BINDINGS[entry.domain]?.spec, entry.domain).toEqual({ nap: entry.spec.nap, sha: entry.spec.sha });
    }
  });

  it('binds every route each mock answers, and only those routes', () => {
    for (const entry of EXTENSIONS) {
      const mock = entry.create!({});
      const bound = Object.values(MOCK_NAPPLET_BINDINGS[entry.domain]!.methods).map((method) => method.type).sort();
      expect(bound, entry.domain).toEqual([...mock.mock.routes].sort());
      for (const type of bound) expect(Object.hasOwn(mock.messageCapabilities ?? {}, type), type).toBe(true);
    }
  });

  it('lists only push events the mock is allowed to send, and names handlers over them', () => {
    for (const entry of EXTENSIONS) {
      const binding = MOCK_NAPPLET_BINDINGS[entry.domain]!;
      const pushes = Object.keys(entry.create!({}).pushCapabilities ?? {});
      for (const event of binding.events) expect(pushes, `${entry.domain}: ${event}`).toContain(event);
      for (const types of Object.values(binding.handlers)) {
        for (const type of types) expect(binding.events).toContain(type);
      }
      for (const method of Object.values(binding.methods)) {
        expect(method.type.startsWith(`${entry.domain}.`)).toBe(true);
        expect(method.params.every((name) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(name))).toBe(true);
      }
    }
  });

  it('records the NAP-defined shapes the table cannot express as gaps', () => {
    expect(MOCK_NAPPLET_BINDINGS.location!.gaps).toEqual([
      'state: served from the latest location.state push',
      'latest: served from the latest location.position push',
    ]);
    expect(MOCK_NAPPLET_BINDINGS.blossom!.gaps).toContain('parseUri: local helper, no wire message');
  });
});

describe('generate-napplet-bindings parser', () => {
  const DOC = [
    '## API Surface',
    '',
    '| Operation | Parameters | Result | Wire |',
    '|---|---|---|---|',
    '| `requestPermission` | `precise` (boolean, optional) | `Result` | `demo.permission` / `demo.permission.result` |',
    '| `status` | `jobId` (`text`) | `Status` | `demo.status` / `.result` |',
    '| `onState` | handler for `State` | `Subscription` handle | `demo.state` |',
    '| `latest` | none | `State` or `null` | latest `demo.state` |',
    '',
    '## Wire Protocol',
    '',
    '| Type | Direction | Payload fields |',
    '|------|-----------|----------------|',
    '| `demo.subscribe` | napplet -> shell | `frequency`? |',
    '| `demo.permission` | napplet -> shell | `id`, `precise`? |',
    '| `demo.permission.result` | shell -> napplet | `id`, `permission`, `precise`, `error`? |',
    '| `demo.status` | napplet → runtime | `id`, `jobId` |',
    '| `demo.status.result` | runtime → napplet | `id`, `result` (`Status`) or `error` |',
    '| `demo.state` | shell -> napplet | `available` |',
    '',
    '## Security',
  ].join('\n');

  it('reads cells and field names without type annotations', () => {
    expect(sectionRows(DOC, 'Wire Protocol')[0]).toEqual(['Type', 'Direction', 'Payload fields']);
    expect(payloadFields('`id`, `event` (`EventTemplate`), `ttl?`')).toEqual(['id', 'event', 'ttl']);
    expect(payloadFields('`id`, exactly one of `info` or `error`')).toEqual(['id', 'info', 'error']);
  });

  it('maps API names, wire fields, replies, results, events, handlers and gaps', () => {
    expect(parseBinding('demo', DOC)).toEqual({
      methods: {
        subscribe: { type: 'demo.subscribe', params: ['frequency'], reply: false, id: false },
        requestPermission: { type: 'demo.permission', params: ['precise'], reply: true },
        status: { type: 'demo.status', params: ['jobId'], reply: true, result: 'result' },
      },
      events: ['demo.state'],
      handlers: { onState: ['demo.state'] },
      gaps: ['latest: served from the latest demo.state push'],
    });
  });

  it('builds prose-envelope documents from the API rows', () => {
    const doc = [
      '## API Surface',
      '| Operation | Parameters | Result | Wire |',
      '|---|---|---|---|',
      '| `read` | `transferId` (text), `offset` (text) | `Chunk` | `soulseek.read` / `soulseek.read.result` |',
      '## Wire Protocol',
      'Every result carries exactly one of `value` or `error`.',
    ].join('\n');
    expect(parseBinding('soulseek', doc).methods).toEqual({
      read: { type: 'soulseek.read', params: ['transferId', 'offset'], reply: true, result: 'value' },
    });
  });
});
