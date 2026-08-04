import type { NappletMessage } from '@napplet/core';
import type { ConfigValues, NappletConfigSchema } from '@napplet/nap/config/types';
import { describe, expect, it, vi } from 'vitest';
import {
  createConfigService,
  resolveConfigValues,
  validateConfigSchema,
} from './config-service.js';

const SCHEMA = {
  $schema: 'https://json-schema.org/draft-07/schema#',
  type: 'object',
  additionalProperties: false,
  properties: {
    theme: { type: 'string', enum: ['light', 'dark'], default: 'dark' },
    retries: { type: 'integer', minimum: 0, maximum: 5, default: 2 },
    tags: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      minItems: 1,
      maxItems: 3,
      default: ['general'],
    },
    apiKey: { type: 'string', 'x-napplet-secret': true, 'x-napplet-section': 'credentials' },
    nested: {
      type: 'object',
      default: { enabled: true },
      properties: { enabled: { type: 'boolean' } },
    },
  },
} as NappletConfigSchema;

function message(type: string, fields: Record<string, unknown> = {}): NappletMessage {
  return { type, ...fields } as NappletMessage;
}

describe('NAP-CONFIG schema boundary', () => {
  it('accepts the full bounded Core Subset and rejects unenforced features', () => {
    expect(validateConfigSchema(SCHEMA)).toEqual({ ok: true });
    expect(validateConfigSchema({
      type: 'object',
      properties: { value: { type: 'string', pattern: '(a+)+$' } },
    })).toMatchObject({ ok: false, code: 'pattern-not-allowed' });
    expect(validateConfigSchema({
      type: 'object',
      properties: { value: { type: 'string', minProperties: 2 } },
    })).toMatchObject({ ok: false, code: 'invalid-schema' });
    expect(validateConfigSchema({
      type: 'object',
      properties: { secret: { type: 'string', default: 'fixed', 'x-napplet-secret': true } },
    })).toMatchObject({ ok: false, code: 'secret-with-default' });
  });

  it('enforces object depth, homogeneous primitive arrays, and valid defaults', () => {
    const depth = (remaining: number): Record<string, unknown> => ({
      type: 'object',
      properties: remaining === 0 ? { value: { type: 'string' } } : { child: depth(remaining - 1) },
    });
    expect(validateConfigSchema(depth(4))).toEqual({ ok: true });
    expect(validateConfigSchema(depth(5))).toMatchObject({ ok: false, code: 'schema-too-deep' });
    expect(validateConfigSchema({
      type: 'object',
      properties: { values: { type: 'array', items: [{ type: 'string' }] } },
    })).toMatchObject({ ok: false, code: 'invalid-schema' });
    expect(validateConfigSchema({
      type: 'object',
      properties: { count: { type: 'integer', minimum: 1, default: 0 } },
    })).toMatchObject({ ok: false, code: 'invalid-schema' });
  });

  it('applies defaults and removes invalid or orphaned persisted values', () => {
    expect(resolveConfigValues(SCHEMA, {
      theme: 'sepia',
      retries: 99,
      tags: ['valid', ''],
      apiKey: 'user-secret',
      nested: {},
      orphan: 'drop-me',
    })).toEqual({
      theme: 'dark',
      retries: 2,
      tags: ['general'],
      apiKey: 'user-secret',
      nested: { enabled: true },
    });
  });

  it('preserves additional values when an object explicitly allows them', () => {
    const openSchema = {
      type: 'object',
      additionalProperties: true,
      properties: {
        name: { type: 'string' },
        nested: {
          type: 'object',
          additionalProperties: true,
          properties: { enabled: { type: 'boolean' } },
        },
      },
    } as NappletConfigSchema;

    expect(validateConfigSchema(openSchema)).toEqual({ ok: true });
    expect(resolveConfigValues(openSchema, {
      name: 'Paja',
      extra: { values: ['kept', 2, true] },
      nested: { enabled: true, label: 'also kept' },
    })).toEqual({
      name: 'Paja',
      extra: { values: ['kept', 2, true] },
      nested: { enabled: true, label: 'also kept' },
    });
  });
});

describe('createConfigService', () => {
  it('fails closed before schema registration', () => {
    const service = createConfigService({ getValues: () => ({}) });
    const sent: NappletMessage[] = [];
    service.handler.handleMessage('window-1', message('config.get', { id: 'get-1' }), (item) => sent.push(item));
    service.handler.handleMessage('window-1', message('config.subscribe'), (item) => sent.push(item));

    expect(sent).toEqual([
      { type: 'config.schemaError', code: 'no-schema', error: 'no configuration schema is registered' },
      { type: 'config.schemaError', code: 'no-schema', error: 'no configuration schema is registered' },
    ]);
  });

  it('scopes storage and subscriptions by source window', () => {
    const persisted = new Map<string, ConfigValues>([
      ['window-1', { theme: 'light', orphan: true }],
      ['window-2', { theme: 'dark' }],
    ]);
    const saveValues = vi.fn((windowId: string, values: ConfigValues) => persisted.set(windowId, values));
    const service = createConfigService({
      getValues: (windowId) => ({ ...persisted.get(windowId) }),
      saveValues,
    });
    const first: NappletMessage[] = [];
    const second: NappletMessage[] = [];

    service.handler.handleMessage('window-1', message('config.subscribe'), (item) => first.push(item));
    service.handler.handleMessage('window-1', message('config.registerSchema', { id: 'schema-1', schema: SCHEMA, version: 2 }), (item) => first.push(item));
    service.handler.handleMessage('window-2', message('config.registerSchema', { id: 'schema-2', schema: SCHEMA, version: 2 }), (item) => second.push(item));
    service.handler.handleMessage('window-2', message('config.get', { id: 'get-2' }), (item) => second.push(item));

    expect(first).toEqual([
      { type: 'config.schemaError', code: 'no-schema', error: 'no configuration schema is registered' },
      { type: 'config.registerSchema.result', id: 'schema-1', ok: true },
      { type: 'config.values', values: { theme: 'light', retries: 2, tags: ['general'], nested: { enabled: true } } },
    ]);
    expect(second[1]).toEqual({
      type: 'config.values',
      id: 'get-2',
      values: { theme: 'dark', retries: 2, tags: ['general'], nested: { enabled: true } },
    });
    expect(saveValues).toHaveBeenCalledWith('window-1', expect.not.objectContaining({ orphan: true }));
  });

  it('commits shell UI values, publishes only to the source, and cleans up', () => {
    const persisted = new Map<string, ConfigValues>();
    const opened = vi.fn();
    const destroyed = vi.fn();
    const service = createConfigService({
      getValues: (windowId) => persisted.get(windowId) ?? {},
      saveValues: (windowId, values) => persisted.set(windowId, values),
      openSettings: opened,
      onWindowDestroyed: destroyed,
    });
    const sent: NappletMessage[] = [];
    service.handler.handleMessage('window-1', message('config.registerSchema', { id: 'schema-1', schema: SCHEMA }), (item) => sent.push(item));
    service.handler.handleMessage('window-1', message('config.subscribe'), (item) => sent.push(item));
    service.handler.handleMessage('window-1', message('config.openSettings', { section: 'credentials' }), (item) => sent.push(item));

    const context = opened.mock.calls[0][2];
    expect(context.commit({ theme: 'light', retries: 4, apiKey: 'entered' })).toEqual({
      theme: 'light', retries: 4, tags: ['general'], apiKey: 'entered', nested: { enabled: true },
    });
    expect(sent.at(-1)).toEqual({
      type: 'config.values',
      values: { theme: 'light', retries: 4, tags: ['general'], apiKey: 'entered', nested: { enabled: true } },
    });

    service.handler.onWindowDestroyed?.('window-1');
    expect(destroyed).toHaveBeenCalledWith('window-1');
    expect(service.getSchema('window-1')).toBeNull();
  });

  it('rejects schema version rollback and normalizes unknown sections', () => {
    const openSettings = vi.fn();
    const service = createConfigService({ getValues: () => ({}), openSettings });
    const sent: NappletMessage[] = [];
    service.handler.handleMessage('window-1', message('config.registerSchema', { id: 'v2', schema: SCHEMA, version: 2 }), (item) => sent.push(item));
    service.handler.handleMessage('window-1', message('config.registerSchema', { id: 'v1', schema: SCHEMA, version: 1 }), (item) => sent.push(item));
    service.handler.handleMessage('window-1', message('config.openSettings', { section: 'missing' }), (item) => sent.push(item));

    expect(sent[1]).toMatchObject({ type: 'config.registerSchema.result', id: 'v1', ok: false, code: 'version-conflict' });
    expect(openSettings).toHaveBeenCalledWith('window-1', undefined, expect.any(Object));
  });

  it('shapes rejected host reads for get and openSettings without a values payload', () => {
    let rejectReads = false;
    const service = createConfigService({
      getValues: () => {
        if (rejectReads) throw new Error('host values are unavailable');
        return {};
      },
      openSettings: vi.fn(),
    });
    const sent: NappletMessage[] = [];
    const send = (item: NappletMessage): void => { sent.push(item); };

    service.handler.handleMessage('window-1', message('config.registerSchema', {
      id: 'schema-1',
      schema: SCHEMA,
    }), send);
    rejectReads = true;

    expect(() => service.handler.handleMessage('window-1', message('config.get', { id: 'get-1' }), send)).not.toThrow();
    expect(() => service.handler.handleMessage('window-1', message('config.openSettings'), send)).not.toThrow();

    expect(sent.slice(1)).toEqual([
      { type: 'config.schemaError', code: 'invalid-schema', error: 'host values are unavailable' },
      { type: 'config.schemaError', code: 'invalid-schema', error: 'host values are unavailable' },
    ]);
    expect(sent).not.toContainEqual(expect.objectContaining({ type: 'config.values', id: 'get-1' }));
  });

  it('never delivers a snapshot that is missing required user input', () => {
    const openSettings = vi.fn();
    const service = createConfigService({ getValues: () => ({}), openSettings });
    const requiredSchema = {
      type: 'object',
      required: ['endpoint'],
      properties: { endpoint: { type: 'string', minLength: 1 } },
    };
    const sent: NappletMessage[] = [];
    service.handler.handleMessage('window-1', message('config.registerSchema', {
      id: 'required-schema',
      schema: requiredSchema,
    }), (item) => sent.push(item));
    service.handler.handleMessage('window-1', message('config.get', { id: 'get-required' }), (item) => sent.push(item));
    service.handler.handleMessage('window-1', message('config.openSettings'), (item) => sent.push(item));

    expect(sent[1]).toEqual({
      type: 'config.schemaError',
      code: 'invalid-schema',
      error: 'configuration requires valid values before delivery',
    });
    const context = openSettings.mock.calls[0][2];
    expect(() => context.commit({})).toThrow('required configuration values are missing or invalid');
    expect(context.commit({ endpoint: 'https://example.test' })).toEqual({ endpoint: 'https://example.test' });
  });
});
