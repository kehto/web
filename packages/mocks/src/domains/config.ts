/**
 * domains/config.ts — Mock NAP-CONFIG service.
 *
 * Spec: naps/NAP-CONFIG.md @ napplet/naps PR #14 head bed9cb5b (draft)
 * Routes: config.registerSchema, config.get, config.subscribe,
 *   config.unsubscribe, config.openSettings; pushes config.values,
 *   config.schemaError
 * Spec gaps / decisions:
 *   - Persisted values are scoped per window (the mock has no verified
 *     manifest identity); every window starts from `options.values`
 *     (default `MOCK_CONFIG_VALUES`), as if the user had set them in the
 *     shell's settings UI. `commit(windowId, values)` models a settings
 *     commit and pushes `config.values` to a subscribed window.
 *   - The bounded Core Subset validator rejects `$ref`/`definitions`/`$defs`
 *     (`ref-not-allowed`), `pattern` (`pattern-not-allowed`), combinators and
 *     conditionals (`invalid-schema`), tuple `items` (`invalid-schema`),
 *     secrets with defaults (`secret-with-default`), objects nested deeper
 *     than four levels (`schema-too-deep`), and unsupported `$schema` drafts
 *     (`unsupported-draft`). Re-registering with a lower version is
 *     `version-conflict`.
 *   - Undeclared persisted keys are dropped at every object level; secrets
 *     are delivered only when explicitly set; `openSettings` with an
 *     undeclared section is honored without the section (never an error).
 *   - `config.get`/`config.subscribe` before a schema is registered push
 *     `config.schemaError` with `code: 'no-schema'`; the subscription stays
 *     pending and receives its snapshot once a schema is accepted.
 */
import type { NappletMessage } from '@kehto/runtime';
import type { ConfigSchemaErrorCode, ConfigValues, NappletConfigSchema } from '@napplet/nap/config/types';
import { defineMockService, pushToWindow, type MockRouteContext } from '../core/handler.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';
import { MOCK_RELAYS } from '../fixtures/nostr.js';

/** Spec document read when this mock was written. */
export const CONFIG_SPEC_REF: NapSpecRef = {
  nap: 'NAP-CONFIG',
  status: 'draft',
  source: 'pr',
  pr: 14,
  sha: 'bed9cb5b',
  path: 'naps/NAP-CONFIG.md',
};

/**
 * Fixture Core Subset schema a mock napplet registers: appearance, network,
 * and notification settings, one secret, one nested object.
 *
 * @example
 * ```ts
 * service.handleMessage('w1', { type: 'config.registerSchema', id: 'r1', schema: MOCK_CONFIG_SCHEMA }, send);
 * ```
 */
export const MOCK_CONFIG_SCHEMA: NappletConfigSchema = Object.freeze({
  $schema: 'http://json-schema.org/draft-07/schema#',
  $version: 1,
  type: 'object',
  additionalProperties: false,
  properties: {
    theme: {
      type: 'string', enum: ['light', 'dark', 'system'], enumDescriptions: ['Always light', 'Always dark', 'Follow the shell'],
      default: 'system', title: 'Theme', 'x-napplet-section': 'appearance', 'x-napplet-order': 0,
    },
    fontSize: { type: 'integer', minimum: 10, maximum: 24, default: 14, title: 'Font size', 'x-napplet-section': 'appearance', 'x-napplet-order': 1 },
    showAvatars: { type: 'boolean', default: true, title: 'Show avatars', 'x-napplet-section': 'appearance', 'x-napplet-order': 2 },
    relays: { type: 'array', items: { type: 'string' }, maxItems: 8, default: [MOCK_RELAYS.primary], title: 'Relays', 'x-napplet-section': 'network' },
    apiToken: { type: 'string', 'x-napplet-secret': true, title: 'API token', 'x-napplet-section': 'network' },
    notifications: {
      type: 'object', title: 'Notifications', 'x-napplet-section': 'notifications',
      properties: {
        mentions: { type: 'boolean', default: true },
        digest: { type: 'string', enum: ['off', 'daily', 'weekly'], default: 'daily' },
      },
    },
  },
}) as NappletConfigSchema;

/**
 * Fixture persisted values, as if the user had changed them in the shell.
 *
 * @example
 * ```ts
 * MOCK_CONFIG_VALUES.theme === 'dark';
 * ```
 */
export const MOCK_CONFIG_VALUES: ConfigValues = Object.freeze({
  theme: 'dark',
  fontSize: 16,
  relays: [MOCK_RELAYS.primary, MOCK_RELAYS.secondary],
  notifications: { mentions: false },
});

/**
 * Validation outcome of the bounded Core Subset checker.
 *
 * @example
 * ```ts
 * const result: MockConfigValidation = validateMockConfigSchema({ type: 'object' });
 * result.ok === true;
 * ```
 */
export type MockConfigValidation = { ok: true } | { ok: false; code: ConfigSchemaErrorCode; error: string };

/**
 * One `config.openSettings` request the mock recorded.
 *
 * @example
 * ```ts
 * service.mock.state().settingsOpened[0]?.section; // 'appearance'
 * ```
 */
export interface MockConfigSettingsRequest {
  /** Requesting window. */
  windowId: string;
  /** Declared section to deep-link, when it exists in the schema. */
  section?: string;
  /** `clock.now()` when requested. */
  at: number;
}

/**
 * In-memory state of the config mock.
 *
 * @example
 * ```ts
 * service.mock.state().schemas.get('w1')?.version; // 1
 * ```
 */
export interface MockConfigState {
  /** Accepted schema per window. */
  schemas: Map<string, { schema: NappletConfigSchema; version?: number }>;
  /** Persisted (user-set) values per window. */
  stores: Map<string, ConfigValues>;
  /** Windows with a live `config.subscribe`. */
  subscribers: Set<string>;
  /** Settings UI requests, oldest first. */
  settingsOpened: MockConfigSettingsRequest[];
}

/**
 * Options for `createMockConfigService`.
 *
 * @example
 * ```ts
 * const options: MockConfigOptions = { values: { theme: 'light' } };
 * ```
 */
export interface MockConfigOptions extends MockServiceOptions {
  /** Persisted values every window starts with. Default `MOCK_CONFIG_VALUES`. */
  values?: ConfigValues;
}

/**
 * The config mock service with its `commit` control.
 *
 * @example
 * ```ts
 * const config = createMockConfigService();
 * config.commit('w1', { theme: 'light' }); // pushes config.values when w1 is subscribed
 * ```
 */
export type MockConfigService = MockService<MockConfigState> & {
  /**
   * Model the shell's settings UI committing a full snapshot: validate and
   * default it against the window's schema, persist it, and push
   * `config.values` to the window when subscribed.
   *
   * @param windowId - Window whose configuration changed.
   * @param values - Raw snapshot to persist.
   * @returns The resolved values, or `undefined` when the window has no schema.
   */
  commit(windowId: string, values: ConfigValues): ConfigValues | undefined;
};

type Node = Record<string, unknown>;

const TYPES = new Set(['string', 'number', 'integer', 'boolean', 'array', 'object']);
/** Keywords outside the Core Subset, as `[keyword, error code]` pairs. */
const FORBIDDEN: ReadonlyMap<string, ConfigSchemaErrorCode> = new Map<string, ConfigSchemaErrorCode>([
  ['$ref', 'ref-not-allowed'], ['$defs', 'ref-not-allowed'], ['definitions', 'ref-not-allowed'], ['pattern', 'pattern-not-allowed'],
  ...[
    'oneOf', 'anyOf', 'allOf', 'not', 'if', 'then', 'else', 'patternProperties',
    'propertyNames', 'dependencies', 'dependentSchemas', 'unevaluatedProperties',
  ].map((keyword): [string, ConfigSchemaErrorCode] => [keyword, 'invalid-schema']),
]);
const DRAFT = /^https?:\/\/json-schema\.org\/(?:draft-0?7\/schema#?|draft\/2019-09\/schema#?|draft\/2020-12\/schema#?)$/u;
const MAX_DEPTH = 4;

function isRecord(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(code: ConfigSchemaErrorCode, error: string): MockConfigValidation {
  return { ok: false, code, error };
}

function validateNode(node: Node, depth: number, path: string): MockConfigValidation {
  for (const key of Object.keys(node)) {
    const code = FORBIDDEN.get(key);
    if (code) return invalid(code, `JSON Schema \`${key}\` keyword is not permitted in the Core Subset at ${path}`);
  }
  if (typeof node.type !== 'string' || !TYPES.has(node.type)) return invalid('invalid-schema', `${path} has an unsupported or missing type`);
  if (node['x-napplet-secret'] === true && Object.hasOwn(node, 'default')) return invalid('secret-with-default', `${path} combines x-napplet-secret with default`);
  if (node.type === 'object') {
    if (depth > MAX_DEPTH) return invalid('schema-too-deep', `${path} exceeds the four-level object depth limit`);
    if (node.properties !== undefined && !isRecord(node.properties)) return invalid('invalid-schema', `${path}.properties must be an object`);
    for (const [key, child] of Object.entries(node.properties ?? {})) {
      if (!isRecord(child)) return invalid('invalid-schema', `${path}.${key} must be an object schema`);
      const result = validateNode(child, child.type === 'object' ? depth + 1 : depth, `${path}.${key}`);
      if (!result.ok) return result;
    }
    return { ok: true };
  }
  if (node.type === 'array') {
    if (!isRecord(node.items)) return invalid('invalid-schema', `${path}.items must be one homogeneous schema`);
    if (node.items.type === 'object' || node.items.type === 'array') return invalid('invalid-schema', `${path} arrays may contain primitives only`);
    return validateNode(node.items, depth, `${path}[]`);
  }
  return { ok: true };
}

/**
 * Validate a schema against the NAP-CONFIG v1 Core Subset.
 *
 * @param schema - Napplet-supplied schema.
 * @returns `{ ok: true }` or the rejection code and message.
 * @example
 * ```ts
 * validateMockConfigSchema({ type: 'object', properties: { u: { type: 'string', pattern: '^a' } } });
 * // → { ok: false, code: 'pattern-not-allowed', error: '...' }
 * ```
 */
export function validateMockConfigSchema(schema: unknown): MockConfigValidation {
  if (!isRecord(schema) || schema.type !== 'object') return invalid('invalid-schema', 'schema root must be of type `object`');
  if (schema.$schema !== undefined && (typeof schema.$schema !== 'string' || !DRAFT.test(schema.$schema))) {
    return invalid('unsupported-draft', 'schema draft is not supported');
  }
  if (schema.$version !== undefined && (!Number.isSafeInteger(schema.$version) || Number(schema.$version) < 0)) {
    return invalid('invalid-schema', '$version must be a non-negative integer');
  }
  return validateNode(schema, 0, '$');
}

function within(value: number, minimum: unknown, maximum: unknown): boolean {
  return (typeof minimum !== 'number' || value >= minimum) && (typeof maximum !== 'number' || value <= maximum);
}

function conforms(node: Node, value: unknown): boolean {
  if (Array.isArray(node.enum) && !node.enum.some((item) => Object.is(item, value))) return false;
  switch (node.type) {
    case 'string': return typeof value === 'string' && within(value.length, node.minLength, node.maxLength);
    case 'number': return typeof value === 'number' && Number.isFinite(value) && within(value, node.minimum, node.maximum);
    case 'integer': return Number.isSafeInteger(value) && within(value as number, node.minimum, node.maximum);
    case 'boolean': return typeof value === 'boolean';
    case 'array': return Array.isArray(value) && isRecord(node.items) && within(value.length, node.minItems, node.maxItems)
      && value.every((item) => conforms(node.items as Node, item));
    default: return false;
  }
}

function resolveObject(node: Node, input: Node, inherited: Node): Node {
  const defaults = { ...inherited, ...(isRecord(node.default) ? node.default : {}) };
  const output: Node = {};
  for (const [key, child] of Object.entries(node.properties ?? {})) {
    if (!isRecord(child)) continue;
    if (child.type === 'object') {
      const nested = resolveObject(child, isRecord(input[key]) ? input[key] : {}, isRecord(defaults[key]) ? defaults[key] : {});
      const required = Array.isArray(child.required) ? child.required : [];
      if (required.every((name) => Object.hasOwn(nested, String(name)))) output[key] = nested;
      continue;
    }
    const candidate = input[key];
    if (candidate !== undefined && conforms(child, candidate)) output[key] = candidate;
    else if (child['x-napplet-secret'] === true) continue;
    else if (Object.hasOwn(child, 'default')) output[key] = child.default;
    else if (defaults[key] !== undefined && conforms(child, defaults[key])) output[key] = defaults[key];
  }
  return output;
}

/**
 * Resolve delivered values: persisted values that validate win, then the
 * property's own `default`, then an ancestor `default`; secrets only when set.
 *
 * @param schema - Accepted schema.
 * @param persisted - Raw persisted values.
 * @returns Validated, defaulted values.
 * @example
 * ```ts
 * resolveMockConfigValues(MOCK_CONFIG_SCHEMA, {}).theme === 'system';
 * ```
 */
export function resolveMockConfigValues(schema: NappletConfigSchema, persisted: ConfigValues): ConfigValues {
  return resolveObject(schema as Node, isRecord(persisted) ? persisted : {}, {});
}

function schemaHasSection(node: Node, section: string): boolean {
  for (const child of Object.values(node.properties ?? {})) {
    if (!isRecord(child)) continue;
    if (child['x-napplet-section'] === section) return true;
    if (child.type === 'object' && schemaHasSection(child, section)) return true;
  }
  return false;
}

function schemaError(context: MockRouteContext<MockConfigState>, code: ConfigSchemaErrorCode, error: string): void {
  context.push({ type: 'config.schemaError', code, error } as NappletMessage);
}

function valuesFor(windowId: string, state: MockConfigState, options: MockConfigOptions): ConfigValues | undefined {
  const schema = state.schemas.get(windowId)?.schema;
  if (!schema) return undefined;
  let store = state.stores.get(windowId);
  if (!store) {
    store = structuredClone(options.values ?? MOCK_CONFIG_VALUES);
    state.stores.set(windowId, store);
  }
  return resolveMockConfigValues(schema, store);
}

function handleRegister(context: MockRouteContext<MockConfigState>, options: MockConfigOptions): void {
  const { message, windowId, state, reply } = context;
  let validation = validateMockConfigSchema(message.schema);
  const schema = message.schema as NappletConfigSchema;
  const version = message.version ?? (validation.ok ? (schema as Node).$version : undefined);
  if (validation.ok && version !== undefined && (!Number.isSafeInteger(version) || Number(version) < 0)) {
    validation = invalid('invalid-schema', 'version must be a non-negative integer');
  }
  const prior = state.schemas.get(windowId)?.version;
  if (validation.ok && prior !== undefined && typeof version === 'number' && version < prior) {
    validation = invalid('version-conflict', 'schema version cannot move backwards');
  }
  if (!validation.ok) {
    reply({ ok: false, code: validation.code, error: validation.error });
    return;
  }
  state.schemas.set(windowId, { schema: structuredClone(schema), ...(typeof version === 'number' ? { version } : {}) });
  reply({ ok: true });
  if (state.subscribers.has(windowId)) {
    context.push({ type: 'config.values', values: valuesFor(windowId, state, options) } as NappletMessage);
  }
}

function handleOpenSettings(context: MockRouteContext<MockConfigState>): void {
  const { message, windowId, state, clock } = context;
  const schema = state.schemas.get(windowId)?.schema;
  if (!schema) return schemaError(context, 'no-schema', 'no configuration schema is registered');
  const section = typeof message.section === 'string' && schemaHasSection(schema as Node, message.section) ? message.section : undefined;
  state.settingsOpened.push({ windowId, ...(section ? { section } : {}), at: clock.now() });
}

/**
 * Create the NAP-CONFIG mock. The shell is the sole writer: napplets register
 * a schema and read; `commit()` plays the settings UI.
 *
 * @param options - Seed values and shared mock options.
 * @returns The config mock service.
 * @example
 * ```ts
 * const config = createMockConfigService();
 * config.handleMessage('w1', { type: 'config.registerSchema', id: 'r1', schema: MOCK_CONFIG_SCHEMA }, send);
 * config.handleMessage('w1', { type: 'config.get', id: 'g1' }, send);
 * // → { type: 'config.values', id: 'g1', values: { theme: 'dark', fontSize: 16, ... } }
 * ```
 */
export function createMockConfigService(options: MockConfigOptions = {}): MockConfigService {
  const base = defineMockService<MockConfigState>({
    domain: 'config',
    version: '1.0.0',
    description: 'Mock NAP-CONFIG per-napplet declarative configuration',
    kind: 'service',
    initialState: () => ({ schemas: new Map(), stores: new Map(), subscribers: new Set(), settingsOpened: [] }),
    routes: {
      'config.registerSchema': (context) => handleRegister(context, options),
      'config.get': (context) => {
        const values = valuesFor(context.windowId, context.state, options);
        if (!values) return schemaError(context, 'no-schema', 'no configuration schema is registered');
        const id = typeof context.message.id === 'string' ? context.message.id : '';
        context.push({ type: 'config.values', id, values } as NappletMessage);
      },
      'config.subscribe': (context) => {
        context.state.subscribers.add(context.windowId);
        const values = valuesFor(context.windowId, context.state, options);
        if (!values) return schemaError(context, 'no-schema', 'no configuration schema is registered');
        context.push({ type: 'config.values', values } as NappletMessage);
      },
      'config.unsubscribe': ({ windowId, state }) => { state.subscribers.delete(windowId); },
      'config.openSettings': handleOpenSettings,
    },
    onWindowDestroyed: (windowId, state) => {
      state.schemas.delete(windowId);
      state.stores.delete(windowId);
      state.subscribers.delete(windowId);
    },
    onCapabilityRevoked: (windowId, capability, state) => {
      if (capability === null || capability === 'config:read') state.subscribers.delete(windowId);
    },
  }, options);

  const service: MockConfigService = Object.assign(base, {
    commit(windowId: string, values: ConfigValues): ConfigValues | undefined {
      const state = base.mock.state();
      const schema = state.schemas.get(windowId)?.schema;
      if (!schema) return undefined;
      const resolved = resolveMockConfigValues(schema, values);
      state.stores.set(windowId, structuredClone(resolved));
      if (state.subscribers.has(windowId)) pushToWindow(base, windowId, { type: 'config.values', values: resolved } as NappletMessage);
      return resolved;
    },
  });
  return service;
}

/** Registry row for the config mock. */
export const CONFIG_MOCK_ENTRY: MockDomainEntry = {
  domain: 'config',
  kind: 'service',
  spec: CONFIG_SPEC_REF,
  create: (options) => createMockConfigService(options),
};
