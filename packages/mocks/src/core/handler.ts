/**
 * core/handler.ts — `defineMockService`: build a `ServiceHandler` from a map of
 * exact message types to route functions, with the shared `mock` controls.
 */
import type { NappletMessage, ServiceRuntimeContext } from '@kehto/runtime';
import { createSeededRng, type SeededRng } from './rng.js';
import type {
  MockCapabilityMap,
  MockClock,
  MockScheduler,
  MockSentEnvelope,
  MockService,
  MockServiceOptions,
} from './types.js';

/** Delivery internals per mock service, keyed by the service object (never enumerable on it). */
interface MockDelivery {
  /** Push through the runtime context (or the window's last `send`); `true` only when delivered. */
  push(windowId: string, message: NappletMessage): boolean;
  /** Record and send through a caller-supplied callback. */
  through(windowId: string, message: NappletMessage, send: (msg: NappletMessage) => void): void;
}

const DELIVERY = new WeakMap<MockService, MockDelivery>();

/**
 * Per-request context handed to a route.
 *
 * @example
 * ```ts
 * const route = ({ message, reply }: MockRouteContext<{ items: string[] }>) => {
 *   reply({ items: [] });
 * };
 * ```
 */
export interface MockRouteContext<TState> {
  /** Requesting napplet window. */
  windowId: string;
  /** Inbound envelope (already matched by exact `type`). */
  message: NappletMessage & Record<string, unknown>;
  /** Raw send callback supplied by the runtime for this request. */
  send: (msg: NappletMessage) => void;
  /**
   * Send `${message.type}.result` carrying the request `id` and `fields`.
   * Honors `latencyMs` from the factory options.
   */
  reply(fields?: Record<string, unknown>): void;
  /**
   * Send `${message.type}.result` with `{ id, error }` and any extra fields.
   */
  fail(error: string, fields?: Record<string, unknown>): void;
  /** Push an arbitrary envelope to this window (immediately or after latency). */
  push(message: NappletMessage): void;
  /** Mutable mock state. */
  state: TState;
  /** Seeded generator shared by the mock instance. */
  rng: SeededRng;
  /** Clock from the factory options. */
  clock: MockClock;
  /** Runtime context when attached via `onRegistered`. */
  runtime: ServiceRuntimeContext | undefined;
}

/** A route: handles one exact message type. */
export type MockRoute<TState> = (context: MockRouteContext<TState>) => void;

/**
 * Declarative description consumed by `defineMockService`.
 *
 * @example
 * ```ts
 * const service = defineMockService<{ count: number }>({
 *   domain: 'ping',
 *   version: '1.0.0',
 *   kind: 'extension',
 *   initialState: () => ({ count: 0 }),
 *   routes: {
 *     'ping.send': ({ state, reply }) => { state.count += 1; reply({ count: state.count }); },
 *   },
 * });
 * ```
 */
export interface MockServiceDefinition<TState> {
  /** Wire domain and descriptor name. */
  domain: string;
  /** Descriptor version. */
  version: string;
  /** Descriptor description. */
  description?: string;
  /**
   * `service` for built-in runtime domains (no `messageCapabilities` emitted
   * unless `capabilities` is given); `extension` for domains outside the
   * built-in dispatcher (every route is published with `null` unless
   * overridden by `capabilities`).
   */
  kind: 'service' | 'extension';
  /** Explicit capability requirements per message type. */
  capabilities?: MockCapabilityMap;
  /**
   * Shell -> napplet push types this mock emits outside a request, each mapped
   * to the recipient capability or explicit `null`. Published as the handler's
   * `pushCapabilities`, which is how `ServiceRuntimeContext.sendToEligibleNapplet`
   * authorizes a push into a domain outside the built-in dispatcher. Built-in
   * domains keep the runtime's own recipient mapping.
   */
  pushes?: MockCapabilityMap;
  /** Build the initial state (called on construction and on `reset`). */
  initialState: (rng: SeededRng, options: MockServiceOptions) => TState;
  /** Exact message type → handler. */
  routes: Readonly<Record<string, MockRoute<TState>>>;
  /** Extra per-window cleanup (state cleanup for the destroyed window). */
  onWindowDestroyed?: (windowId: string, state: TState) => void;
  /** Hook run once the runtime attaches the handler. */
  onRegistered?: (runtime: ServiceRuntimeContext, state: TState) => void;
  /** Hook run when the runtime detaches the handler. */
  onUnregistered?: (state: TState) => void;
  /** Hook run when a capability is revoked for a window. */
  onCapabilityRevoked?: (windowId: string, capability: string | null, state: TState) => void;
}

/** Default scheduler backed by `setTimeout`. */
export const DEFAULT_SCHEDULER: MockScheduler = {
  schedule(delayMs, fn) {
    const handle = setTimeout(fn, delayMs);
    return () => clearTimeout(handle);
  },
};

/** Default clock backed by `Date.now`. */
export const DEFAULT_CLOCK: MockClock = { now: () => Date.now() };

/**
 * Result type for a matched request: `<request type>.result`.
 *
 * @param type - Request message type.
 * @returns The result type.
 * @example
 * ```ts
 * resultType('link.open') === 'link.open.result';
 * ```
 */
export function resultType(type: string): string {
  return `${type}.result`;
}

/**
 * Build a `MockService` from a definition.
 *
 * @param definition - Domain, routes, and state factory.
 * @param options - Seed, clock, scheduler, latency.
 * @returns A `ServiceHandler` with `mock` controls.
 * @example
 * ```ts
 * const echo = defineMockService<{ seen: number }>({
 *   domain: 'echo',
 *   version: '0.1.0',
 *   kind: 'extension',
 *   initialState: () => ({ seen: 0 }),
 *   routes: { 'echo.say': ({ message, reply, state }) => { state.seen += 1; reply({ text: message.text }); } },
 * });
 * ```
 */
export function defineMockService<TState>(
  definition: MockServiceDefinition<TState>,
  options: MockServiceOptions = {},
): MockService<TState> {
  const seed = options.seed ?? 1;
  const clock = options.clock ?? DEFAULT_CLOCK;
  const scheduler = options.scheduler ?? DEFAULT_SCHEDULER;
  const latencyMs = options.latencyMs ?? 0;
  const sent: MockSentEnvelope[] = [];
  const pending = new Set<() => void>();
  let rng = createSeededRng(seed);
  let state = definition.initialState(rng, options);
  let runtime: ServiceRuntimeContext | undefined;
  const lastSend = new Map<string, (msg: NappletMessage) => void>();

  const record = (windowId: string, message: NappletMessage): void => { sent.push({ windowId, message }); };
  const deliver = (windowId: string, message: NappletMessage, send: (msg: NappletMessage) => void): void => {
    record(windowId, message);
    send(message);
  };
  const later = (fn: () => void): void => {
    if (latencyMs <= 0) {
      fn();
      return;
    }
    const cancel = scheduler.schedule(latencyMs, () => {
      pending.delete(cancel);
      fn();
    });
    pending.add(cancel);
  };
  const pushTo = (windowId: string, message: NappletMessage): boolean => {
    if (runtime) {
      // The runtime decides eligibility (live source, domain grant, recipient
      // capability). A refused push is reported, never recorded as sent.
      const delivered = runtime.sendToEligibleNapplet(windowId, message);
      if (delivered) record(windowId, message);
      return delivered;
    }
    const send = lastSend.get(windowId);
    if (!send) return false;
    deliver(windowId, message, send);
    return true;
  };

  const routes = Object.freeze(Object.keys(definition.routes));
  const messageCapabilities = buildCapabilities(definition, routes);
  const pushCapabilities = definition.pushes ? Object.freeze({ ...definition.pushes }) : undefined;

  const service: MockService<TState> = {
    descriptor: {
      name: definition.domain,
      version: definition.version,
      ...(definition.description ? { description: definition.description } : {}),
    },
    ...(messageCapabilities ? { messageCapabilities } : {}),
    ...(pushCapabilities ? { pushCapabilities } : {}),
    mock: {
      state: () => state,
      reset: () => {
        for (const cancel of pending) cancel();
        pending.clear();
        sent.length = 0;
        lastSend.clear();
        rng = createSeededRng(seed);
        state = definition.initialState(rng, options);
      },
      routes,
      sent,
      get runtime() { return runtime; },
    },
    onRegistered(context) {
      runtime = context;
      definition.onRegistered?.(context, state);
    },
    onUnregistered() {
      definition.onUnregistered?.(state);
      runtime = undefined;
    },
    handleMessage(windowId, message, send) {
      const route = Object.hasOwn(definition.routes, message.type) ? definition.routes[message.type] : undefined;
      if (!route) return;
      lastSend.set(windowId, send);
      const rawId = (message as { id?: unknown }).id;
      const id = typeof rawId === 'string' ? rawId : undefined;
      const withId = (fields: Record<string, unknown>): NappletMessage =>
        ({ type: resultType(message.type), ...(id !== undefined ? { id } : {}), ...fields }) as NappletMessage;
      route({
        windowId,
        message: message as NappletMessage & Record<string, unknown>,
        send,
        reply: (fields = {}) => later(() => deliver(windowId, withId(fields), send)),
        fail: (error, fields = {}) => later(() => deliver(windowId, withId({ ...fields, error }), send)),
        push: (msg) => later(() => deliver(windowId, msg, send)),
        state,
        rng,
        clock,
        runtime,
      });
    },
    onWindowDestroyed(windowId) {
      lastSend.delete(windowId);
      definition.onWindowDestroyed?.(windowId, state);
    },
    onCapabilityRevoked(windowId, capability) {
      definition.onCapabilityRevoked?.(windowId, capability, state);
    },
  };
  DELIVERY.set(service, { push: pushTo, through: deliver });
  return service;
}

/**
 * Give `target` the same push route as `source`, for domain factories that
 * wrap a `defineMockService` result in a new object with extra helpers.
 *
 * @param target - Wrapper service that should push like `source`.
 * @param source - Mock built by `defineMockService`.
 * @example
 * ```ts
 * const wrapped = { ...mock, extra() {} };
 * inheritMockPush(wrapped, mock);
 * ```
 */
export function inheritMockPush(target: MockService, source: MockService): void {
  const delivery = DELIVERY.get(source);
  if (delivery) DELIVERY.set(target, delivery);
}

/**
 * Push an envelope to a window through a mock built by `defineMockService`.
 * With a runtime attached, delivery goes through
 * `ServiceRuntimeContext.sendToEligibleNapplet`, whose verdict is returned:
 * `false` means the runtime refused the push (unknown window, domain not
 * exposed, missing recipient capability, or an undeclared custom-domain type)
 * and nothing was recorded in `mock.sent`. Without a runtime, the last `send`
 * seen for that window is used, and `false` means no request has been seen.
 *
 * @param service - A mock from `defineMockService`.
 * @param windowId - Recipient window.
 * @param message - Envelope to deliver.
 * @returns Whether the envelope was delivered.
 * @example
 * ```ts
 * pushToWindow(gamepad, 'win-1', { type: 'gamepad.state', pads: [] } as NappletMessage);
 * ```
 */
export function pushToWindow(service: MockService, windowId: string, message: NappletMessage): boolean {
  return DELIVERY.get(service)?.push(windowId, message) ?? false;
}

/**
 * Deliver an envelope through a caller-supplied `send` and record it in
 * `mock.sent`. Use it when the push belongs to an earlier request whose runtime
 * callback already carries the right lifecycle checks, such as `relay.event`
 * for a live `relay.subscribe`, exactly as the reference services do.
 *
 * @param service - A mock from `defineMockService`.
 * @param windowId - Recipient window (for the `sent` record).
 * @param message - Envelope to deliver.
 * @param send - The request callback to deliver through.
 * @returns `false` when `service` was not built by `defineMockService`.
 * @example
 * ```ts
 * pushThrough(relay, sub.windowId, { type: 'relay.event', subId: sub.subId, result } as NappletMessage, sub.send);
 * ```
 */
export function pushThrough(
  service: MockService,
  windowId: string,
  message: NappletMessage,
  send: (msg: NappletMessage) => void,
): boolean {
  const delivery = DELIVERY.get(service);
  if (!delivery) return false;
  delivery.through(windowId, message, send);
  return true;
}

function buildCapabilities<TState>(
  definition: MockServiceDefinition<TState>,
  routes: readonly string[],
): MockCapabilityMap | undefined {
  if (definition.kind === 'service') return definition.capabilities;
  const map: Record<string, MockCapabilityMap[string]> = {};
  for (const type of routes) map[type] = definition.capabilities?.[type] ?? null;
  return Object.freeze(map);
}
