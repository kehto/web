import type { IntentDispatchParams } from '@kehto/services';
import { originRegistry } from '@kehto/shell';

import {
  BrowserIntentController,
  type BrowserIntentGeneration,
} from './browser-intent-controller.js';
import {
  addRuntimeTab,
  closeRuntimeTab,
  renderRuntimeTabs,
  runtimeTabGenerationId,
  type PajaRuntimeTab,
} from './browser-runtime-tabs.js';
import { createPajaPostMessageProxy } from './browser-devtools.js';
import { getPajaRelayUrls } from './browser-relay-runtime.js';
import {
  matchesInstalledNappletRecord,
  type InstalledNappletCatalog,
} from './installed-napplet-catalog.js';
import {
  resolvePajaPointer,
  type PajaResolvedPointer,
} from './runtime-resolver.js';
import type {
  PajaBrowserState,
  PajaBrowserStateContext,
  PajaHostRuntimeState,
} from './browser-host.js';

export interface PajaIntentHostEffects {
  persistTabs?(state: PajaBrowserState): void;
  setReadyStatus?(state: PajaBrowserState): void;
}

/**
 * Create the browser target operations used by canonical intent dispatch.
 *
 * @param getState - Returns the live Paja browser state.
 * @param getContext - Returns the live Paja host context.
 * @param effects - Host-owned persistence and lifecycle effects.
 * @returns Intent target operations bound to the current Paja host.
 */
export function createPajaIntentTargetOptions(
  getState: () => PajaBrowserState | null,
  getContext: () => PajaBrowserStateContext | null,
  effects: PajaIntentHostEffects = {},
): ConstructorParameters<typeof BrowserIntentController>[0] {
  return {
    async openOrReuse(params) {
      const state = getState();
      const context = getContext();
      if (!state || !context) return null;
      const record = context.runtime.catalog.get(params.handler);
      if (!record || !recordSupportsDelivery(record, params)) return null;

      // A catalog replacement may retain the d-tag while replacing the verified
      // aggregate. Remove stale tabs before choosing any live delivery target.
      for (const stale of state.tabs) {
        if (
          stale.resolvedTarget.dTag === params.handler
          && !matchesInstalledNappletRecord(record, stale.resolvedTarget)
        ) closeRuntimeTab(state, context, stale.id);
      }

      const current = state.tabs.find((tab) =>
        matchesInstalledNappletRecord(record, tab.resolvedTarget)
        && isCurrentRuntimeTabGeneration(state, context, tab),
      );
      if (
        current
        && params.behavior?.newWindow !== true
        && params.behavior?.reuse !== false
      ) {
        return bindPajaIntentGeneration(current, record, context.runtime);
      }

      const resolved = await resolvePajaPointer(record.pointer.value, pajaPointerResolverOptions(context));
      if (
        resolved.dTag !== record.dTag
        || resolved.aggregateHash !== record.aggregateHash
        || !resolvedSupportsDelivery(resolved, params)
      ) return null;

      const currentRecord = context.runtime.catalog.validateCurrent(record, resolved);
      if (!currentRecord) return null;
      const tab = addRuntimeTab(state, context, currentRecord.pointer.value, resolved);
      effects.persistTabs?.(state);
      return bindPajaIntentGeneration(tab, currentRecord, context.runtime);
    },
    waitForReady(generation) {
      const state = getState();
      const context = getContext();
      if (!state || !context) return Promise.reject(new Error('Paja host is not available'));
      const tab = findRuntimeTabGeneration(state, generation);
      if (!tab || !isCurrentPajaIntentGeneration(generation, state, context, tab)) {
        invalidatePajaIntentGeneration(generation, context.runtime);
        return Promise.reject(new Error('intent target generation is not current'));
      }
      if (tab.windowId && context.runtime.readyWindowIds.has(tab.windowId)) return undefined;
      return new Promise<void>((resolve, reject) => {
        const waiters = context.runtime.readyWaiters.get(generation) ?? new Set();
        waiters.add({ resolve, reject });
        context.runtime.readyWaiters.set(generation, waiters);
      });
    },
    isCurrent(generation) {
      const state = getState();
      const context = getContext();
      const tab = state && context ? findRuntimeTabGeneration(state, generation) : null;
      if (!tab || !state || !context || !isCurrentPajaIntentGeneration(generation, state, context, tab)) {
        if (context) invalidatePajaIntentGeneration(generation, context.runtime);
        return false;
      }
      return true;
    },
    getWindowId(generation) {
      const state = getState();
      const tab = state ? findRuntimeTabGeneration(state, generation) : null;
      return tab?.windowId ?? null;
    },
    send(generation, params) {
      const state = getState();
      const context = getContext();
      const tab = state && context ? findRuntimeTabGeneration(state, generation) : null;
      if (!state || !context || !tab || !tab.windowId || !isCurrentPajaIntentGeneration(generation, state, context, tab)) {
        if (context) invalidatePajaIntentGeneration(generation, context.runtime);
        throw new Error('intent target generation is not current and ready');
      }
      const source = tab.frame.contentWindow;
      if (!source || originRegistry.getWindowId(source) !== tab.windowId) {
        throw new Error('intent target source is no longer registered');
      }
      createPajaPostMessageProxy(source, state, tab.windowId).postMessage({
        type: 'inc.event',
        topic: params.convention,
        sender: params.sender,
        ...(params.payload === undefined ? {} : { payload: params.payload }),
      }, '*');
    },
  };
}

/**
 * Build resolver options from the host pointer config and simulated relay set.
 *
 * @param context - Current Paja browser context.
 * @returns Resolver options for a verified runtime pointer.
 */
export function pajaPointerResolverOptions(context: PajaBrowserStateContext) {
  return {
    relays: [
      ...(context.config.target.pointer?.relays ?? []),
      ...getPajaRelayUrls(context.runtime.currentSimulation),
    ],
    blossomServers: context.config.target.pointer?.blossomServers ?? [],
    maxWaitMs: context.config.target.pointer?.maxWaitMs,
  };
}

function recordSupportsDelivery(
  record: ReturnType<InstalledNappletCatalog['installed']>[number],
  params: IntentDispatchParams,
): boolean {
  return record.archetypes.some((archetype) =>
    archetype.slug === params.archetype
    && archetype.convention === params.convention,
  );
}

function resolvedSupportsDelivery(
  resolved: PajaResolvedPointer,
  params: IntentDispatchParams,
): boolean {
  return resolved.manifest.archetypes.some((archetype) =>
    archetype.slug === params.archetype
    && archetype.convention === params.convention,
  );
}

function findRuntimeTabGeneration(
  state: PajaBrowserState,
  generation: BrowserIntentGeneration,
): PajaRuntimeTab | null {
  return state.tabs.find((tab) => runtimeTabGenerationId(tab) === generation.id) ?? null;
}

function bindPajaIntentGeneration(
  tab: PajaRuntimeTab,
  record: NonNullable<ReturnType<InstalledNappletCatalog['get']>>,
  runtime: PajaHostRuntimeState,
): BrowserIntentGeneration {
  const generation = { id: runtimeTabGenerationId(tab) };
  runtime.intentRecords.set(generation, record);
  return generation;
}

function isCurrentPajaIntentGeneration(
  generation: BrowserIntentGeneration,
  state: PajaBrowserState,
  context: PajaBrowserStateContext,
  tab: PajaRuntimeTab,
): boolean {
  const record = context.runtime.intentRecords.get(generation);
  return record !== undefined
    && context.runtime.catalog.validateCurrent(record, tab.resolvedTarget) !== null
    && isCurrentRuntimeTabGeneration(state, context, tab);
}

function invalidatePajaIntentGeneration(
  generation: BrowserIntentGeneration,
  runtime: PajaHostRuntimeState,
): void {
  const waiters = runtime.readyWaiters.get(generation);
  if (!waiters) return;
  runtime.readyWaiters.delete(generation);
  for (const waiter of waiters) waiter.reject(new Error('intent target catalog record was replaced'));
}

/**
 * Reject retained readiness waits when their selected catalog record changes.
 *
 * @param state - Current Paja browser state.
 * @param context - Current Paja browser context.
 * @returns A function that removes the catalog subscription.
 */
export function subscribePajaIntentCatalogChanges(
  state: PajaBrowserState,
  context: PajaBrowserStateContext,
): () => void {
  return context.runtime.catalog.onChanged((dTag) => {
    for (const [generation] of context.runtime.readyWaiters) {
      const record = context.runtime.intentRecords.get(generation);
      if (!record || record.dTag !== dTag) continue;
      const tab = findRuntimeTabGeneration(state, generation);
      if (!tab || !isCurrentPajaIntentGeneration(generation, state, context, tab)) {
        invalidatePajaIntentGeneration(generation, context.runtime);
      }
    }
  });
}

function isCurrentRuntimeTabGeneration(
  state: PajaBrowserState,
  context: PajaBrowserStateContext,
  tab: PajaRuntimeTab,
): boolean {
  const source = tab.frame.contentWindow;
  return state.tabs.includes(tab)
    && tab.windowId !== null
    && source !== null
    && originRegistry.getWindowId(source) === tab.windowId
    && runtimeTabGenerationId(tab) === `${tab.id}:${tab.generation}`;
}

/**
 * Resolve ready waiters for a verified live runtime tab generation.
 *
 * @param state - Current Paja browser state.
 * @param context - Current Paja browser context.
 * @param tab - Runtime tab reporting readiness.
 * @param source - Message source that reported readiness.
 * @param registeredWindowId - Window ID currently registered for the source.
 * @param effects - Host-owned lifecycle effects.
 * @returns Whether the ready message belonged to the current tab generation.
 */
export function markRuntimeTabReady(
  state: PajaBrowserState,
  context: PajaBrowserStateContext,
  tab: PajaRuntimeTab,
  source: Window,
  registeredWindowId: string | null,
  effects: PajaIntentHostEffects = {},
): boolean {
  if (
    !tab.windowId
    || tab.frame.contentWindow !== source
    || registeredWindowId !== tab.windowId
    || !isCurrentRuntimeTabGeneration(state, context, tab)
  ) return false;
  context.runtime.readyWindowIds.add(tab.windowId);
  for (const [generation, waiters] of context.runtime.readyWaiters) {
    if (findRuntimeTabGeneration(state, generation) !== tab) continue;
    context.runtime.readyWaiters.delete(generation);
    if (!isCurrentPajaIntentGeneration(generation, state, context, tab)) {
      for (const waiter of waiters) waiter.reject(new Error('intent target catalog record was replaced'));
      continue;
    }
    for (const waiter of waiters) waiter.resolve();
  }
  tab.status = 'ready';
  if (state.activeTabId === tab.id) {
    if (effects.setReadyStatus) effects.setReadyStatus(state);
    else state.status = 'ready';
  }
  renderRuntimeTabs(state);
  return true;
}

/**
 * Reject retained readiness waits for a runtime tab generation being replaced.
 *
 * @param tab - Runtime tab whose generation is being cleared.
 * @param runtime - Paja runtime state that owns the retained waiters.
 */
export function clearRuntimeTabGeneration(
  tab: PajaRuntimeTab,
  runtime: PajaHostRuntimeState,
): void {
  for (const [generation, waiters] of runtime.readyWaiters) {
    if (generation.id !== runtimeTabGenerationId(tab)) continue;
    runtime.readyWaiters.delete(generation);
    for (const waiter of waiters) waiter.reject(new Error('intent target generation replaced'));
  }
}
