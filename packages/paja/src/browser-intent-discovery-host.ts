/**
 * Paja's host side of "Not installed yet" NAP-INTENT handlers (kehto/web#523).
 *
 * The search runs on the user's configured relays and only after an explicit
 * click. Installing a pick is the same verified pointer load used for every
 * napplet. Discovery results never reach napplets, and they are never put in
 * the installed catalog without that load.
 *
 * @module
 */

import { appendPajaMessageLog } from './browser-devtools.js';
import { pajaPointerResolverOptions, recordInstalledIntentSurface } from './browser-intent-host.js';
import type { PajaIntentDiscoveryHost, PajaIntentOfferRequest } from './browser-intent-links.js';
import type { PajaBrowserState, PajaBrowserStateContext } from './browser-host.js';
import { findPajaIntentHandlers } from './intent-handler-discovery.js';
import { isPajaRelayAllowed } from './browser-relay-policy.js';
import type { IntentHandlerHint } from '@kehto/services';
import { resolvePajaPointer } from './runtime-resolver.js';

/**
 * Hint relays come from the napplet: apply Paja's napplet relay policy (public
 * `wss:` or explicitly configured) so a hint never bypasses network policy.
 *
 * @param hint - The request's untrusted `handlerHint`.
 * @param configured - Relays the host has configured.
 * @returns The hint with only policy-allowed relays.
 * @example
 * ```ts
 * pajaAllowedIntentHint({ address, relays: ['ws://10.0.0.2'] }, []); // { address }
 * ```
 */
export function pajaAllowedIntentHint(hint: IntentHandlerHint, configured: readonly string[]): IntentHandlerHint {
  const relays = (hint.relays ?? []).filter((url) => isPajaRelayAllowed(url, () => [...configured]));
  return { address: hint.address, ...(relays.length === 0 ? {} : { relays }) };
}

/**
 * Build the search and verified-install hooks for one rejected request.
 *
 * @param state - Paja state, for console logging.
 * @param context - Paja runtime context with the catalog and relay settings.
 * @param request - The request no installed handler matched.
 * @returns Hooks for {@link PajaIntentLinkController.offerUninstalled}.
 * @example
 * ```ts
 * links.offerUninstalled(request, createPajaIntentDiscoveryHost(state, context, request));
 * ```
 */
export function createPajaIntentDiscoveryHost(
  state: PajaBrowserState,
  context: PajaBrowserStateContext,
  request: PajaIntentOfferRequest & { readonly handlerHint?: IntentHandlerHint },
): PajaIntentDiscoveryHost {
  const { archetype, convention } = request;
  return {
    async search() {
      appendPajaMessageLog(state, 'paja', { type: 'paja.intent.discovery.search', archetype, convention });
      const resolver = pajaPointerResolverOptions(context);
      try {
        const offers = await findPajaIntentHandlers({ archetype, convention }, {
          relays: resolver.relays,
          ...(resolver.maxWaitMs === undefined ? {} : { maxWaitMs: resolver.maxWaitMs }),
          ...(request.handlerHint === undefined ? {} : { hint: pajaAllowedIntentHint(request.handlerHint, resolver.relays) }),
          installed: (id) => context.runtime.catalog.has(id),
        });
        appendPajaMessageLog(state, 'paja', {
          type: 'paja.intent.discovery.found',
          convention,
          offers: offers.map((offer) => ({ catalogId: offer.catalogId, recommended: offer.recommended })),
        });
        return offers;
      } catch (error) {
        appendPajaMessageLog(state, 'paja', {
          type: 'paja.intent.discovery.error',
          convention,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    async install(offer) {
      appendPajaMessageLog(state, 'paja', { type: 'paja.intent.discovery.install', catalogId: offer.catalogId, pointer: offer.pointer });
      try {
        const resolved = await resolvePajaPointer(offer.pointer, pajaPointerResolverOptions(context));
        if (resolved.manifest.catalogId !== offer.catalogId) {
          throw new Error('The verified manifest is not the app that was offered.');
        }
        context.runtime.catalog.install(resolved);
        recordInstalledIntentSurface(state, resolved);
        return resolved.manifest.catalogId;
      } catch (error) {
        appendPajaMessageLog(state, 'paja', {
          type: 'paja.intent.discovery.install-error',
          catalogId: offer.catalogId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  };
}
