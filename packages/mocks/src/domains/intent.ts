/**
 * domains/intent.ts — Mock NAP-INTENT service.
 *
 * Spec: naps/NAP-INTENT.md @ napplet/naps master 43cb3a4e8555 (merged);
 *   drafts PR #106 head fc121fc2 and PR #128 head 74f9bf85 consulted.
 * Routes: intent.invoke, intent.available, intent.handlers;
 *   pushes intent.changed, intent.deliver
 * Spec gaps / decisions:
 *   - Master is the authority. From PR #106 the mock includes
 *     `request.handlerHint` (`{ address: '35129:<pubkey>:<d>', relays? }`,
 *     used at resolution step 3 when it names an installed, supporting
 *     candidate) and treats `handler` as an opaque catalog identifier — both
 *     already shipped in kehto's reference service. Deferred from PR #128:
 *     shell-selected-instance replay (no wire change; shell-internal).
 *   - `@napplet/nap/intent/types` re-exports `@napplet/core` shapes that lag
 *     the document (dTag-keyed candidates, `handled`/`windowId` on results),
 *     so the doc-shaped payload types are defined here.
 *   - The runtime "chooser" is modeled as "first supporting candidate" when no
 *     default applies or `handler: 'choose'` is requested. A `handler` that is
 *     not a supporting candidate is `invoke rejected`.
 *   - Catalog identity per window comes from `options.windows` /
 *     `bindWindow()`; an unbound window's `sender` is
 *     `catalog-window-<windowId>` (the runtime must assign one).
 *   - `intent.deliver` is pushed to the window bound to the resolved handler
 *     once such a window is known; until then the delivery is retained as
 *     pending in `state.deliveries` and flushed by `bindWindow()`.
 */
import type { NappletMessage } from '@kehto/runtime';
import { defineMockService, pushToWindow, type MockRouteContext } from '../core/handler.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';
import {
  MOCK_NAPPLETS,
  mockArchetypes,
  mockContractsFor,
  mockNappletAddress,
  parseMockConvention,
  resolveMockHandler,
  type MockIntentContract,
  type MockNapplet,
} from './intent-fixtures.js';

export {
  MOCK_NAPPLETS,
  mockArchetypes,
  mockContractsFor,
  mockNappletAddress,
  parseMockConvention,
  resolveMockHandler,
  type MockIntentContract,
  type MockNapplet,
  type MockNappletKind,
} from './intent-fixtures.js';

/** Spec document read when this mock was written. */
export const INTENT_SPEC_REF: NapSpecRef = {
  nap: 'NAP-INTENT',
  status: 'merged',
  source: 'master',
  sha: '43cb3a4e8555',
  path: 'naps/NAP-INTENT.md',
};

/** Lifecycle and focus hints (`IntentBehavior`). */
export interface MockIntentBehavior {
  /** Request focus for the target surface. */
  focus?: boolean;
  /** Permit reuse of an existing matching target. */
  reuse?: boolean;
}

/** Recommended handler coordinate (`IntentHandlerHint`, PR #106). */
export interface MockIntentHandlerHint {
  /** `35129:<pubkey>:<d>` coordinate. */
  address: string;
  /** Optional relay discovery hints. */
  relays?: readonly string[];
}

/** Normalized wire request (`IntentRequest`). */
export interface MockIntentRequest {
  /** Role derived from the convention URI. */
  archetype: string;
  /** Intent derived from the convention URI. */
  action: string;
  /** Stable queryless convention identity. */
  convention: string;
  /** Query-derived text map or explicit payload. */
  payload?: unknown;
  /** `default`, `choose`, or an authorized catalog identifier. */
  handler?: string;
  /** Recommendation (PR #106). */
  handlerHint?: MockIntentHandlerHint;
  /** Lifecycle hints. */
  behavior?: MockIntentBehavior;
}

/** One installed handler for a role (`IntentCandidate`). */
export interface MockIntentCandidate {
  /** Catalog identifier. */
  id: string;
  /** Human-readable label. */
  title?: string;
  /** Actions derived from the role's contracts. */
  actions: string[];
  /** Stable convention identities. */
  conventions: string[];
  /** Parsed manifest contracts for this role. */
  contracts: MockIntentContract[];
  /** Whether this candidate is the user's default. */
  isDefault: boolean;
}

/** Availability of one role (`IntentAvailability`). */
export interface MockIntentAvailability {
  /** Queried role. */
  archetype: string;
  /** Whether at least one candidate exists. */
  available: boolean;
  /** Installed candidates. */
  candidates: MockIntentCandidate[];
  /** Whether a user default applies. */
  hasDefault: boolean;
}

/** Invocation result (`IntentResult`). */
export type MockIntentResult =
  | { ok: true; archetype: string; action: string; convention: string; handler: string }
  | { ok: false; error: string };

/** Target-side delivery (`IntentDelivery`). */
export interface MockIntentDelivery {
  /** Runtime-attested source catalog identifier. */
  sender: string;
  /** Normalized target role. */
  archetype: string;
  /** Normalized action. */
  action: string;
  /** Stable convention identity. */
  convention: string;
  /** Normalized payload. */
  payload?: unknown;
}

/**
 * One accepted invocation retained by the runtime.
 *
 * @example
 * ```ts
 * service.mock.state().deliveries[0]?.delivered; // true once pushed
 * ```
 */
export interface MockIntentDeliveryRecord {
  /** Resolved handler catalog id. */
  target: string;
  /** Delivery payload for the target. */
  delivery: MockIntentDelivery;
  /** Whether `intent.deliver` has been pushed to a bound window. */
  delivered: boolean;
}

/**
 * In-memory state of the intent mock.
 *
 * @example
 * ```ts
 * service.mock.state().defaults.get('feed');
 * ```
 */
export interface MockIntentState {
  /** Installed catalog. */
  napplets: MockNapplet[];
  /** User default handler per archetype. */
  defaults: Map<string, string>;
  /** Window → catalog identifier. */
  windows: Map<string, string>;
  /** Accepted invocations, oldest first. */
  deliveries: MockIntentDeliveryRecord[];
  /** Windows that have talked to the mock (receive `intent.changed`). */
  seen: Set<string>;
}

/**
 * Options for `createMockIntentService`.
 *
 * @example
 * ```ts
 * const options: MockIntentOptions = { defaults: { feed: 'catalog-note-viewer' }, windows: { w1: 'catalog-distro-tracker' } };
 * ```
 */
export interface MockIntentOptions extends MockServiceOptions {
  /** Installed catalog. Default `MOCK_NAPPLETS`. */
  napplets?: readonly MockNapplet[];
  /** Initial user defaults per archetype. */
  defaults?: Readonly<Record<string, string>>;
  /** Initial window → catalog identifier bindings. */
  windows?: Readonly<Record<string, string>>;
}

/**
 * The intent mock service with its `bindWindow` and `setDefault` controls.
 *
 * @example
 * ```ts
 * const intent = createMockIntentService();
 * intent.bindWindow('w2', 'catalog-profile-viewer'); // flushes pending deliveries to w2
 * intent.setDefault('feed', 'catalog-note-viewer');  // pushes intent.changed
 * ```
 */
export type MockIntentService = MockService<MockIntentState> & {
  /**
   * Bind a window to a catalog identifier (its verified manifest) and push any
   * pending `intent.deliver` for that identifier to it.
   *
   * @param windowId - Live window.
   * @param catalogId - Catalog identifier the window runs.
   */
  bindWindow(windowId: string, catalogId: string): void;
  /**
   * Set or clear the user's default handler for a role and push
   * `intent.changed` to every known window.
   *
   * @param archetype - Role slug.
   * @param catalogId - Default handler id, or `null` to clear.
   * @returns The availability that was broadcast.
   */
  setDefault(archetype: string, catalogId: string | null): MockIntentAvailability;
};

const REQUEST_KEYS = new Set(['archetype', 'action', 'convention', 'payload', 'handler', 'handlerHint', 'behavior']);
const HINT_ADDRESS = /^35129:[a-f0-9]{64}:.+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseHint(raw: unknown): MockIntentHandlerHint | undefined {
  if (!isRecord(raw) || typeof raw.address !== 'string' || !HINT_ADDRESS.test(raw.address)) return undefined;
  if (raw.relays !== undefined && (!Array.isArray(raw.relays) || raw.relays.some((relay) => typeof relay !== 'string'))) return undefined;
  return { address: raw.address, ...(Array.isArray(raw.relays) ? { relays: [...raw.relays] as string[] } : {}) };
}

function parseRequest(raw: unknown): MockIntentRequest | undefined {
  if (!isRecord(raw) || Object.keys(raw).some((key) => !REQUEST_KEYS.has(key))) return undefined;
  const parts = parseMockConvention(raw.convention);
  if (!parts || parts.archetype !== raw.archetype || parts.action !== raw.action) return undefined;
  if (raw.handler !== undefined && (typeof raw.handler !== 'string' || raw.handler.length === 0)) return undefined;
  const handlerHint = raw.handlerHint === undefined ? undefined : parseHint(raw.handlerHint);
  if (raw.handlerHint !== undefined && !handlerHint) return undefined;
  const behavior = raw.behavior;
  if (behavior !== undefined && (!isRecord(behavior) || Object.keys(behavior).some((key) => key !== 'focus' && key !== 'reuse')
    || (behavior.focus !== undefined && typeof behavior.focus !== 'boolean') || (behavior.reuse !== undefined && typeof behavior.reuse !== 'boolean'))) {
    return undefined;
  }
  return {
    archetype: parts.archetype,
    action: parts.action,
    convention: raw.convention as string,
    ...(Object.hasOwn(raw, 'payload') ? { payload: raw.payload } : {}),
    ...(typeof raw.handler === 'string' ? { handler: raw.handler } : {}),
    ...(handlerHint ? { handlerHint } : {}),
    ...(isRecord(behavior) ? { behavior: behavior as MockIntentBehavior } : {}),
  };
}

/**
 * Build the availability record for one role from a catalog.
 *
 * @param napplets - Installed napplets.
 * @param archetype - Role slug.
 * @param defaults - User defaults.
 * @returns Availability with candidates in catalog order.
 * @example
 * ```ts
 * mockIntentAvailability(MOCK_NAPPLETS, 'profile', new Map()).candidates[0]?.id === 'catalog-profile-viewer';
 * ```
 */
export function mockIntentAvailability(napplets: readonly MockNapplet[], archetype: string, defaults: ReadonlyMap<string, string>): MockIntentAvailability {
  const preferred = defaults.get(archetype);
  const candidates: MockIntentCandidate[] = [];
  for (const napplet of napplets) {
    const contracts = mockContractsFor(napplet, archetype);
    if (contracts.length === 0) continue;
    const actions = [...new Set(contracts.map((contract) => parseMockConvention(contract.convention)?.action ?? ''))];
    candidates.push({
      id: napplet.id,
      ...(napplet.title ? { title: napplet.title } : {}),
      actions,
      conventions: [...new Set(contracts.map((contract) => contract.convention))],
      contracts: contracts.map((contract) => ({ convention: contract.convention, params: [...contract.params] })),
      isDefault: napplet.id === preferred,
    });
  }
  return { archetype, available: candidates.length > 0, candidates, hasDefault: candidates.some((candidate) => candidate.isDefault) };
}

function resolveHandler(request: MockIntentRequest, state: MockIntentState): MockIntentResult {
  const candidates = state.napplets.filter((napplet) => mockContractsFor(napplet, request.archetype).length > 0);
  if (candidates.length === 0) return { ok: false, error: 'no handler' };
  const supporting = candidates.filter((napplet) => mockContractsFor(napplet, request.archetype).some((contract) => contract.convention === request.convention));
  if (supporting.length === 0) return { ok: false, error: 'unsupported convention' };
  let handler: string | undefined;
  if (request.handler && request.handler !== 'default' && request.handler !== 'choose') {
    if (!supporting.some((napplet) => napplet.id === request.handler)) return { ok: false, error: 'invoke rejected' };
    handler = request.handler;
  } else if (request.handler !== 'choose') {
    const preferred = state.defaults.get(request.archetype);
    if (preferred && supporting.some((napplet) => napplet.id === preferred)) handler = preferred;
    else if (request.handlerHint) handler = supporting.find((napplet) => mockNappletAddress(napplet) === request.handlerHint?.address)?.id;
  }
  handler ??= (supporting[0] as MockNapplet).id;
  return { ok: true, archetype: request.archetype, action: request.action, convention: request.convention, handler };
}

function windowFor(catalogId: string, state: MockIntentState): string | undefined {
  for (const [windowId, bound] of state.windows) if (bound === catalogId) return windowId;
  return undefined;
}

function handleInvoke(context: MockRouteContext<MockIntentState>, service: MockService<MockIntentState>): void {
  const { message, windowId, state, reply } = context;
  const request = parseRequest(message.request);
  if (!request) return reply({ result: { ok: false, error: 'invalid convention' } satisfies MockIntentResult });
  const result = resolveHandler(request, state);
  reply({ result });
  if (!result.ok) return;
  const delivery: MockIntentDelivery = {
    sender: state.windows.get(windowId) ?? `catalog-window-${windowId}`,
    archetype: result.archetype,
    action: result.action,
    convention: result.convention,
    ...(Object.hasOwn(request, 'payload') ? { payload: request.payload } : {}),
  };
  const record: MockIntentDeliveryRecord = { target: result.handler, delivery, delivered: false };
  state.deliveries.push(record);
  const target = windowFor(result.handler, state);
  if (target) record.delivered = pushToWindow(service, target, { type: 'intent.deliver', delivery } as NappletMessage);
}

/**
 * Create the NAP-INTENT mock backed by `MOCK_NAPPLETS` (or a custom catalog).
 *
 * @param options - Catalog, defaults, window bindings, and shared mock options.
 * @returns The intent mock service.
 * @example
 * ```ts
 * const intent = createMockIntentService({ windows: { w1: 'catalog-distro-tracker' } });
 * intent.handleMessage('w1', { type: 'intent.invoke', id: 'i1', request: { archetype: 'profile', action: 'open', convention: 'napplet:profile/open', payload: { pubkey: 'abc' } } }, send);
 * // → { type: 'intent.invoke.result', id: 'i1', result: { ok: true, archetype: 'profile', action: 'open', convention: 'napplet:profile/open', handler: 'catalog-profile-viewer' } }
 * ```
 */
export function createMockIntentService(options: MockIntentOptions = {}): MockIntentService {
  const base = defineMockService<MockIntentState>({
    domain: 'intent',
    version: '1.0.0',
    description: 'Mock NAP-INTENT archetype intent dispatcher',
    kind: 'service',
    initialState: () => ({
      napplets: [...(options.napplets ?? MOCK_NAPPLETS)],
      defaults: new Map(Object.entries(options.defaults ?? {})),
      windows: new Map(Object.entries(options.windows ?? {})),
      deliveries: [],
      seen: new Set(),
    }),
    routes: {
      'intent.invoke': (context) => { context.state.seen.add(context.windowId); handleInvoke(context, base); },
      'intent.available': ({ message, windowId, state, reply }) => {
        state.seen.add(windowId);
        if (typeof message.archetype !== 'string' || message.archetype.length === 0) return reply({ error: 'invalid archetype' });
        reply({ availability: mockIntentAvailability(state.napplets, message.archetype, state.defaults) });
      },
      'intent.handlers': ({ windowId, state, reply }) => {
        state.seen.add(windowId);
        reply({ handlers: mockArchetypes(state.napplets).map((archetype) => mockIntentAvailability(state.napplets, archetype, state.defaults)) });
      },
    },
    onWindowDestroyed: (windowId, state) => {
      state.windows.delete(windowId);
      state.seen.delete(windowId);
    },
  }, options);

  const service: MockIntentService = Object.assign(base, {
    bindWindow(windowId: string, catalogId: string): void {
      const state = base.mock.state();
      state.windows.set(windowId, catalogId);
      for (const record of state.deliveries) {
        if (record.delivered || record.target !== catalogId) continue;
        record.delivered = pushToWindow(base, windowId, { type: 'intent.deliver', delivery: record.delivery } as NappletMessage);
      }
    },
    setDefault(archetype: string, catalogId: string | null): MockIntentAvailability {
      const state = base.mock.state();
      if (catalogId === null) state.defaults.delete(archetype);
      else state.defaults.set(archetype, catalogId);
      const availability = mockIntentAvailability(state.napplets, archetype, state.defaults);
      const targets = new Set([...state.seen, ...state.windows.keys(), ...(base.mock.runtime?.listWindowIds() ?? [])]);
      for (const windowId of targets) pushToWindow(base, windowId, { type: 'intent.changed', availability } as NappletMessage);
      return availability;
    },
  });
  return service;
}

/** Registry row for the intent mock. */
export const INTENT_MOCK_ENTRY: MockDomainEntry = {
  domain: 'intent',
  kind: 'service',
  spec: INTENT_SPEC_REF,
  create: (options) => createMockIntentService(options),
};
