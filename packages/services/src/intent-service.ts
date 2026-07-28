/**
 * intent-service.ts — NAP-INTENT (archetype intent dispatch) reference service.
 *
 * Shell-side handler for the NAP-INTENT wire protocol. It is a pure envelope
 * router: it validates `intent.*` envelopes, delegates archetype resolution,
 * default handling and target dispatch to an injected
 * {@link IntentResolver}, then posts correlated result and push messages back
 * to the napplet.
 *
 * The resolver is injected (options-as-bridge) so this service has no shell or
 * target-lifecycle dependency and is fully unit-testable. A concrete
 * catalog-backed resolver ships alongside as {@link createCatalogIntentResolver}.
 *
 * ──────────────────────────── Responsibilities ────────────────────────────
 *   Inbound:  intent.invoke, intent.available, intent.handlers
 *   Outbound: intent.invoke.result, intent.available.result,
 *             intent.handlers.result, intent.changed
 *
 * The shell owns archetype→handler resolution, the user's default-handler
 * preference, chooser, and target lifecycle policy behind the
 * {@link IntentResolver}. This service only marshals the wire protocol and
 * fans `intent.changed` pushes out to eligible napplets.
 *
 * @example
 * ```ts
 * import { createIntentService, createCatalogIntentResolver } from '@kehto/services';
 *
 * const resolver = createCatalogIntentResolver({ loadCatalog, targets });
 * runtime.registerService('intent', createIntentService({ resolver }));
 * ```
 *
 * @packageDocumentation
 */

import type {
  IntentAvailability,
  IntentRequest,
  IntentResult,
  NappletMessage,
} from '@napplet/core';
import type {
  ServiceDescriptor,
  ServiceHandler,
  ServiceRuntimeContext,
} from '@kehto/runtime';

/** Intent service version — follows semver. */
const INTENT_SERVICE_VERSION = '1.0.0';

/** Context passed to {@link IntentResolver.invoke} for trust/attribution. */
export interface IntentResolverContext {
  /** Runtime-attested dTag of the napplet that issued the request. */
  sender: string;
}

/**
 * Abstract intent resolver. Implementors own the installed-napplet catalog,
 * archetype→handler resolution, the user's default-handler preference, the
 * chooser and target lifecycle/delivery policy. The
 * service translates wire envelopes into these calls and back.
 */
export interface IntentResolver {
  /**
   * Resolve and dispatch the request.
   *
   * @param request - Validated normalized intent request.
   * @param context - Runtime-attested source identity.
   * @returns The canonical structured dispatch result.
   */
  invoke(
    request: IntentRequest,
    context: IntentResolverContext,
  ): IntentResult | Promise<IntentResult>;
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

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

type RequestValidation =
  | { request: IntentRequest }
  | { error: 'invalid request' | 'invalid convention' | 'invoke rejected' };

function validateIntentRequest(value: unknown): RequestValidation {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { error: 'invalid request' };
  }
  const request = value as Record<string, unknown>;
  if (
    typeof request.archetype !== 'string'
    || request.archetype.length === 0
  ) {
    return { error: 'invalid request' };
  }

  const action = request.action === undefined ? 'open' : request.action;
  if (typeof action !== 'string' || action.length === 0) {
    return { error: 'invalid request' };
  }
  if (
    request.convention !== undefined
    && (
      typeof request.convention !== 'string'
      || !/^napplet:[^/?#\s]+\/[^/?#\s]+$/.test(request.convention)
    )
  ) {
    return { error: 'invalid convention' };
  }

  const allowedKeys = ['archetype', 'action', 'convention', 'payload', 'handler', 'behavior'];
  if (Object.keys(request).some((key) => !allowedKeys.includes(key))) {
    return { error: 'invoke rejected' };
  }

  if (
    hasOwn(request, 'handler')
    && request.handler !== undefined
    && (typeof request.handler !== 'string' || request.handler.length === 0)
  ) {
    return { error: 'invoke rejected' };
  }

  let behavior: IntentRequest['behavior'];
  if (hasOwn(request, 'behavior') && request.behavior !== undefined) {
    if (
      typeof request.behavior !== 'object'
      || request.behavior === null
      || Array.isArray(request.behavior)
    ) {
      return { error: 'invoke rejected' };
    }
    const record = request.behavior as Record<string, unknown>;
    if (
      Object.keys(record).some((key) =>
        key !== 'focus' && key !== 'newWindow' && key !== 'reuse')
      || (hasOwn(record, 'focus') && typeof record.focus !== 'boolean')
      || (hasOwn(record, 'newWindow') && typeof record.newWindow !== 'boolean')
      || (hasOwn(record, 'reuse') && typeof record.reuse !== 'boolean')
    ) {
      return { error: 'invoke rejected' };
    }
    behavior = {
      ...(record.focus === undefined ? {} : { focus: record.focus as boolean }),
      ...(record.newWindow === undefined
        ? {}
        : { newWindow: record.newWindow as boolean }),
      ...(record.reuse === undefined ? {} : { reuse: record.reuse as boolean }),
    };
  }

  return {
    request: {
      archetype: request.archetype,
      action,
      ...(typeof request.convention === 'string'
        ? { convention: request.convention }
        : {}),
      ...(hasOwn(request, 'payload') ? { payload: request.payload } : {}),
      ...(typeof request.handler === 'string' ? { handler: request.handler } : {}),
      ...(behavior === undefined ? {} : { behavior }),
    },
  };
}

function settleResolverCall<T>(
  call: () => T | Promise<T>,
  send: Send,
  resultType: string,
  id: string,
  onValue: (value: T) => NappletMessage,
): void {
  let pending: Promise<T>;
  try {
    pending = Promise.resolve(call());
  } catch (error) {
    send({ type: resultType, id, error: toErrorMessage(error) } as NappletMessage);
    return;
  }
  pending
    .then((value) => send(onValue(value)))
    .catch((error) => send({ type: resultType, id, error: toErrorMessage(error) } as NappletMessage));
}

function rejectedResult(
  request: Pick<IntentRequest, 'archetype' | 'action'>,
  error: string,
): IntentResult {
  return {
    ok: false,
    archetype: request.archetype,
    action: request.action ?? 'open',
    handled: false,
    error,
  };
}

function rejectInvoke(
  send: Send,
  id: string,
  request: Pick<IntentRequest, 'archetype' | 'action'>,
  error = 'invoke rejected',
): void {
  send({
    type: 'intent.invoke.result',
    id,
    result: rejectedResult(request, error),
  } as NappletMessage);
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
  let runtimeContext: ServiceRuntimeContext | undefined;
  let unsubscribeChanged: (() => void) | undefined;

  function handleInvoke(windowId: string, msg: NappletMessage, send: Send): void {
    const m = msg as NappletMessage & { id?: string; request?: unknown };
    const id = m.id ?? '';
    const validation = validateIntentRequest(m.request);
    if ('error' in validation) {
      const raw = typeof m.request === 'object' && m.request !== null
        ? m.request as Record<string, unknown>
        : {};
      rejectInvoke(
        send,
        id,
        {
          archetype: typeof raw.archetype === 'string' ? raw.archetype : '',
          action: typeof raw.action === 'string' ? raw.action : 'open',
        },
        validation.error,
      );
      return;
    }
    const sender = runtimeContext?.resolveDTag(windowId);
    if (!sender) {
      rejectInvoke(send, id, validation.request);
      return;
    }

    let pending: Promise<IntentResult>;
    try {
      pending = Promise.resolve(resolver.invoke(validation.request, { sender }));
    } catch {
      rejectInvoke(send, id, validation.request);
      return;
    }
    void pending.then(
      (result) => {
        send({
          type: 'intent.invoke.result',
          id,
          result,
        } as NappletMessage);
      },
      () => {
        rejectInvoke(send, id, validation.request);
      },
    ).catch(() => {
      // Adapter send failures must not manufacture a second source result.
    });
  }

  function handleAvailable(msg: NappletMessage, send: Send): void {
    const m = msg as NappletMessage & { id?: string; archetype?: unknown };
    const id = m.id ?? '';
    if (typeof m.archetype !== 'string' || m.archetype.length === 0) {
      send({ type: 'intent.available.result', id, error: 'invalid archetype' } as NappletMessage);
      return;
    }
    const archetype = m.archetype;
    settleResolverCall(
      () => resolver.available(archetype),
      send, 'intent.available.result', id,
      (availability) => ({ type: 'intent.available.result', id, availability } as NappletMessage),
    );
  }

  function handleHandlers(msg: NappletMessage, send: Send): void {
    const m = msg as NappletMessage & { id?: string };
    const id = m.id ?? '';
    settleResolverCall(
      () => resolver.handlers(),
      send, 'intent.handlers.result', id,
      (handlers) => ({ type: 'intent.handlers.result', id, handlers } as NappletMessage),
    );
  }

  return {
    descriptor: INTENT_DESCRIPTOR,
    onRegistered(context): void {
      try {
        unsubscribeChanged?.();
      } catch {
        // Resolver cleanup is best-effort during replacement.
      }
      runtimeContext = context;
      unsubscribeChanged = resolver.onChanged?.((availability) => {
        const current = runtimeContext;
        if (!current) return;
        const message = { type: 'intent.changed', availability } as NappletMessage;
        for (const windowId of current.listWindowIds()) {
          current.sendToEligibleNapplet(windowId, message);
        }
      });
    },
    onUnregistered(): void {
      const unsubscribe = unsubscribeChanged;
      unsubscribeChanged = undefined;
      runtimeContext = undefined;
      try {
        unsubscribe?.();
      } catch {
        // Resolver cleanup cannot block runtime teardown.
      }
    },
    handleMessage(windowId: string, message: NappletMessage, send: Send): void {
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
  };
}
