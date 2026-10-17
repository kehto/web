/** NAP-INTENT wire service using canonical Kehto contracts. */

import type { NappletMessage } from '@napplet/core';
import type { ServiceDescriptor, ServiceHandler, ServiceRuntimeContext } from '@kehto/runtime';
import type { IntentAvailability, IntentHandlerHint, IntentRequest, IntentResult } from './intent-types.js';

const INTENT_DESCRIPTOR: ServiceDescriptor = {
  name: 'intent', version: '1.0.0', description: 'NAP-INTENT convention dispatch',
};
const CONVENTION = /^napplet:([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*)$/;
const HINT_ADDRESS = /^35129:[a-f0-9]{64}:.+$/;

/** Runtime-attested source catalog identity passed to intent policy. */
export interface IntentResolverContext {
  readonly sender: string;
  /** Authenticated runtime source, internal to host policy and never wire data. */
  readonly sourceWindowId?: string;
  /** Approval lifetime for host-retained work; never placed on the wire. */
  readonly signal?: AbortSignal;
}

/** Installed-catalog resolver and lifecycle policy. */
export interface IntentResolver {
  invoke(request: IntentRequest, context: IntentResolverContext): IntentResult | Promise<IntentResult>;
  available(archetype: string): IntentAvailability | Promise<IntentAvailability>;
  handlers(): readonly IntentAvailability[] | Promise<readonly IntentAvailability[]>;
  onChanged?(listener: (availability: IntentAvailability) => void): () => void;
}

/** Service dependencies including a source-bound verified catalog identity lookup. */
export interface IntentServiceOptions {
  readonly resolver: IntentResolver;
  /** Maps an authenticated runtime window to its verified catalog ID. */
  readonly resolveSender: (windowId: string) => string | undefined;
}

type Send = (message: NappletMessage) => void;

function own(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function hint(value: unknown): IntentHandlerHint | undefined {
  const source = record(value);
  if (!source || !own(source, 'address') || typeof source.address !== 'string' || !HINT_ADDRESS.test(source.address)) return undefined;
  if (Object.keys(source).some((key) => key !== 'address' && key !== 'relays')) return undefined;
  if (source.relays !== undefined && (!Array.isArray(source.relays) || source.relays.some((relay) => typeof relay !== 'string'))) return undefined;
  return Object.freeze({
    address: source.address,
    ...(source.relays === undefined ? {} : { relays: Object.freeze([...source.relays] as string[]) }),
  });
}

function validateRequest(value: unknown): IntentRequest | undefined {
  const source = record(value);
  if (!source || !own(source, 'archetype') || !own(source, 'action') || !own(source, 'convention')) return undefined;
  if (Object.keys(source).some((key) => !['archetype', 'action', 'convention', 'payload', 'handler', 'handlerHint', 'behavior'].includes(key))) return undefined;
  if (typeof source.archetype !== 'string' || typeof source.action !== 'string' || typeof source.convention !== 'string') return undefined;
  const match = CONVENTION.exec(source.convention);
  if (!match || match[1] !== source.archetype || match[2] !== source.action) return undefined;
  if (source.handler !== undefined && (typeof source.handler !== 'string' || source.handler.length === 0)) return undefined;
  const parsedHint = source.handlerHint === undefined ? undefined : hint(source.handlerHint);
  if (source.handlerHint !== undefined && !parsedHint) return undefined;
  const rawBehavior = source.behavior === undefined ? undefined : record(source.behavior);
  if (source.behavior !== undefined && (!rawBehavior || Object.keys(rawBehavior).some((key) => key !== 'focus' && key !== 'reuse')
    || (rawBehavior.focus !== undefined && typeof rawBehavior.focus !== 'boolean')
    || (rawBehavior.reuse !== undefined && typeof rawBehavior.reuse !== 'boolean'))) return undefined;
  return Object.freeze({
    archetype: source.archetype,
    action: source.action,
    convention: source.convention,
    ...(own(source, 'payload') ? { payload: source.payload } : {}),
    ...(source.handler === undefined ? {} : { handler: source.handler }),
    ...(parsedHint === undefined ? {} : { handlerHint: parsedHint }),
    ...(rawBehavior === undefined ? {} : { behavior: Object.freeze({
      ...(rawBehavior.focus === undefined ? {} : { focus: rawBehavior.focus as boolean }),
      ...(rawBehavior.reuse === undefined ? {} : { reuse: rawBehavior.reuse as boolean }),
    }) }),
  });
}

function reject(send: Send, id: string, error = 'invoke rejected'): void {
  send({ type: 'intent.invoke.result', id, result: { ok: false, error } } as NappletMessage);
}

/**
 * Create the NAP-INTENT service. Request data does not carry a sender field;
 * unknown fields are rejected and the sender always comes from `resolveSender`.
 *
 * @param options - Resolver plus authenticated window-to-catalog identity lookup.
 * @returns A runtime service handler for `intent.*` messages.
 *
 * @example
 * ```ts
 * runtime.registerService('intent', createIntentService({
 *   resolver,
 *   resolveSender: (windowId) => verifiedCatalogIdForWindow(windowId),
 * }));
 * ```
 */
export function createIntentService(options: IntentServiceOptions): ServiceHandler {
  if (!options || !options.resolver || typeof options.resolveSender !== 'function') {
    throw new Error('createIntentService: resolver and resolveSender are required');
  }
  let runtimeContext: ServiceRuntimeContext | undefined;
  let unsubscribe: (() => void) | undefined;
  const generations = new Map<string, symbol>();
  const { resolver, resolveSender } = options;
  const generationFor = (windowId: string): symbol => {
    let generation = generations.get(windowId);
    if (!generation) { generation = Symbol(windowId); generations.set(windowId, generation); }
    return generation;
  };
  const current = (windowId: string, generation: symbol, sender: string): boolean =>
    generations.get(windowId) === generation && resolveSender(windowId) === sender;

  function invoke(windowId: string, message: NappletMessage, send: Send): void {
    const envelope = message as NappletMessage & { id?: unknown; request?: unknown };
    const id = typeof envelope.id === 'string' ? envelope.id : '';
    const request = validateRequest(envelope.request);
    let sender: string | undefined;
    try {
      sender = resolveSender(windowId);
    } catch {
      return reject(send, id);
    }
    if (!request || !sender) return reject(send, id, request ? 'invoke rejected' : 'invalid convention');
    const generation = generationFor(windowId);
    const invokeCurrent = async (signal?: AbortSignal) => {
      if (!current(windowId, generation, sender!)) throw new Error('source replaced');
      const result = await resolver.invoke(request, { sender: sender!, sourceWindowId: windowId, signal });
      if (signal?.aborted || !current(windowId, generation, sender!)) throw new Error('source replaced');
      return result;
    };
    const requirements = [
      { category: 'interface' as const, domain: 'intent', operation: 'access', scope: { kind: 'exact' as const, value: 'intent' } },
      { category: 'resource' as const, domain: 'intent', operation: 'intent.invoke', scope: { kind: 'exact' as const, value: `intent:target:${request.handler ?? request.archetype}:action:${request.action}` } },
    ];
    const pending = runtimeContext?.authorizeOperation
      ? runtimeContext.authorizeOperation(windowId, 'intent.invoke', requirements, async (signal) => {
        if (signal.aborted) throw new Error('cancelled');
        return invokeCurrent(signal);
      }).then((outcome) => {
        if (outcome.status !== 'executed') throw new Error('denied');
        return outcome.value;
      })
      : Promise.resolve().then(() => invokeCurrent());
    void pending.then(
      (result) => { if (current(windowId, generation, sender!)) send({ type: 'intent.invoke.result', id, result } as NappletMessage); },
      () => { if (current(windowId, generation, sender!)) reject(send, id); },
    ).catch(() => {});
  }

  function availability(message: NappletMessage, send: Send): void {
    const envelope = message as NappletMessage & { id?: unknown; archetype?: unknown };
    const id = typeof envelope.id === 'string' ? envelope.id : '';
    if (typeof envelope.archetype !== 'string' || envelope.archetype.length === 0) {
      send({ type: 'intent.available.result', id, error: 'invalid archetype' } as NappletMessage);
      return;
    }
    const archetype = envelope.archetype;
    void Promise.resolve().then(() => resolver.available(archetype)).then(
      (value) => send({ type: 'intent.available.result', id, availability: value } as NappletMessage),
      () => send({ type: 'intent.available.result', id, error: 'catalog unavailable' } as NappletMessage),
    ).catch(() => {});
  }

  function handlers(message: NappletMessage, send: Send): void {
    const envelope = message as NappletMessage & { id?: unknown };
    const id = typeof envelope.id === 'string' ? envelope.id : '';
    void Promise.resolve().then(() => resolver.handlers()).then(
      (value) => send({ type: 'intent.handlers.result', id, handlers: value } as NappletMessage),
      () => send({ type: 'intent.handlers.result', id, error: 'catalog unavailable' } as NappletMessage),
    ).catch(() => {});
  }

  return {
    descriptor: INTENT_DESCRIPTOR,
    onRegistered(context) {
      unsubscribe?.();
      runtimeContext = context;
      unsubscribe = resolver.onChanged?.((item) => {
        const current = runtimeContext;
        if (!current) return;
        for (const windowId of current.listWindowIds()) {
          current.sendToEligibleNapplet(windowId, { type: 'intent.changed', availability: item } as NappletMessage);
        }
      });
    },
    onUnregistered() { unsubscribe?.(); unsubscribe = undefined; runtimeContext = undefined; generations.clear(); },
    onPermissionRevoked(windowId) { generations.delete(windowId); },
    handleMessage(windowId, message, send) {
      if (message.type === 'intent.invoke') return invoke(windowId, message, send);
      if (message.type === 'intent.available') return availability(message, send);
      if (message.type === 'intent.handlers') return handlers(message, send);
    },
    onWindowDestroyed(windowId) { generations.delete(windowId); },
  };
}
