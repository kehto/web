/**
 * signer-service.ts — Signer service implementation.
 *
 * Handles NIP-5D signer.* envelope messages from napplets, dispatching to the
 * configured signer and responding with typed result/error envelopes.
 * Supports all 7 signer operations: getPublicKey, signEvent, getRelays,
 * nip04.encrypt, nip04.decrypt, nip44.encrypt, nip44.decrypt.
 */

import type { NappletMessage, NostrEvent } from '@napplet/core';
import type { ServiceHandler, Signer } from '@kehto/runtime';

/** Default kinds that require user consent before signing. */
const DEFAULT_CONSENT_KINDS = [0, 3, 5, 10002];

/**
 * Options for creating a signer service.
 *
 * @example
 * ```ts
 * const signerService = createSignerService({
 *   getSigner: () => window.nostr ?? null,
 *   onConsentNeeded: ({ event, resolve }) => {
 *     const allowed = confirm(`Allow signing kind ${event.kind}?`);
 *     resolve(allowed);
 *   },
 * });
 * ```
 */
export interface SignerServiceOptions {
  /**
   * Get the current signer instance. Returns null if no signer is available.
   * Called on every signer request — availability can change dynamically.
   */
  getSigner: () => Signer | null;

  /**
   * Called when a napplet requests signing of a destructive kind.
   * The shell host should present a consent UI and call resolve(true/false).
   * If not provided, destructive kinds are signed without consent gating.
   *
   * @param request - Contains windowId, the event to sign, and a resolve callback
   */
  onConsentNeeded?: (request: {
    windowId: string;
    event: NostrEvent;
    resolve: (allowed: boolean) => void;
  }) => void;

  /**
   * Kinds that require user consent before signing.
   * Default: [0, 3, 5, 10002] (metadata, contacts, relay list, NIP-46 relay list).
   */
  consentKinds?: number[];
}

/**
 * Create a signer service that handles NIP-5D signer.* envelope messages.
 *
 * Napplets send typed envelopes (e.g., { type: 'signer.signEvent', id, event }).
 * The service dispatches to the configured signer and responds with result or
 * error envelopes (e.g., { type: 'signer.signEvent.result', id, event }).
 *
 * @param options - Signer configuration including getSigner and optional consent handler
 * @returns A ServiceHandler ready for runtime.registerService('signer', handler)
 *
 * @example
 * ```ts
 * import { createSignerService } from '@kehto/services';
 *
 * const signer = createSignerService({
 *   getSigner: () => mySignerAdapter,
 * });
 * runtime.registerService('signer', signer);
 * ```
 */
export function createSignerService(options: SignerServiceOptions): ServiceHandler {
  const consentKinds = new Set(options.consentKinds ?? DEFAULT_CONSENT_KINDS);

  return {
    descriptor: {
      name: 'signer',
      version: '1.0.0',
      description: 'NIP-07 compatible signer proxy',
    },

    handleMessage(windowId: string, message: NappletMessage, send: (msg: NappletMessage) => void): void {
      const corrId = (message as any).id as string | undefined;

      const maybeSigner = options.getSigner();
      if (!maybeSigner) {
        send({ type: `${message.type}.error`, id: corrId, error: 'no signer configured' } as NappletMessage);
        return;
      }
      const signer = maybeSigner;

      switch (message.type) {
        case 'signer.getPublicKey': {
          Promise.resolve(signer.getPublicKey?.())
            .then((pubkey) => {
              send({ type: 'signer.getPublicKey.result', id: corrId, pubkey } as NappletMessage);
            })
            .catch((err: unknown) => {
              send({ type: 'signer.getPublicKey.error', id: corrId, error: (err as Error).message ?? 'getPublicKey failed' } as NappletMessage);
            });
          break;
        }

        case 'signer.signEvent': {
          const eventToSign = (message as any).event as NostrEvent | undefined;
          if (!eventToSign) {
            send({ type: 'signer.signEvent.error', id: corrId, error: 'missing event' } as NappletMessage);
            break;
          }

          const doSign = (): void => {
            (signer.signEvent?.(eventToSign) ?? Promise.resolve(null))
              .then((signed) => {
                send({ type: 'signer.signEvent.result', id: corrId, event: signed } as NappletMessage);
              })
              .catch((err: unknown) => {
                send({ type: 'signer.signEvent.error', id: corrId, error: (err as Error).message ?? 'signEvent failed' } as NappletMessage);
              });
          };

          if (consentKinds.has(eventToSign.kind) && options.onConsentNeeded) {
            new Promise<boolean>((resolve) => {
              options.onConsentNeeded!({ windowId, event: eventToSign, resolve });
            })
              .then((allowed) => {
                if (!allowed) {
                  send({ type: 'signer.signEvent.error', id: corrId, error: 'user rejected' } as NappletMessage);
                  return;
                }
                doSign();
              })
              .catch(() => {
                send({ type: 'signer.signEvent.error', id: corrId, error: 'consent check failed' } as NappletMessage);
              });
          } else {
            doSign();
          }
          break;
        }

        case 'signer.getRelays': {
          Promise.resolve(signer.getRelays?.() ?? {})
            .then((relays) => {
              send({ type: 'signer.getRelays.result', id: corrId, relays } as NappletMessage);
            })
            .catch((err: unknown) => {
              send({ type: 'signer.getRelays.error', id: corrId, error: (err as Error).message ?? 'getRelays failed' } as NappletMessage);
            });
          break;
        }

        case 'signer.nip04.encrypt': {
          const pubkey = (message as any).pubkey as string ?? '';
          const plaintext = (message as any).plaintext as string ?? '';
          (signer.nip04?.encrypt(pubkey, plaintext) ?? Promise.resolve(''))
            .then((ciphertext) => {
              send({ type: 'signer.nip04.encrypt.result', id: corrId, ciphertext } as NappletMessage);
            })
            .catch((err: unknown) => {
              send({ type: 'signer.nip04.encrypt.error', id: corrId, error: (err as Error).message ?? 'nip04.encrypt failed' } as NappletMessage);
            });
          break;
        }

        case 'signer.nip04.decrypt': {
          const pubkey = (message as any).pubkey as string ?? '';
          const ciphertext = (message as any).ciphertext as string ?? '';
          (signer.nip04?.decrypt(pubkey, ciphertext) ?? Promise.resolve(''))
            .then((plaintext) => {
              send({ type: 'signer.nip04.decrypt.result', id: corrId, plaintext } as NappletMessage);
            })
            .catch((err: unknown) => {
              send({ type: 'signer.nip04.decrypt.error', id: corrId, error: (err as Error).message ?? 'nip04.decrypt failed' } as NappletMessage);
            });
          break;
        }

        case 'signer.nip44.encrypt': {
          const pubkey = (message as any).pubkey as string ?? '';
          const plaintext = (message as any).plaintext as string ?? '';
          (signer.nip44?.encrypt(pubkey, plaintext) ?? Promise.resolve(''))
            .then((ciphertext) => {
              send({ type: 'signer.nip44.encrypt.result', id: corrId, ciphertext } as NappletMessage);
            })
            .catch((err: unknown) => {
              send({ type: 'signer.nip44.encrypt.error', id: corrId, error: (err as Error).message ?? 'nip44.encrypt failed' } as NappletMessage);
            });
          break;
        }

        case 'signer.nip44.decrypt': {
          const pubkey = (message as any).pubkey as string ?? '';
          const ciphertext = (message as any).ciphertext as string ?? '';
          (signer.nip44?.decrypt(pubkey, ciphertext) ?? Promise.resolve(''))
            .then((plaintext) => {
              send({ type: 'signer.nip44.decrypt.result', id: corrId, plaintext } as NappletMessage);
            })
            .catch((err: unknown) => {
              send({ type: 'signer.nip44.decrypt.error', id: corrId, error: (err as Error).message ?? 'nip44.decrypt failed' } as NappletMessage);
            });
          break;
        }

        default:
          send({ type: `${message.type}.error`, id: corrId, error: `Unknown signer method: ${message.type}` } as NappletMessage);
          break;
      }
    },

    // Signer has no per-window state to clean up
    onWindowDestroyed(_windowId: string): void {
      /* no-op */
    },
  };
}
