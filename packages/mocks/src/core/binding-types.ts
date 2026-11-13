/**
 * core/binding-types.ts — Shape of the generated napplet-facing bindings.
 *
 * The shape is structurally compatible with `@kehto/shell`'s
 * `NappletDomainBinding`, so a host can pass a binding straight to the
 * namespace prelude without this package depending on the shell.
 */

/**
 * One NAP operation bound to a request envelope.
 *
 * @example
 * ```ts
 * const add: MockNappletBindingMethod = { type: 'torrent.add', params: ['request'], reply: true, result: 'ack' };
 * ```
 */
export interface MockNappletBindingMethod {
  /** Exact wire request type, `<domain>.<action>`. */
  readonly type: string;
  /** Wire request fields, filled from the method's positional arguments. */
  readonly params: readonly string[];
  /** Whether a `<type>.result` envelope answers the request. */
  readonly reply: boolean;
  /** `false` when the wire request carries no correlation `id`. Default `true`. */
  readonly id?: boolean;
  /** Result field to resolve with; absent means the payload minus `type`/`id`. */
  readonly result?: string;
}

/**
 * Napplet-facing binding for one mocked NAP domain.
 *
 * @example
 * ```ts
 * const binding: MockNappletBinding = MOCK_NAPPLET_BINDINGS.value;
 * binding.handlers.onStatus; // ['value.status.changed']
 * ```
 */
export interface MockNappletBinding {
  /** NAP document and abbreviated sha the table was generated from. */
  readonly spec: { readonly nap: string; readonly sha: string };
  /** Operation name → request envelope. */
  readonly methods: Readonly<Record<string, MockNappletBindingMethod>>;
  /** Host → napplet push types, deliverable through `on(event, handler)`. */
  readonly events: readonly string[];
  /** Named NAP handlers (`onState`, …) → the push types they receive. */
  readonly handlers: Readonly<Record<string, readonly string[]>>;
  /** API rows with no wire message (local caches, local helpers), not bound. */
  readonly gaps: readonly string[];
}
