/**
 * kehto/domains/intent.ts — NAP-INTENT backend: a deterministic in-memory catalog.
 *
 * Single-endpoint fixtures only need the catalog. Multi-endpoint scenarios
 * drive the host controls below: bind endpoints to catalog identities (the
 * same id backs `sender` and target lookup), declare a target ready, and set
 * the user's default or chooser answer.
 */
import { createCatalogIntentResolver, createIntentService, type IntentCatalogEntry, type IntentDispatchParams } from '@kehto/services';
import type { ServiceRuntimeContext } from '@kehto/runtime';
import type { NappletMessage } from '@napplet/core';
import type { ControlContext, DomainBackendModule } from './types.js';

/** Installed catalog every full-profile boot starts with. */
export const FIXTURE_INTENT_CATALOG: readonly IntentCatalogEntry[] = Object.freeze<IntentCatalogEntry[]>([
  {
    id: 'conformance-viewer', title: 'Conformance Viewer',
    archetypes: {
      note: { contracts: [{ convention: 'napplet:note/open', params: ['id'] }] },
      profile: { contracts: [{ convention: 'napplet:profile/open', params: ['pubkey'] }] },
    },
  },
  {
    id: 'conformance-editor', title: 'Conformance Editor',
    archetypes: { article: { contracts: [{ convention: 'napplet:article/open', params: [] }, { convention: 'napplet:article/edit', params: ['address', 'relays'] }] } },
  },
]);

interface Delivery { readonly handler: string; readonly delivery: Record<string, unknown>; settle(): void }

const field = (payload: unknown, key: string): unknown => (payload && typeof payload === 'object' ? (payload as Record<string, unknown>)[key] : undefined);

/** Resolve `{ windowId }` or `{ endpointIndex }` (negative counts from the newest) to a live endpoint. */
function endpointOf(payload: unknown, context: ControlContext): string | undefined {
  const windowId = field(payload, 'windowId');
  if (typeof windowId === 'string') return windowId;
  const index = field(payload, 'endpointIndex');
  const endpoints = context.endpoints();
  return typeof index === 'number' ? endpoints.at(index) : endpoints.at(-1);
}

function deliveryOf(params: IntentDispatchParams): Record<string, unknown> {
  return {
    sender: params.sender, archetype: params.archetype, action: params.action, convention: params.convention,
    ...(params.payload === undefined ? {} : { payload: params.payload }),
  };
}

/** NAP-INTENT backend: the reference intent service over an in-memory catalog and target registry. */
export const INTENT_BACKEND: DomainBackendModule = {
  domain: 'intent',
  create() {
    const catalog: IntentCatalogEntry[] = structuredClone([...FIXTURE_INTENT_CATALOG]);
    const defaults = new Map<string, string>();
    const authorized = new Set<string>();
    const identities = new Map<string, string>();
    const ready = new Map<string, string>();
    const pending: Delivery[] = [];
    const accepted: Omit<IntentDispatchParams, 'signal'>[] = [];
    let chooser: string | undefined;
    let runtime: ServiceRuntimeContext | undefined;

    const flush = (): number => {
      let delivered = 0;
      for (const item of pending.splice(0)) {
        const target = ready.get(item.handler);
        if (target && runtime?.sendToEligibleNapplet(target, { type: 'intent.deliver', delivery: item.delivery } as NappletMessage)) {
          item.settle();
          delivered += 1;
        } else pending.push(item);
      }
      return delivered;
    };
    const resolver = createCatalogIntentResolver({
      loadCatalog: () => catalog,
      getDefaultHandler: (archetype) => defaults.get(archetype),
      chooseHandler: () => chooser,
      authorizeExplicitHandler: (_sender, handler) => authorized.has(handler),
      targets: {
        accept(params) {
          const { signal: _signal, ...record } = params;
          accepted.push(record);
          const completion = new Promise<void>((settle) => { pending.push({ handler: params.handler, delivery: deliveryOf(params), settle }); });
          queueMicrotask(flush);
          return { completion };
        },
      },
    });
    const service = createIntentService({
      resolver,
      resolveSender: (windowId) => identities.get(windowId) ?? (runtime?.resolveDTag(windowId) ? `catalog:${runtime.resolveDTag(windowId)}` : undefined),
    });
    const archetypesOf = (entry: IntentCatalogEntry): string[] => Object.keys(entry.archetypes);
    return {
      services: {
        intent: {
          ...service,
          onRegistered(context) { runtime = context; service.onRegistered?.(context); },
          onUnregistered() { runtime = undefined; service.onUnregistered?.(); },
        },
      },
      adapter: { intent: { isAvailable: () => true } },
      controls: {
        /** Emit `intent.changed` for `{ archetype }` (default `note`). */
        'intent.notifyChanged': (payload) => { resolver.notifyChanged(String(field(payload, 'archetype') ?? 'note')); },
        /** Set (`{ archetype, handler }`) or clear (`handler: null`) the user's default, then emit `intent.changed`. */
        'intent.setDefault': (payload) => {
          const archetype = String(field(payload, 'archetype') ?? 'note');
          const handler = field(payload, 'handler');
          if (typeof handler === 'string') defaults.set(archetype, handler); else defaults.delete(archetype);
          resolver.notifyChanged(archetype);
        },
        /** The user's chooser answer: `{ handler }` selects that candidate; `handler: null` (the boot state) cancels the choice. */
        'intent.setChooser': (payload) => {
          const handler = field(payload, 'handler');
          chooser = typeof handler === 'string' ? handler : undefined;
        },
        /** User-authorize an explicit `{ handler }` catalog id. */
        'intent.authorizeHandler': (payload) => { authorized.add(String(field(payload, 'handler'))); },
        /** Install `{ entry }` (an IntentCatalogEntry), then emit `intent.changed` for its archetypes. */
        'intent.install': (payload) => {
          const entry = field(payload, 'entry') as IntentCatalogEntry;
          catalog.push(structuredClone(entry));
          for (const archetype of archetypesOf(entry)) resolver.notifyChanged(archetype);
        },
        /**
         * Bind an endpoint (`{ endpointIndex }` or `{ windowId }`, default newest) to `{ catalogId }`.
         * The id becomes that endpoint's `sender`; with `ready: true` (default) it is also
         * the live target for that handler, and queued deliveries are flushed to it.
         */
        'intent.bindEndpoint': (payload, context) => {
          const windowId = endpointOf(payload, context);
          const catalogId = field(payload, 'catalogId');
          if (!windowId || typeof catalogId !== 'string') return null;
          identities.set(windowId, catalogId);
          if (field(payload, 'ready') !== false) ready.set(catalogId, windowId);
          return { windowId, delivered: flush() };
        },
        /** Declare `{ catalogId }`'s bound target ready now and deliver what is queued for it. */
        'intent.flushDeliveries': (payload, context) => {
          const catalogId = field(payload, 'catalogId');
          const windowId = endpointOf(payload, context);
          if (typeof catalogId === 'string' && windowId) ready.set(catalogId, windowId);
          return flush();
        },
        /** Evidence: every dispatch the resolver accepted, and how many deliveries still wait for a ready target. */
        'intent.accepted': () => ({ accepted: structuredClone(accepted), pending: pending.length }),
      },
    };
  },
};
