/**
 * Table-driven `window.napplet.<domain>` bindings for NAP domains the prelude
 * has no built-in implementation for (draft NAPs served by a host service or a
 * `@kehto/mocks` mock). The host supplies one table per domain; the prelude turns
 * each row into a method over the private NIP-5D port.
 */

/**
 * One NAP operation bound to a request envelope.
 *
 * @example
 * ```ts
 * const add: NappletBindingMethod = { type: 'torrent.add', params: ['request'], reply: true, result: 'ack' };
 * ```
 */
export interface NappletBindingMethod {
  /** Exact wire request type; must start with `<domain>.`. */
  readonly type: string;
  /** Wire request fields filled from the method's positional arguments. */
  readonly params: readonly string[];
  /** Whether a `<type>.result` envelope answers the request. */
  readonly reply: boolean;
  /** `false` when the wire request carries no correlation `id`. Default `true`. */
  readonly id?: boolean;
  /** Result field to resolve with; absent resolves the payload minus `type`/`id`. */
  readonly result?: string;
}

/**
 * Binding table for one domain. Methods resolve with the result field (or the
 * payload), reject with an `Error` carrying `code` when the result has `error`,
 * and fire-and-forget when `reply` is false. `on(event, handler)` and the named
 * `handlers` deliver pushes as `handler(payload, type)`.
 *
 * @example
 * ```ts
 * const value: NappletDomainBinding = {
 *   methods: { status: { type: 'value.status', params: ['transferId'], reply: true, result: 'status' } },
 *   events: ['value.status.changed'],
 *   handlers: { onStatus: ['value.status.changed'] },
 * };
 * ```
 */
export interface NappletDomainBinding {
  /** Operation name → request envelope. */
  readonly methods: Readonly<Record<string, NappletBindingMethod>>;
  /** Push types (`<domain>.<event>`) deliverable through `on(event, handler)`. */
  readonly events?: readonly string[];
  /** Named handler (`onState`, …) → push types it receives. */
  readonly handlers?: Readonly<Record<string, readonly string[]>>;
}

/** Serializable binding the prelude consumes after validation. */
export interface SerializedDomainBinding {
  methods: Record<string, { type: string; params: string[]; reply: boolean; id: boolean; result: string | null }>;
  events: string[];
  handlers: Record<string, string[]>;
}

/**
 * Domains the prelude implements itself. Host bindings for these are ignored so
 * a table can never replace a built-in NAP binding.
 *
 * @example
 * ```ts
 * NAPPLET_PRELUDE_BUILT_IN_DOMAINS.includes('relay'); // true
 * ```
 */
export const NAPPLET_PRELUDE_BUILT_IN_DOMAINS: readonly string[] = Object.freeze([
  'shell', 'inc', 'media', 'gamepad', 'identity', 'theme', 'intent', 'relay', 'storage', 'keys', 'notify',
  'config', 'resource', 'cvm', 'outbox', 'upload', 'webrtc', 'ble', 'link', 'count', 'lists', 'common',
  'serial', 'dm', 'fs', 'llm',
]);

const NAME = /^[a-zA-Z][a-zA-Z0-9]*$/;
const RESERVED = new Set(['on', 'constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty']);

function fail(domain: string, detail: string): never {
  throw new TypeError(`Invalid napplet binding for "${domain}": ${detail}`);
}

function wireType(domain: string, value: unknown, what: string): string {
  if (typeof value !== 'string' || !value.startsWith(`${domain}.`) || !/^[a-z][a-z0-9-]*(\.[a-zA-Z][a-zA-Z0-9]*)+$/.test(value)) {
    fail(domain, `${what} must be a "${domain}.<action>" type`);
  }
  return value;
}

/**
 * Validate host bindings for the exposed domains and drop bindings for domains
 * that are not exposed or are built into the prelude
 * ({@link NAPPLET_PRELUDE_BUILT_IN_DOMAINS}).
 *
 * @param bindings - Host bindings by bare domain.
 * @param domains - Domains exposed to this napplet.
 * @returns Validated, plain-data bindings for the exposed domains.
 * @throws TypeError when a binding row is malformed.
 * @example
 * ```ts
 * const serialized = serializeDomainBindings({ value: binding }, ['shell', 'value']);
 * ```
 */
export function serializeDomainBindings(
  bindings: Readonly<Record<string, NappletDomainBinding>> | undefined,
  domains: readonly string[],
): Record<string, SerializedDomainBinding> {
  const out: Record<string, SerializedDomainBinding> = {};
  for (const domain of domains) {
    if (!bindings || !Object.hasOwn(bindings, domain) || NAPPLET_PRELUDE_BUILT_IN_DOMAINS.includes(domain)) continue;
    const binding = bindings[domain]!;
    const methods: SerializedDomainBinding['methods'] = {};
    for (const [name, method] of Object.entries(binding.methods ?? {})) {
      if (!NAME.test(name) || RESERVED.has(name) || /^on[A-Z]/.test(name)) fail(domain, `method name "${name}" is not allowed`);
      if (!Array.isArray(method.params) || !method.params.every((param) => typeof param === 'string' && NAME.test(param) && param !== 'type' && param !== 'id')) {
        fail(domain, `${name}.params must be wire field names`);
      }
      if (method.result !== undefined && (typeof method.result !== 'string' || !NAME.test(method.result))) fail(domain, `${name}.result must be a field name`);
      methods[name] = {
        type: wireType(domain, method.type, `${name}.type`),
        params: [...method.params],
        reply: method.reply === true,
        id: method.id !== false,
        result: method.result ?? null,
      };
    }
    const events = (binding.events ?? []).map((event) => wireType(domain, event, 'event'));
    const handlers: Record<string, string[]> = {};
    for (const [name, types] of Object.entries(binding.handlers ?? {})) {
      if (!/^on[A-Z][a-zA-Z0-9]*$/.test(name)) fail(domain, `handler name "${name}" must look like onEvent`);
      handlers[name] = types.map((type) => {
        if (!events.includes(type)) fail(domain, `handler ${name} lists ${type}, which is not an event`);
        return type;
      });
    }
    out[domain] = { methods, events, handlers };
  }
  return out;
}
