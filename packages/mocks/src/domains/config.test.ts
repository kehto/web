import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import {
  CONFIG_MOCK_ENTRY,
  CONFIG_SPEC_REF,
  MOCK_CONFIG_SCHEMA,
  MOCK_CONFIG_VALUES,
  createMockConfigService,
  resolveMockConfigValues,
  validateMockConfigSchema,
} from './config.js';
import { MOCK_RELAYS } from '../fixtures/nostr.js';

function sink() {
  const sent: NappletMessage[] = [];
  return { sent, send: (msg: NappletMessage) => { sent.push(msg); } };
}

const RESOLVED = {
  theme: 'dark',
  fontSize: 16,
  showAvatars: true,
  relays: [MOCK_RELAYS.primary, MOCK_RELAYS.secondary],
  notifications: { mentions: false, digest: 'daily' },
};

function registered(windowId = 'w1') {
  const service = createMockConfigService({ clock: { now: () => 1_700_000_000_000 } });
  const { sent, send } = sink();
  service.handleMessage(windowId, { type: 'config.registerSchema', id: 'r1', schema: MOCK_CONFIG_SCHEMA, version: 1 } as NappletMessage, send);
  return { service, sent, send };
}

describe('createMockConfigService', () => {
  it('describes itself and records the spec ref', () => {
    const service = createMockConfigService();
    expect(service.descriptor).toMatchObject({ name: 'config', version: '1.0.0' });
    expect(service.mock.routes).toEqual(['config.registerSchema', 'config.get', 'config.subscribe', 'config.unsubscribe', 'config.openSettings']);
    expect(CONFIG_SPEC_REF).toEqual({ nap: 'NAP-CONFIG', status: 'draft', source: 'pr', pr: 14, sha: 'bed9cb5b', path: 'naps/NAP-CONFIG.md' });
    expect(CONFIG_MOCK_ENTRY.kind).toBe('service');
    expect(CONFIG_MOCK_ENTRY.create?.({}).descriptor.name).toBe('config');
  });

  it('validates the Core Subset with the NAP error codes', () => {
    expect(validateMockConfigSchema(MOCK_CONFIG_SCHEMA)).toEqual({ ok: true });
    expect(validateMockConfigSchema({ type: 'string' })).toMatchObject({ ok: false, code: 'invalid-schema' });
    expect(validateMockConfigSchema({ $schema: 'http://json-schema.org/draft-04/schema#', type: 'object' })).toMatchObject({ ok: false, code: 'unsupported-draft' });
    expect(validateMockConfigSchema({ type: 'object', properties: { username: { type: 'string', pattern: '^[a-z]+$' } } }))
      .toEqual({ ok: false, code: 'pattern-not-allowed', error: 'JSON Schema `pattern` keyword is not permitted in the Core Subset at $.username' });
    expect(validateMockConfigSchema({ type: 'object', properties: { a: { $ref: '#/definitions/x' } } })).toMatchObject({ ok: false, code: 'ref-not-allowed' });
    expect(validateMockConfigSchema({ type: 'object', properties: { a: { type: 'string', oneOf: [] } } })).toMatchObject({ ok: false, code: 'invalid-schema' });
    expect(validateMockConfigSchema({ type: 'object', properties: { a: { type: 'array', items: [{ type: 'string' }] } } })).toMatchObject({ ok: false, code: 'invalid-schema' });
    expect(validateMockConfigSchema({ type: 'object', properties: { token: { type: 'string', 'x-napplet-secret': true, default: 'x' } } })).toMatchObject({ ok: false, code: 'secret-with-default' });
    const deep = { type: 'object', properties: { a: { type: 'object', properties: { b: { type: 'object', properties: { c: { type: 'object', properties: { d: { type: 'object', properties: { e: { type: 'object' } } } } } } } } } } };
    expect(validateMockConfigSchema(deep)).toMatchObject({ ok: false, code: 'schema-too-deep' });
  });

  it('resolves persisted values, defaults, orphans, and secrets', () => {
    expect(resolveMockConfigValues(MOCK_CONFIG_SCHEMA, MOCK_CONFIG_VALUES)).toEqual(RESOLVED);
    expect(resolveMockConfigValues(MOCK_CONFIG_SCHEMA, {})).toEqual({
      theme: 'system', fontSize: 14, showAvatars: true, relays: [MOCK_RELAYS.primary], notifications: { mentions: true, digest: 'daily' },
    });
    expect(resolveMockConfigValues(MOCK_CONFIG_SCHEMA, { theme: 'neon', fontSize: 99, apiToken: 'secret', orphan: 1 }))
      .toMatchObject({ theme: 'system', fontSize: 14, apiToken: 'secret' });
    expect(resolveMockConfigValues(MOCK_CONFIG_SCHEMA, { orphan: 1 })).not.toHaveProperty('orphan');
  });

  it('accepts a schema and answers config.get with a correlated snapshot', () => {
    const { service, sent, send } = registered();
    service.handleMessage('w1', { type: 'config.get', id: 'g1' } as NappletMessage, send);
    expect(sent).toEqual([
      { type: 'config.registerSchema.result', id: 'r1', ok: true },
      { type: 'config.values', id: 'g1', values: RESOLVED },
    ]);
    expect(service.mock.state().schemas.get('w1')?.version).toBe(1);
  });

  it('rejects schemas with a positive-ACK error envelope and version conflicts', () => {
    const { service, sent, send } = registered();
    service.handleMessage('w1', { type: 'config.registerSchema', id: 'r2', schema: { type: 'object', properties: { username: { type: 'string', pattern: '^[a-z]+$' } } } } as NappletMessage, send);
    service.handleMessage('w1', { type: 'config.registerSchema', id: 'r3', schema: { type: 'object' }, version: 0 } as NappletMessage, send);
    expect(sent.slice(1)).toEqual([
      { type: 'config.registerSchema.result', id: 'r2', ok: false, code: 'pattern-not-allowed', error: 'JSON Schema `pattern` keyword is not permitted in the Core Subset at $.username' },
      { type: 'config.registerSchema.result', id: 'r3', ok: false, code: 'version-conflict', error: 'schema version cannot move backwards' },
    ]);
  });

  it('pushes no-schema errors before registration, then snapshots once registered', () => {
    const service = createMockConfigService();
    const { sent, send } = sink();
    service.handleMessage('w1', { type: 'config.get', id: 'g0' } as NappletMessage, send);
    service.handleMessage('w1', { type: 'config.subscribe' } as NappletMessage, send);
    service.handleMessage('w1', { type: 'config.openSettings' } as NappletMessage, send);
    service.handleMessage('w1', { type: 'config.registerSchema', id: 'r1', schema: MOCK_CONFIG_SCHEMA } as NappletMessage, send);
    expect(sent).toEqual([
      { type: 'config.schemaError', code: 'no-schema', error: 'no configuration schema is registered' },
      { type: 'config.schemaError', code: 'no-schema', error: 'no configuration schema is registered' },
      { type: 'config.schemaError', code: 'no-schema', error: 'no configuration schema is registered' },
      { type: 'config.registerSchema.result', id: 'r1', ok: true },
      { type: 'config.values', values: RESOLVED },
    ]);
  });

  it('subscribes with an initial push, receives commits, and stops after unsubscribe', () => {
    const { service, sent, send } = registered();
    service.handleMessage('w1', { type: 'config.subscribe' } as NappletMessage, send);
    expect(sent.at(-1)).toEqual({ type: 'config.values', values: RESOLVED });
    const committed = service.commit('w1', { theme: 'light', fontSize: 12, relays: [], apiToken: 'tok' });
    expect(committed).toEqual({ theme: 'light', fontSize: 12, showAvatars: true, relays: [], apiToken: 'tok', notifications: { mentions: true, digest: 'daily' } });
    expect(sent.at(-1)).toEqual({ type: 'config.values', values: committed });
    service.handleMessage('w1', { type: 'config.unsubscribe' } as NappletMessage, send);
    const before = sent.length;
    service.commit('w1', { theme: 'dark' });
    expect(sent.length).toBe(before);
    service.handleMessage('w1', { type: 'config.get', id: 'g2' } as NappletMessage, send);
    expect(sent.at(-1)).toMatchObject({ type: 'config.values', id: 'g2', values: { theme: 'dark', fontSize: 14 } });
    expect(service.commit('w9', { theme: 'dark' })).toBeUndefined();
  });

  it('records openSettings and ignores undeclared sections silently', () => {
    const { service, sent, send } = registered();
    service.handleMessage('w1', { type: 'config.openSettings', section: 'network' } as NappletMessage, send);
    service.handleMessage('w1', { type: 'config.openSettings', section: 'ghost' } as NappletMessage, send);
    expect(sent).toHaveLength(1);
    expect(service.mock.state().settingsOpened).toEqual([
      { windowId: 'w1', section: 'network', at: 1_700_000_000_000 },
      { windowId: 'w1', at: 1_700_000_000_000 },
    ]);
  });

  it('drops subscribers on revocation, cleans windows, and resets', () => {
    const { service, sent, send } = registered();
    service.handleMessage('w1', { type: 'config.subscribe' } as NappletMessage, send);
    service.onCapabilityRevoked?.('w1', 'config:read');
    expect(service.mock.state().subscribers.has('w1')).toBe(false);
    service.handleMessage('w1', { type: 'config.subscribe' } as NappletMessage, send);
    service.onWindowDestroyed?.('w1');
    expect(service.mock.state().schemas.size).toBe(0);
    expect(service.mock.state().stores.size).toBe(0);
    expect(service.mock.state().subscribers.size).toBe(0);
    sent.length = 0;
    service.handleMessage('w1', { type: 'config.get', id: 'g3' } as NappletMessage, send);
    expect(sent).toEqual([{ type: 'config.schemaError', code: 'no-schema', error: 'no configuration schema is registered' }]);
    service.mock.reset();
    expect(service.mock.state()).toEqual({ schemas: new Map(), stores: new Map(), subscribers: new Set(), settingsOpened: [] });
    expect(service.mock.sent).toEqual([]);
  });
});
