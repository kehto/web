import type { DomainFixture, OperationCase, SemanticVerdict } from './types.js';

/** Core Subset schema: two defaulted settings and a never-set secret, under a declared section. */
const SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    theme: { type: 'string', enum: ['light', 'dark'], default: 'dark', 'x-napplet-section': 'display' },
    refresh: { type: 'integer', minimum: 1, maximum: 60, default: 15 },
    token: { type: 'string', 'x-napplet-secret': true },
  },
};

const DEFAULTS = { theme: 'dark', refresh: 15 };
const COMMITTED = { theme: 'light', refresh: 15 };

type Values = Readonly<Record<string, unknown>>;

/** Six nested object properties under the root: deeper than the four-level limit. */
const nested = (depth: number): Record<string, unknown> => (depth === 0 ? { type: 'string' } : { type: 'object', properties: { inner: nested(depth - 1) } });

/** A rejected registerSchema: positive-ACK `ok: false` with the NAP's code (its `error` text is part of that ACK). */
const rejectedSchema = (id: string, schema: Record<string, unknown>, code: string, rule: string): OperationCase => ({
  id, type: 'config.registerSchema', payload: { schema }, allowError: true,
  semantics: { rule, verify: (reply) => (reply?.ok === false && reply.code === code ? null : `ok ${JSON.stringify(reply?.ok)}, code ${JSON.stringify(reply?.code)}, expected ok: false with code ${code}`) },
});

/** The delivered values hold exactly `expected`: defaults applied, no orphan, no unset secret. */
function exactly(values: unknown, expected: Values): SemanticVerdict {
  if (!values || typeof values !== 'object') return `values was ${JSON.stringify(values)}`;
  const delivered = values as Values;
  const keys = Object.keys(delivered).sort();
  if (JSON.stringify(keys) !== JSON.stringify(Object.keys(expected).sort())) return `values carried ${JSON.stringify(keys)}, expected ${JSON.stringify(Object.keys(expected).sort())}`;
  const wrong = Object.keys(expected).find((key) => delivered[key] !== expected[key]);
  return wrong ? `values.${wrong} was ${JSON.stringify(delivered[wrong])}, expected ${JSON.stringify(expected[wrong])}` : null;
}

/** NAP-CONFIG at napplet/naps#14 (bed9cb5b): register, get with defaults, open settings, subscribe and commit. */
export const CONFIG_FIXTURE: DomainFixture = {
  domain: 'config',
  cases: [
    rejectedSchema('config/registerSchema-pattern', { type: 'object', properties: { username: { type: 'string', pattern: '^[a-z]+$' } } }, 'pattern-not-allowed',
      'A schema using pattern MUST get config.registerSchema.result ok: false (pattern-not-allowed)'),
    rejectedSchema('config/registerSchema-ref', { type: 'object', properties: { theme: { $ref: '#/definitions/theme' } }, definitions: { theme: { type: 'string' } } }, 'ref-not-allowed',
      'A schema using $ref or definitions MUST be rejected at registerSchema time (ref-not-allowed)'),
    rejectedSchema('config/registerSchema-too-deep', { type: 'object', properties: { outer: nested(6) } }, 'schema-too-deep',
      'Object nesting deeper than four levels MUST be rejected with ok: false, code: "schema-too-deep"'),
    rejectedSchema('config/registerSchema-secret-default', { type: 'object', properties: { token: { type: 'string', 'x-napplet-secret': true, default: 'hunter2' } } }, 'secret-with-default',
      'x-napplet-secret with a declared default MUST be rejected with code "secret-with-default"'),
    {
      id: 'config/registerSchema', type: 'config.registerSchema', payload: { schema: SCHEMA, version: 1 },
      semantics: { rule: 'registerSchema is positive-ACK: a Core Subset schema gets config.registerSchema.result with ok: true', verify: (reply) => (reply?.ok === true ? null : `ok was ${JSON.stringify(reply?.ok)}`) },
    },
    {
      id: 'config/get', type: 'config.get', reply: 'config.values',
      semantics: {
        rule: 'config.get answers with config.values: declared defaults applied, persisted orphans and never-set x-napplet-secret properties not delivered',
        verify: (reply) => exactly(reply?.values, DEFAULTS),
      },
    },
    { id: 'config/openSettings', type: 'config.openSettings', payload: { section: 'display' }, reply: null, noId: true },
  ],
  pushes: [
    {
      // The snapshot is produced by config.subscribe itself, so the push has no host trigger.
      id: 'config/subscribe-snapshot', type: 'config.values',
      subscribe: { id: 'config/subscribe', type: 'config.subscribe', reply: null, noId: true },
      semantics: {
        rule: 'config.subscribe produces an immediate initial config.values snapshot without id, validated and defaulted',
        verify: (push) => (push && 'id' in push ? `the snapshot carried id ${JSON.stringify(push.id)}` : exactly(push?.values, DEFAULTS)),
      },
    },
    {
      id: 'config/values-commit', type: 'config.values', trigger: { control: 'config.commit', payload: { theme: 'light' } },
      isolation: { setup: ['config/registerSchema', 'config/subscribe'] },
      match: { values: COMMITTED },
      then: [{ id: 'config/get-after-commit', type: 'config.get', reply: 'config.values' }],
      unsubscribe: { id: 'config/unsubscribe', type: 'config.unsubscribe', reply: null, noId: true },
      semantics: {
        rule: 'A settings-UI commit is pushed to the subscriber as config.values, and config.get then returns the committed values',
        verify: (push, replies) => exactly(push?.values, COMMITTED) ?? exactly(replies['config/get-after-commit']?.values, COMMITTED),
      },
    },
  ],
};
