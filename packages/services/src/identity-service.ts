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
 *   - identity.decrypt -> ADDED in v1.8 as a shell-mediated decrypt request
 *                         with class gate + typed error union.
 *
 * See REQUIREMENTS.md DEPS-03 (Phase 15 changelog).
 *
 * Handles 10 identity.* request types from @napplet/nub/identity. getPublicKey
 * and getRelays return real values sourced from hooks.auth.getSigner(); the
 * remaining 7 (getProfile/getFollows/getList/getZaps/getMutes/getBlocked/
 * getBadges) are stub-level; decrypt delegates to a host-supplied bridge.
 * Host apps plug real backends via runtime.registerService('identity', realHandler).
 */

import type { NappletMessage, NostrEvent, Rumor } from '@napplet/core';
import type { ServiceHandler, Signer } from '@kehto/runtime';
import type {
  IdentityDecryptErrorCode,
  IdentityDecryptErrorMessage,
  IdentityDecryptMessage,
  IdentityDecryptResultMessage,
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
} from '@napplet/nub/identity/types';

/** Identity service version — follows semver. */
const IDENTITY_SERVICE_VERSION = '1.0.0';

type EncryptionMode = 'nip04' | 'nip44-direct' | 'nip17';

const DECRYPT_ERROR_CODES: readonly IdentityDecryptErrorCode[] = [
  'class-forbidden',
  'signer-denied',
  'signer-unavailable',
  'decrypt-failed',
  'malformed-wrap',
  'impersonation',
  'unsupported-encryption',
  'policy-denied',
];

const DECRYPT_ERROR_CODE_SET = new Set<string>(DECRYPT_ERROR_CODES);

export interface GiftWrapDecryptResult {
  seal: NostrEvent;
  rumor: Rumor;
}

export interface HostDecryptBridge {
  nip04Decrypt(senderPubkey: string, ciphertext: string): Promise<string>;
  nip44Decrypt(senderPubkey: string, ciphertext: string): Promise<string>;
  unwrapGiftWrap(wrap: NostrEvent): Promise<GiftWrapDecryptResult>;
}

export type VerifyEvent = (event: NostrEvent) => boolean | Promise<boolean>;

function isDecryptErrorCode(value: unknown): value is IdentityDecryptErrorCode {
  return typeof value === 'string' && DECRYPT_ERROR_CODE_SET.has(value);
}

function normalizeDecryptError(error: unknown): IdentityDecryptErrorCode {
  if (isDecryptErrorCode(error)) return error;
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { code?: unknown; error?: unknown; message?: unknown };
    if (isDecryptErrorCode(candidate.code)) return candidate.code;
    if (isDecryptErrorCode(candidate.error)) return candidate.error;
    if (isDecryptErrorCode(candidate.message)) return candidate.message;
  }
  return 'decrypt-failed';
}

function sendDecryptError(
  id: string,
  error: IdentityDecryptErrorCode,
  send: (msg: NappletMessage) => void,
): void {
  const result: IdentityDecryptErrorMessage = {
    type: 'identity.decrypt.error',
    id,
    error,
  };
  send(result);
}

function isStringArrayArray(value: unknown): value is string[][] {
  return Array.isArray(value) && value.every(
    (tag) => Array.isArray(tag) && tag.every((part) => typeof part === 'string'),
  );
}

function isNostrEvent(value: unknown): value is NostrEvent {
  const event = value as Partial<NostrEvent> | null;
  return typeof event === 'object' &&
    event !== null &&
    typeof event.id === 'string' &&
    typeof event.pubkey === 'string' &&
    typeof event.created_at === 'number' &&
    typeof event.kind === 'number' &&
    isStringArrayArray(event.tags) &&
    typeof event.content === 'string' &&
    typeof event.sig === 'string';
}

function isRumor(value: unknown): value is Rumor {
  const rumor = value as Partial<Rumor> | null;
  return typeof rumor === 'object' &&
    rumor !== null &&
    typeof rumor.id === 'string' &&
    typeof rumor.pubkey === 'string' &&
    typeof rumor.created_at === 'number' &&
    typeof rumor.kind === 'number' &&
    isStringArrayArray(rumor.tags) &&
    typeof rumor.content === 'string';
}

function isGiftWrapDecryptResult(value: unknown): value is GiftWrapDecryptResult {
  const result = value as Partial<GiftWrapDecryptResult> | null;
  return typeof result === 'object' &&
    result !== null &&
    isNostrEvent(result.seal) &&
    isRumor(result.rumor);
}

function firstDecodedByte(content: string): number | null {
  const trimmed = content.trim();
  if (trimmed.length === 0) return null;
  const normalized = trimmed.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  try {
    const decoded = atob(padded);
    return decoded.length > 0 ? decoded.charCodeAt(0) : null;
  } catch {
    return null;
  }
}

function detectEncryptionMode(event: NostrEvent): EncryptionMode | null {
  if (event.kind === 4) return 'nip04';
  if (event.kind === 1059) return 'nip17';
  if (event.kind === 14 || firstDecodedByte(event.content) === 0x02) {
    return 'nip44-direct';
  }
  return null;
}

function rumorFromSignedEvent(event: NostrEvent, content: string): Rumor {
  return {
    id: event.id,
    pubkey: event.pubkey,
    kind: event.kind,
    tags: event.tags,
    created_at: event.created_at,
    content,
  };
}

async function handleDecrypt(
  id: string,
  message: IdentityDecryptMessage,
  send: (msg: NappletMessage) => void,
  options: IdentityServiceOptions,
): Promise<void> {
  const event = (message as IdentityDecryptMessage & { event?: unknown }).event;
  if (!isNostrEvent(event)) {
    sendDecryptError(id, 'malformed-wrap', send);
    return;
  }

  const verifyEvent = options.verifyEvent ?? (() => true);
  let verified: boolean;
  try {
    verified = await Promise.resolve(verifyEvent(event));
  } catch {
    sendDecryptError(id, 'malformed-wrap', send);
    return;
  }
  if (!verified) {
    sendDecryptError(id, 'malformed-wrap', send);
    return;
  }

  const mode = detectEncryptionMode(event);
  if (!mode) {
    sendDecryptError(id, 'unsupported-encryption', send);
    return;
  }

  const decryptor = options.getDecryptor?.() ?? null;
  if (!decryptor) {
    sendDecryptError(id, 'signer-unavailable', send);
    return;
  }

  try {
    if (mode === 'nip04') {
      const plaintext = await decryptor.nip04Decrypt(event.pubkey, event.content);
      const result: IdentityDecryptResultMessage = {
        type: 'identity.decrypt.result',
        id,
        rumor: rumorFromSignedEvent(event, plaintext),
        sender: event.pubkey,
      };
      send(result);
      return;
    }

    if (mode === 'nip44-direct') {
      const plaintext = await decryptor.nip44Decrypt(event.pubkey, event.content);
      const result: IdentityDecryptResultMessage = {
        type: 'identity.decrypt.result',
        id,
        rumor: rumorFromSignedEvent(event, plaintext),
        sender: event.pubkey,
      };
      send(result);
      return;
    }

    const unwrapped = await decryptor.unwrapGiftWrap(event);
    if (!isGiftWrapDecryptResult(unwrapped)) {
      sendDecryptError(id, 'malformed-wrap', send);
      return;
    }
    if (unwrapped.seal.pubkey !== unwrapped.rumor.pubkey) {
      sendDecryptError(id, 'impersonation', send);
      return;
    }
    const result: IdentityDecryptResultMessage = {
      type: 'identity.decrypt.result',
      id,
      rumor: unwrapped.rumor,
      sender: unwrapped.seal.pubkey,
    };
    send(result);
  } catch (error) {
    sendDecryptError(id, normalizeDecryptError(error), send);
  }
}

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

  /**
   * Return the host decrypt bridge. Called only after outer event signature
   * verification and encryption-mode detection succeed. Null means decrypt is
   * unavailable while the rest of the identity service remains usable.
   */
  getDecryptor?: () => HostDecryptBridge | null;

  /**
   * Verify a received event before any decrypt attempt. Host shells should
   * wire this to their canonical Nostr event verifier; tests and old hosts
   * default to true for backward compatibility with the 9 read-only actions.
   */
  verifyEvent?: VerifyEvent;
}

/**
 * Create an identity service that handles NIP-5D identity.* envelope messages.
 *
 * Supports all 10 identity.* request types from @napplet/nub/identity. The two
 * read-only nostr-info queries (getPublicKey, getRelays) resolve through the
 * caller-supplied signer; the remaining 7 return default/empty payloads with
 * spec-correct envelope shapes so napplets always receive a result envelope.
 * identity.decrypt delegates to the host decrypt bridge.
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

      function sendSignerError(typeBase: string, fallback: string, err: unknown): void {
        sendError(typeBase, (err as Error)?.message ?? fallback);
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
            .catch((err: unknown) => sendSignerError('identity.getPublicKey', 'getPublicKey failed', err));
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
            .catch((err: unknown) => sendSignerError('identity.getRelays', 'getRelays failed', err));
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

        case 'identity.decrypt': {
          void handleDecrypt(id, message as IdentityDecryptMessage, send, options);
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
