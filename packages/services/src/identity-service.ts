/**
 * identity-service.ts — NIP-5D identity nub reference service.
 *
 * MIGRATION from signer-service (v1.1 -> v1.2):
 *   - signer.getPublicKey  -> identity.getPublicKey   (same shell state)
 *   - signer.getRelays     -> identity.getRelays      (same shell state)
 *   - signer.signEvent     -> DELETED (no napplet-visible path; shell signs
 *                             internally inside relay.publish)
 *   - signer.nip04.encrypt/decrypt -> DELETED
 *   - signer.nip44.encrypt/decrypt -> DELETED (shell encrypts internally
 *                                      inside relay.publishEncrypted)
 *
 * See REQUIREMENTS.md DEPS-03 (Phase 15 changelog).
 *
 * Handles 9 identity.* request types from @napplet/nub-identity. getPublicKey
 * and getRelays return real values sourced from hooks.auth.getSigner(); the
 * remaining 7 (getProfile/getFollows/getList/getZaps/getMutes/getBlocked/
 * getBadges) are stub-level — each returns an empty default payload with the
 * spec-correct envelope shape. Host apps plug real backends via
 * runtime.registerService('identity', realHandler).
 */

import type { NappletMessage } from '@napplet/core';
import type { ServiceHandler, Signer } from '@kehto/runtime';
import type {
  IdentityGetPublicKeyResultMessage,
  IdentityGetRelaysResultMessage,
  IdentityGetProfileResultMessage,
  IdentityGetFollowsResultMessage,
  IdentityGetListResultMessage,
  IdentityGetZapsResultMessage,
  IdentityGetMutesResultMessage,
  IdentityGetBlockedResultMessage,
  IdentityGetBadgesResultMessage,
  RelayPermission,
} from '@napplet/nub-identity';

/** Identity service version — follows semver. */
const IDENTITY_SERVICE_VERSION = '1.0.0';

/**
 * Options for creating the identity service.
 *
 * @example
 * ```ts
 * const identityService = createIdentityService({
 *   getSigner: () => window.nostr ?? null,
 * });
 * runtime.registerService('identity', identityService);
 * ```
 */
export interface IdentityServiceOptions {
  /**
   * Return the NIP-07-compatible signer (or null) used to resolve
   * identity.getPublicKey / identity.getRelays. Called on every request —
   * availability can change dynamically.
   */
  getSigner: () => Signer | null;
}

/**
 * Create an identity service that handles NIP-5D identity.* envelope messages.
 *
 * Supports all 9 identity.* request types from @napplet/nub-identity. The two
 * read-only nostr-info queries (getPublicKey, getRelays) resolve through the
 * caller-supplied signer; the remaining 7 return default/empty payloads with
 * spec-correct envelope shapes so napplets always receive a result envelope.
 *
 * @param options - Identity service configuration (getSigner)
 * @returns A ServiceHandler ready for runtime.registerService('identity', handler)
 *
 * @example
 * ```ts
 * import { createIdentityService } from '@kehto/services';
 *
 * const identity = createIdentityService({
 *   getSigner: () => mySignerAdapter,
 * });
 * runtime.registerService('identity', identity);
 * ```
 */
export function createIdentityService(options: IdentityServiceOptions): ServiceHandler {
  return {
    descriptor: {
      name: 'identity',
      version: IDENTITY_SERVICE_VERSION,
      description: 'NIP-5D identity NUB reference handler (9 read-only identity queries)',
    },

    handleMessage(
      _windowId: string,
      message: NappletMessage,
      send: (msg: NappletMessage) => void,
    ): void {
      const id = (message as NappletMessage & { id?: string }).id ?? '';

      function sendError(typeBase: string, error: string): void {
        send({ type: `${typeBase}.error`, id, error } as NappletMessage);
      }

      const signer = options.getSigner();

      switch (message.type) {
        case 'identity.getPublicKey': {
          // Per NIP-5D spec comment "Always succeeds" — return empty pubkey when no signer is
          // configured rather than sending an error. The nub-identity shim's getPublicKey()
          // only handles 'identity.getPublicKey.result'; an error response hangs the Promise
          // indefinitely. Empty pubkey is the correct sentinel for "no signer connected".
          if (!signer) {
            const result: IdentityGetPublicKeyResultMessage = {
              type: 'identity.getPublicKey.result',
              id,
              pubkey: '',
            };
            send(result);
            return;
          }
          Promise.resolve(signer.getPublicKey?.())
            .then((pubkey) => {
              const result: IdentityGetPublicKeyResultMessage = {
                type: 'identity.getPublicKey.result',
                id,
                pubkey: (pubkey as string) ?? '',
              };
              send(result);
            })
            .catch((err: unknown) => {
              sendError(
                'identity.getPublicKey',
                (err as Error)?.message ?? 'getPublicKey failed',
              );
            });
          return;
        }

        case 'identity.getRelays': {
          if (!signer) {
            sendError('identity.getRelays', 'no signer configured');
            return;
          }
          Promise.resolve(signer.getRelays?.() ?? {})
            .then((relays) => {
              const result: IdentityGetRelaysResultMessage = {
                type: 'identity.getRelays.result',
                id,
                relays: relays as Record<string, RelayPermission>,
              };
              send(result);
            })
            .catch((err: unknown) => {
              sendError(
                'identity.getRelays',
                (err as Error)?.message ?? 'getRelays failed',
              );
            });
          return;
        }

        case 'identity.getProfile': {
          const result: IdentityGetProfileResultMessage = {
            type: 'identity.getProfile.result',
            id,
            profile: null,
          };
          send(result);
          return;
        }

        case 'identity.getFollows': {
          const result: IdentityGetFollowsResultMessage = {
            type: 'identity.getFollows.result',
            id,
            pubkeys: [],
          };
          send(result);
          return;
        }

        case 'identity.getList': {
          const result: IdentityGetListResultMessage = {
            type: 'identity.getList.result',
            id,
            entries: [],
          };
          send(result);
          return;
        }

        case 'identity.getZaps': {
          const result: IdentityGetZapsResultMessage = {
            type: 'identity.getZaps.result',
            id,
            zaps: [],
          };
          send(result);
          return;
        }

        case 'identity.getMutes': {
          const result: IdentityGetMutesResultMessage = {
            type: 'identity.getMutes.result',
            id,
            pubkeys: [],
          };
          send(result);
          return;
        }

        case 'identity.getBlocked': {
          const result: IdentityGetBlockedResultMessage = {
            type: 'identity.getBlocked.result',
            id,
            pubkeys: [],
          };
          send(result);
          return;
        }

        case 'identity.getBadges': {
          const result: IdentityGetBadgesResultMessage = {
            type: 'identity.getBadges.result',
            id,
            badges: [],
          };
          send(result);
          return;
        }

        default:
          sendError(message.type, `Unknown identity method: ${message.type}`);
      }
    },

    // Identity service has no per-window state to clean up.
    onWindowDestroyed(_windowId: string): void {
      /* no-op */
    },
  };
}
