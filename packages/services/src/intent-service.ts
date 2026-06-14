/**
 * intent-service.ts — NAP-INTENT (archetype intent dispatch) reference service.
 *
 * Shell-side handler for the NAP-INTENT wire protocol. It is a pure envelope
 * router: it validates `intent.*` envelopes, delegates archetype resolution,
 * default handling, window lifecycle, and payload delivery to an injected
 * {@link IntentResolver}, and posts the correlated result / push messages
 * (echoing the request `id`) back to the napplet.
 *
 * The resolver is injected (options-as-bridge) so this service has no shell or
 * window-manager dependency and is fully unit-testable. A concrete
 * catalog-backed resolver ships alongside as {@link createCatalogIntentResolver}.
 *
 * ──────────────────────────── Responsibilities ────────────────────────────
 *   Inbound:  intent.invoke, intent.available, intent.handlers
 *   Outbound: intent.invoke.result, intent.available.result,
 *             intent.handlers.result, intent.changed
 *
 * The shell owns archetype→handler resolution, the user's default-handler
 * preference, the "open with…" chooser, and window creation/focus — all behind
 * the {@link IntentResolver}. This service only marshals the wire protocol and
 * fans `intent.changed` pushes out to the napplets it has served.
 *
 * @example
 * ```ts
 * import { createIntentService, createCatalogIntentResolver } from '@kehto/services';
 *
 * const resolver = createCatalogIntentResolver({ loadCatalog, windows });
 * runtime.registerService('intent', createIntentService({ resolver }));
 * ```
 *
 * @packageDocumentation
 */

import type { NappletMessage } from '@napplet/core';
import type { ServiceDescriptor, ServiceHandler } from '@kehto/runtime';
import type { IntentAvailability, IntentRequest, IntentResult } from './intent-types.js';

/** Intent service version — follows semver. */
const INTENT_SERVICE_VERSION = '1.0.0';

/** Context passed to {@link IntentResolver.invoke} for trust/attribution. */
export interface IntentResolverContext {
  /** Window id of the napplet that issued the request. */
  windowId: string;
}

/**
 * Abstract intent resolver. Implementors own the installed-napplet catalog,
 * archetype→handler resolution, the user's default-handler preference, the
 * "open with…" chooser, window creation/focus, and payload delivery. The
 * service translates wire envelopes into these calls and back.
 */
export interface IntentResolver {
  /**
   * Resolve `request.archetype` to a handler, create or focus its window, and
   * deliver `payload`. Returns once the handler is resolved and the window
   * created; delivery MAY complete asynchronously.
   */
  invoke(request: IntentRequest, context: IntentResolverContext): IntentResult | Promise<IntentResult>;
  /** Report whether the runtime can currently satisfy `archetype`, and how. */
  available(archetype: string): IntentAvailability | Promise<IntentAvailability>;
  /** Report availability for every archetype the runtime can currently satisfy. */
  handlers(): IntentAvailability[] | Promise<IntentAvailability[]>;
  /**
   * Register for availability changes (a napplet installed/removed, or a default
   * handler changed). The service forwards each change to served napplets as an
   * `intent.changed` push. Returns an unsubscribe handle. Resolvers whose
   * catalog never changes at runtime MAY omit this.
   */
  onChanged?(listener: (availability: IntentAvailability) => void): () => void;
}

/** Options for {@link createIntentService}. */
export interface IntentServiceOptions {
  /** The intent resolver the shell uses to route archetypes. Required. */
  resolver: IntentResolver;
}

type Send = (msg: NappletMessage) => void;

const INTENT_DESCRIPTOR: ServiceDescriptor = {
  name: 'intent',
  version: INTENT_SERVICE_VERSION,
  description: 'NAP-INTENT archetype intent dispatch — invoke/available/handlers',
};

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'intent request failed';
}

/**
 * Create the NAP-INTENT service handler.
 *
 * @param options - Must provide an {@link IntentResolver}.
 * @returns A `ServiceHandler` ready for `runtime.registerService('intent', handler)`.
 * @throws If `options.resolver` is missing.
 */
export function createIntentService(options: IntentServiceOptions): ServiceHandler {
  if (!options || typeof options.resolver !== 'object' || options.resolver === null) {
    throw new Error('createIntentService: options.resolver is required');
  }
  const { resolver } = options;

  // Latest send callback per served window, used to fan `intent.changed`
  // pushes out to every napplet that has interacted with the intent domain.
  const windows = new Map<string, Send>();

  // Subscribe once for availability changes and broadcast them as pushes.
  resolver.onChanged?.((availability) => {
    for (const send of windows.values()) {
      send({ type: 'intent.changed', availability } as NappletMessage);
    }
  });

  /**
   * Run a resolver call and marshal its outcome onto `resultType`. The resolver
   * method may be sync or async — `settle` normalizes it to a promise and
   * catches a synchronous throw (e.g. a sync resolver that rejects an input)
   * the same way it catches an async rejection.
   */
  function settle<T>(
    call: () => T | Promise<T>,
    send: Send,
    resultType: string,
    id: string,
    onValue: (value: T) => NappletMessage,
  ): void {
    let pending: Promise<T>;
    try {
      pending = Promise.resolve(call());
    } catch (err) {
      send({ type: resultType, id, error: toErrorMessage(err) } as NappletMessage);
      return;
    }
    pending
      .then((value) => send(onValue(value)))
      .catch((err) => send({ type: resultType, id, error: toErrorMessage(err) } as NappletMessage));
  }

  function handleInvoke(windowId: string, msg: NappletMessage, send: Send): void {
    const m = msg as NappletMessage & { id?: string; request?: IntentRequest };
    const id = m.id ?? '';
    const request = m.request;
    if (!request || typeof request !== 'object' || typeof request.archetype !== 'string' || request.archetype.length === 0) {
      send({ type: 'intent.invoke.result', id, error: 'invalid request' } as NappletMessage);
      return;
    }
    settle(
      () => resolver.invoke(request, { windowId }),
      send, 'intent.invoke.result', id,
      (result) => ({ type: 'intent.invoke.result', id, result } as NappletMessage),
    );
  }

  function handleAvailable(msg: NappletMessage, send: Send): void {
    const m = msg as NappletMessage & { id?: string; archetype?: unknown };
    const id = m.id ?? '';
    if (typeof m.archetype !== 'string' || m.archetype.length === 0) {
      send({ type: 'intent.available.result', id, error: 'invalid archetype' } as NappletMessage);
      return;
    }
    const archetype = m.archetype;
    settle(
      () => resolver.available(archetype),
      send, 'intent.available.result', id,
      (availability) => ({ type: 'intent.available.result', id, availability } as NappletMessage),
    );
  }

  function handleHandlers(msg: NappletMessage, send: Send): void {
    const m = msg as NappletMessage & { id?: string };
    const id = m.id ?? '';
    settle(
      () => resolver.handlers(),
      send, 'intent.handlers.result', id,
      (handlers) => ({ type: 'intent.handlers.result', id, handlers } as NappletMessage),
    );
  }

  return {
    descriptor: INTENT_DESCRIPTOR,
    handleMessage(windowId: string, message: NappletMessage, send: Send): void {
      windows.set(windowId, send);
      switch (message.type) {
        case 'intent.invoke':
          handleInvoke(windowId, message, send);
          return;
        case 'intent.available':
          handleAvailable(message, send);
          return;
        case 'intent.handlers':
          handleHandlers(message, send);
          return;
        default:
          // Unknown intent.* action — silently ignored (forward-compatible).
          return;
      }
    },
    onWindowDestroyed(windowId: string): void {
      windows.delete(windowId);
    },
  };
}
