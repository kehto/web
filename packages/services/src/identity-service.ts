/**
 * identity-service.ts — NIP-5D identity nap reference service.
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
 * Identity is strictly read-only per NAP-IDENTITY: napplets learn *about* the
 * user but cannot act *as* the user — no signing, encryption, or decryption.
 * (An `identity.decrypt` capability was briefly added in v1.8 and removed as a
 * spec violation; decryption belongs to the runtime, inline over the wire.)
 *
 * Handles 9 identity.* request types from @napplet/nap/identity. getPublicKey
 * and getRelays return real values sourced from hooks.auth.getSigner(); the
 * remaining read-only queries can be backed by optional host providers. When a
 * provider is absent, the service keeps returning spec-shaped empty results.
 */

import type { NappletMessage } from '@napplet/core';
import type { ServiceHandler, Signer } from '@kehto/runtime';
import type {
  IdentityGetBadgesMessage,
  IdentityGetBlockedMessage,
  IdentityGetFollowsMessage,
  IdentityGetListMessage,
  IdentityGetMutesMessage,
  IdentityGetProfileMessage,
  IdentityGetPublicKeyResultMessage,
  IdentityGetRelaysResultMessage,
  IdentityGetProfileResultMessage,
  IdentityGetFollowsResultMessage,
  IdentityGetListResultMessage,
  IdentityGetZapsResultMessage,
  IdentityGetZapsMessage,
  IdentityGetMutesResultMessage,
  IdentityGetBlockedResultMessage,
  IdentityGetBadgesResultMessage,
  RelayPermission,
} from '@napplet/nap/identity/types';

/** Identity service version — follows semver. */
const IDENTITY_SERVICE_VERSION = '1.0.0';

/** A value that may be returned synchronously or through a Promise. */
export type MaybePromise<T> = T | Promise<T>;

type IdentityProviderResult = NappletMessage & { error?: string };
type SendIdentityMessage = (msg: NappletMessage) => void;

function sendProviderError<T extends IdentityProviderResult>(
  send: SendIdentityMessage,
  result: T,
  fallback: string,
  err: unknown,
): void {
  send({
    ...result,
    error: (err as Error)?.message ?? fallback,
  });
}

async function getCurrentPubkey(options: IdentityServiceOptions): Promise<string> {
  const currentSigner = options.getSigner();
  if (!currentSigner?.getPublicKey) return '';
  try {
    return (await currentSigner.getPublicKey()) ?? '';
  } catch {
    return '';
  }
}

function sendOptionalProviderResult<T extends IdentityProviderResult>(
  options: IdentityServiceOptions,
  send: SendIdentityMessage,
  fallbackResult: T,
  errorFallback: string,
  buildResult?: (pubkey: string) => MaybePromise<T>,
): void {
  if (!buildResult) {
    send(fallbackResult);
    return;
  }

  Promise.resolve(getCurrentPubkey(options))
    .then((pubkey) => buildResult(pubkey))
    .then((result) => send(result))
    .catch((err: unknown) => sendProviderError(send, fallbackResult, errorFallback, err));
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
   * Optional host-backed profile lookup for the current user.
   *
   * Kehto does not query relays itself; hosts that already maintain kind-0
   * metadata can provide it here without replacing the whole identity service.
   *
   * @param pubkey - Current signer pubkey, or "" when no signer is connected.
   * @param message - Original identity.getProfile request envelope.
   * @returns Profile metadata, or null when unavailable.
   */
  getProfile?: (
    pubkey: string,
    message: IdentityGetProfileMessage,
  ) => MaybePromise<IdentityGetProfileResultMessage['profile']>;

  /**
   * Optional host-backed follow-list lookup for the current user.
   *
   * @param pubkey - Current signer pubkey, or "" when no signer is connected.
   * @param message - Original identity.getFollows request envelope.
   * @returns Hex-encoded followed pubkeys.
   */
  getFollows?: (
    pubkey: string,
    message: IdentityGetFollowsMessage,
  ) => MaybePromise<IdentityGetFollowsResultMessage['pubkeys']>;

  /**
   * Optional host-backed categorized-list lookup for the current user.
   *
   * @param listType - Requested list category from the wire envelope.
   * @param pubkey - Current signer pubkey, or "" when no signer is connected.
   * @param message - Original identity.getList request envelope.
   * @returns List entries.
   */
  getList?: (
    listType: string,
    pubkey: string,
    message: IdentityGetListMessage,
  ) => MaybePromise<IdentityGetListResultMessage['entries']>;

  /**
   * Optional host-backed zap receipt lookup for the current user.
   *
   * @param pubkey - Current signer pubkey, or "" when no signer is connected.
   * @param message - Original identity.getZaps request envelope.
   * @returns Zap receipts.
   */
  getZaps?: (
    pubkey: string,
    message: IdentityGetZapsMessage,
  ) => MaybePromise<IdentityGetZapsResultMessage['zaps']>;

  /**
   * Optional host-backed mute-list lookup for the current user.
   *
   * @param pubkey - Current signer pubkey, or "" when no signer is connected.
   * @param message - Original identity.getMutes request envelope.
   * @returns Hex-encoded muted pubkeys.
   */
  getMutes?: (
    pubkey: string,
    message: IdentityGetMutesMessage,
  ) => MaybePromise<IdentityGetMutesResultMessage['pubkeys']>;

  /**
   * Optional host-backed block-list lookup for the current user.
   *
   * @param pubkey - Current signer pubkey, or "" when no signer is connected.
   * @param message - Original identity.getBlocked request envelope.
   * @returns Hex-encoded blocked pubkeys.
   */
  getBlocked?: (
    pubkey: string,
    message: IdentityGetBlockedMessage,
  ) => MaybePromise<IdentityGetBlockedResultMessage['pubkeys']>;

  /**
   * Optional host-backed badge lookup for the current user.
   *
   * @param pubkey - Current signer pubkey, or "" when no signer is connected.
   * @param message - Original identity.getBadges request envelope.
   * @returns Badges awarded to the user.
   */
  getBadges?: (
    pubkey: string,
    message: IdentityGetBadgesMessage,
  ) => MaybePromise<IdentityGetBadgesResultMessage['badges']>;
}

function sendIdentityError(
  send: SendIdentityMessage,
  id: string,
  typeBase: string,
  error: string,
): void {
  send({ type: `${typeBase}.error`, id, error } as NappletMessage);
}

function sendSignerError(
  send: SendIdentityMessage,
  id: string,
  typeBase: string,
  fallback: string,
  err: unknown,
): void {
  sendIdentityError(send, id, typeBase, (err as Error)?.message ?? fallback);
}

function handleGetPublicKey(options: IdentityServiceOptions, id: string, send: SendIdentityMessage): void {
  Promise.resolve()
    .then(() => options.getSigner())
    .then(async (signer) => signer?.getPublicKey ? signer.getPublicKey() : '')
    .catch(() => '')
    .then((pubkey) => {
      const result: IdentityGetPublicKeyResultMessage = {
        type: 'identity.getPublicKey.result',
        id,
        pubkey: pubkey ?? '',
      };
      send(result);
    });
}

function handleGetRelays(options: IdentityServiceOptions, id: string, send: SendIdentityMessage): void {
  const signer = options.getSigner();
  if (!signer) {
    sendIdentityError(send, id, 'identity.getRelays', 'no signer configured');
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
    .catch((err: unknown) => sendSignerError(send, id, 'identity.getRelays', 'getRelays failed', err));
}

function handleReadProvider(
  options: IdentityServiceOptions,
  id: string,
  message: NappletMessage,
  send: SendIdentityMessage,
): boolean {
  switch (message.type) {
    case 'identity.getProfile':
      sendOptionalProviderResult(
        options,
        send,
        { type: 'identity.getProfile.result', id, profile: null },
        'getProfile failed',
        options.getProfile
          ? async (pubkey): Promise<IdentityGetProfileResultMessage> => ({
            type: 'identity.getProfile.result',
            id,
            profile: await options.getProfile!(pubkey, message as IdentityGetProfileMessage),
          })
          : undefined,
      );
      return true;

    case 'identity.getFollows':
      sendOptionalProviderResult(
        options,
        send,
        { type: 'identity.getFollows.result', id, pubkeys: [] },
        'getFollows failed',
        options.getFollows
          ? async (pubkey): Promise<IdentityGetFollowsResultMessage> => ({
            type: 'identity.getFollows.result',
            id,
            pubkeys: await options.getFollows!(pubkey, message as IdentityGetFollowsMessage),
          })
          : undefined,
      );
      return true;

    case 'identity.getList':
      handleGetList(options, id, message as IdentityGetListMessage, send);
      return true;

    case 'identity.getZaps':
      sendOptionalProviderResult(
        options,
        send,
        { type: 'identity.getZaps.result', id, zaps: [] },
        'getZaps failed',
        options.getZaps
          ? async (pubkey): Promise<IdentityGetZapsResultMessage> => ({
            type: 'identity.getZaps.result',
            id,
            zaps: await options.getZaps!(pubkey, message as IdentityGetZapsMessage),
          })
          : undefined,
      );
      return true;

    case 'identity.getMutes':
      sendOptionalProviderResult(
        options,
        send,
        { type: 'identity.getMutes.result', id, pubkeys: [] },
        'getMutes failed',
        options.getMutes
          ? async (pubkey): Promise<IdentityGetMutesResultMessage> => ({
            type: 'identity.getMutes.result',
            id,
            pubkeys: await options.getMutes!(pubkey, message as IdentityGetMutesMessage),
          })
          : undefined,
      );
      return true;

    case 'identity.getBlocked':
      sendOptionalProviderResult(
        options,
        send,
        { type: 'identity.getBlocked.result', id, pubkeys: [] },
        'getBlocked failed',
        options.getBlocked
          ? async (pubkey): Promise<IdentityGetBlockedResultMessage> => ({
            type: 'identity.getBlocked.result',
            id,
            pubkeys: await options.getBlocked!(pubkey, message as IdentityGetBlockedMessage),
          })
          : undefined,
      );
      return true;

    case 'identity.getBadges':
      sendOptionalProviderResult(
        options,
        send,
        { type: 'identity.getBadges.result', id, badges: [] },
        'getBadges failed',
        options.getBadges
          ? async (pubkey): Promise<IdentityGetBadgesResultMessage> => ({
            type: 'identity.getBadges.result',
            id,
            badges: await options.getBadges!(pubkey, message as IdentityGetBadgesMessage),
          })
          : undefined,
      );
      return true;

    default:
      return false;
  }
}

function handleGetList(
  options: IdentityServiceOptions,
  id: string,
  message: IdentityGetListMessage,
  send: SendIdentityMessage,
): void {
  sendOptionalProviderResult(
    options,
    send,
    { type: 'identity.getList.result', id, entries: [] },
    'getList failed',
    options.getList
      ? async (pubkey): Promise<IdentityGetListResultMessage> => ({
        type: 'identity.getList.result',
        id,
        entries: await options.getList!(message.listType, pubkey, message),
      })
      : undefined,
  );
}

function handleIdentityServiceMessage(
  options: IdentityServiceOptions,
  message: NappletMessage,
  send: SendIdentityMessage,
): void {
  const id = (message as NappletMessage & { id?: string }).id ?? '';

  switch (message.type) {
    case 'identity.getPublicKey':
      // Per NIP-5D, no signer resolves to the empty-pubkey sentinel, not an error.
      handleGetPublicKey(options, id, send);
      return;

    case 'identity.getRelays':
      handleGetRelays(options, id, send);
      return;

    default:
      if (!handleReadProvider(options, id, message, send)) {
        sendIdentityError(send, id, message.type, `Unknown identity method: ${message.type}`);
      }
  }
}

/**
 * Create an identity service that handles NIP-5D identity.* envelope messages.
 *
 * Supports the 9 read-only identity.* request types from @napplet/nap/identity.
 * The two nostr-info queries (getPublicKey, getRelays) resolve through the
 * caller-supplied signer; the remaining read-only queries resolve through
 * optional host providers or return default/empty payloads with spec-correct
 * envelope shapes so napplets always receive a result envelope.
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
      description: 'NIP-5D identity NAP reference handler (9 read-only identity queries)',
    },

    handleMessage(
      _windowId: string,
      message: NappletMessage,
      send: (msg: NappletMessage) => void,
    ): void {
      handleIdentityServiceMessage(options, message, send);
    },

    // Identity service has no per-window state to clean up.
    onWindowDestroyed(_windowId: string): void {
      /* no-op */
    },
  };
}
