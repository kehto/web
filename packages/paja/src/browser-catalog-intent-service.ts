/** Paja's verified catalog to NAP-INTENT availability wiring. */

import { resolveShellEnvironment } from '@kehto/shell';
import type { ShellAdapter, ServiceHandler } from '@kehto/shell';
import { createCatalogIntentResolver, createIntentService } from '@kehto/services';
import type { IntentCandidate, IntentRequest } from '@kehto/services';
import type { BrowserIntentController } from './browser-intent-controller.js';
import type { InstalledNappletCatalog } from './installed-napplet-catalog.js';

/** Host-owned catalog, delivery, and selection policy. */
export interface PajaIntentHost {
  readonly catalog: InstalledNappletCatalog;
  readonly controller: BrowserIntentController;
  /** Resolve an authenticated frame to its verified catalog identity. */
  resolveSender(windowId: string): string | undefined;
  getDefaultHandler?(archetype: string): string | undefined;
  chooseHandler?(
    archetype: string,
    candidates: IntentCandidate[],
    sender: string,
  ): string | undefined | Promise<string | undefined>;
  authorizeExplicitHandler?(
    sender: string,
    handler: string,
    request: IntentRequest,
    candidate: IntentCandidate,
    context?: import('@kehto/services').IntentResolverContext,
  ): boolean | Promise<boolean>;
  resolveHandlerHint?(
    hint: import('@kehto/services').IntentHandlerHint,
    candidates: readonly IntentCandidate[],
  ): string | undefined | Promise<string | undefined>;
}

/**
 * Compose intent dispatch and catalog notifications with service lifecycle cleanup.
 * @param adapter - Live shell environment used to filter eligible targets.
 * @param host - Verified installations and host-owned intent policy.
 * @returns Runtime service and a default-handler change notification callback.
 * @example
 * const intent = createPajaCatalogIntentService(adapter, host);
 * adapter.services.intent = intent.service;
 */
export function createPajaCatalogIntentService(adapter: ShellAdapter, host: PajaIntentHost): {
  service: ServiceHandler;
  notifyChanged(archetype: string): void;
} {
  const resolver = createCatalogIntentResolver({
    loadCatalog: () => host.catalog.intentCatalog((record) =>
      resolveShellEnvironment(adapter, record).capabilities.domains.includes('intent'),
    ),
    targets: host.controller,
    getDefaultHandler: host.getDefaultHandler,
    chooseHandler: host.chooseHandler,
    authorizeExplicitHandler: host.authorizeExplicitHandler,
    resolveHandlerHint: host.resolveHandlerHint,
  });
  const intentService = createIntentService({
    resolver,
    resolveSender: host.resolveSender,
  });
  let stopCatalogChanges: (() => void) | undefined;
  const service: ServiceHandler = {
    ...intentService,
    onRegistered(context) {
      stopCatalogChanges?.();
      intentService.onRegistered?.(context);
      // NAP-INTENT (napplet/naps master e5308ac): catalog changes SHOULD
      // emit intent.changed. IDs are not archetypes; include removed contracts.
      stopCatalogChanges = host.catalog.onChanged((_id, archetypes) => {
        for (const archetype of archetypes) resolver.notifyChanged(archetype);
      });
    },
    onUnregistered() {
      stopCatalogChanges?.();
      stopCatalogChanges = undefined;
      intentService.onUnregistered?.();
    },
  };
  return { service, notifyChanged: (archetype) => resolver.notifyChanged(archetype) };
}
