/**
 * lists-service.ts — NAP-LISTS reference service.
 *
 * Shell-mediated NIP-51 list metadata and mutation hooks. The napplet requests
 * `lists.*`; the shell owns list lookup, validation, signing, publishing, and
 * private-item policy.
 */

import type {
  ListItem,
  ListMutationResult,
  ListOptions,
  ListRef,
  ListSupport,
  NappletMessage,
} from '@napplet/core';
import type {
  ListsAddMessage,
  ListsRemoveMessage,
} from '@napplet/nap/lists/types';
import type { ApprovalSignal, ServiceDescriptor, ServiceHandler, ServiceRuntimeContext } from '@kehto/runtime';

const LISTS_SERVICE_VERSION = '1.0.0';

/** Context passed to host-provided NAP-LISTS hooks. */
export interface ListsServiceContext {
  /** Window id of the requesting napplet. */
  readonly windowId: string;
  /** Immutable relay plan approved for this mutation. */
  readonly relays?: readonly string[];
  /** Revoked when this operation's approval or source lifetime ends. */
  readonly signal?: ApprovalSignal;
}

/** Options for {@link createListsService}. */
export interface ListsServiceOptions {
  /** Validate list inputs and disclose destinations without loading or signing. */
  planMutation?: (list: ListRef, items: readonly ListItem[], options?: ListOptions) => ListsMutationPlan | ListMutationResult;
  /** Host-owned supported list metadata. */
  supported?: (context: ListsServiceContext) => readonly ListSupport[] | Promise<readonly ListSupport[]>;
  /** Host-owned add mutation. */
  add?: (
    list: ListRef,
    items: readonly ListItem[],
    options: ListOptions | undefined,
    context: ListsServiceContext,
  ) => ListMutationResult | Promise<ListMutationResult>;
  /** Host-owned remove mutation. */
  remove?: (
    list: ListRef,
    items: readonly ListItem[],
    options: ListOptions | undefined,
    context: ListsServiceContext,
  ) => ListMutationResult | Promise<ListMutationResult>;
}


export interface ListsMutationPlan {
  readonly relays: readonly string[];
  /** Stable exact NIP-51 list identity, including an addressable identifier. */
  readonly resource: string;
}

type Send = (msg: NappletMessage) => void;
type MutationHook = NonNullable<ListsServiceOptions['add'] | ListsServiceOptions['remove']>;
type ListsPermissionRequirement = Parameters<NonNullable<ServiceRuntimeContext['authorizeOperation']>>[2][number];

const LISTS_DESCRIPTOR: ServiceDescriptor = {
  name: 'lists',
  version: LISTS_SERVICE_VERSION,
  description: 'NAP-LISTS reference handler for shell-mediated NIP-51 list mutations',
};

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return fallback;
}

function requirements(operation: string, plan?: ListsMutationPlan): readonly ListsPermissionRequirement[] {
  const result: ListsPermissionRequirement[] = [{ category: 'interface', domain: 'lists', operation: 'access', scope: { kind: 'exact', value: 'lists' } }];
  if (!plan) return result;
  result.push({ category: 'resource', domain: 'lists', operation, scope: { kind: 'exact', value: plan.resource } });
  for (const relay of plan.relays) {
    try {
      const url = new URL(relay);
      if ((url.protocol !== 'ws:' && url.protocol !== 'wss:') || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error();
      result.push({ category: 'network', domain: 'lists', operation, scope: { kind: 'origin', value: url.origin } });
    } catch { throw new Error('forbidden'); }
  }
  return result;
}

function unsupportedMutation(resultType: string, id: string): NappletMessage {
  return { type: resultType, id, ok: false, error: 'unsupported', reason: `${resultType.replace('.result', '')} unavailable`, supported: [] } as NappletMessage;
}

function snapshot(list: ListRef, items: readonly ListItem[], options: ListOptions | undefined): { list: ListRef; items: readonly ListItem[]; options: ListOptions | undefined } {
  return { list: { ...list }, items: Object.freeze(items.map((item) => ({ ...item }))), options: options ? { ...options } : undefined };
}

/**
 * Create the NAP-LISTS reference service.
 *
 * @param options - Host list metadata and mutation hooks for lists.* requests.
 * @returns A runtime service handler for the `lists` domain.
 */
// aislop-ignore-next-line function-too-long -- List planning, atomic approval execution, and source generations form one transaction boundary.
export function createListsService(options: ListsServiceOptions = {}): ServiceHandler {
  const generations = new Map<string, symbol>();
  let runtime: ServiceRuntimeContext | undefined;
  let warnedLegacy = false;
  const generationFor = (windowId: string): symbol => { let value = generations.get(windowId); if (!value) { value = Symbol(windowId); generations.set(windowId, value); } return value; };
  const current = (windowId: string, generation: symbol): boolean => generations.get(windowId) === generation;
  const warnLegacy = (): void => { if (!warnedLegacy) { warnedLegacy = true; console.warn('[FW-LISTS-LEGACY-001] Configure immutable LISTS mutation planning for approval-aware list changes. Warning once per service instance.'); } };

  const settleMutation = (hook: MutationHook | undefined, message: ListsAddMessage | ListsRemoveMessage, windowId: string, generation: symbol, send: Send, resultType: 'lists.add.result' | 'lists.remove.result'): void => {
    if (!hook) { send(unsupportedMutation(resultType, message.id)); return; }
    const input = snapshot(message.list, message.items, message.options);
    void Promise.resolve().then(async () => {
      if (!runtime?.authorizeOperation) { warnLegacy(); return hook(input.list, input.items, input.options, { windowId }); }
      const plan = options.planMutation?.(input.list, input.items, input.options);
      if (!plan) throw new Error('list-unavailable');
      if ('ok' in plan) return plan;
      const outcome = await runtime.authorizeOperation(windowId, resultType.replace('.result', ''), requirements(resultType.replace('.result', ''), plan), async (signal) => {
        if (!current(windowId, generation) || signal.aborted) throw new Error('user-denied');
        const value = await hook(input.list, input.items, input.options, { windowId, relays: plan.relays, signal });
        if (!current(windowId, generation) || signal.aborted) throw new Error('user-denied');
        return value;
      });
      if (outcome.status !== 'executed') throw new Error('user-denied');
      return outcome.value;
    }).then((result) => { if (current(windowId, generation)) send({ type: resultType, id: message.id, ...result } as NappletMessage); })
      .catch((error) => { if (current(windowId, generation)) send({ type: resultType, id: message.id, ok: false, error: 'list-unavailable', reason: errorMessage(error, 'lists request failed') } as NappletMessage); });
  };

  return {
    descriptor: LISTS_DESCRIPTOR,
    onRegistered(context): void { runtime = context; },
    onUnregistered(): void { runtime = undefined; },
    handleMessage(windowId: string, message: NappletMessage, send: Send): void {
      const idValue = Object.getOwnPropertyDescriptor(message, 'id')?.value;
      const id = typeof idValue === 'string' ? idValue : '';
      const generation = generationFor(windowId);
      if (message.type === 'lists.supported') {
        if (!options.supported) { send({ type: 'lists.supported.result', id, lists: [] } as NappletMessage); return; }
        if (!runtime?.authorizeOperation) { void Promise.resolve(options.supported({ windowId })).then((lists) => send({ type: 'lists.supported.result', id, lists: [...lists] } as NappletMessage)).catch((error) => send({ type: 'lists.supported.result', id, error: errorMessage(error, 'lists request failed') } as NappletMessage)); return; }
        void runtime.authorizeOperation(windowId, 'lists.supported', requirements('lists.supported'), async (signal) => { if (signal.aborted || !current(windowId, generation)) throw new Error('user-denied'); return options.supported!({ windowId, signal }); }).then((outcome) => { if (current(windowId, generation)) send(outcome.status === 'executed' ? { type: 'lists.supported.result', id, lists: [...outcome.value] } as NappletMessage : { type: 'lists.supported.result', id, lists: [] } as NappletMessage); });
        return;
      }
      if (message.type === 'lists.add') { settleMutation(options.add, message as ListsAddMessage, windowId, generation, send, 'lists.add.result'); return; }
      if (message.type === 'lists.remove') { settleMutation(options.remove, message as ListsRemoveMessage, windowId, generation, send, 'lists.remove.result'); return; }
      send({ type: `${message.type}.error`, id, error: `Unknown lists method: ${message.type}` } as NappletMessage);
    },
    onWindowDestroyed(windowId): void { generations.delete(windowId); },
    onPermissionRevoked(windowId): void { generations.delete(windowId); },
  };
}
