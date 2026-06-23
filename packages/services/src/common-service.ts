/**
 * common-service.ts — NAP-COMMON reference service.
 *
 * Shell-mediated public NIP-19 helpers and common social actions. The napplet
 * requests `common.*`; the shell owns identity, consent, event construction,
 * signing, publishing, relay access, and NIP-19 handling.
 */

import type {
  CommonActionResult,
  CommonFollowsResult,
  CommonNip19DecodeResult,
  CommonNip19EncodeInput,
  CommonNip19EncodeResult,
  CommonProfileResult,
  CommonProfileTarget,
  CommonReaction,
  CommonReportReason,
  CommonReportTarget,
  NappletMessage,
} from '@napplet/core';
import type {
  CommonDecodeNip19Message,
  CommonEncodeNip19Message,
  CommonFollowMessage,
  CommonGetProfileMessage,
  CommonReactMessage,
  CommonReportMessage,
  CommonUnfollowMessage,
} from '@napplet/nap/common/types';
import type { ServiceDescriptor, ServiceHandler } from '@kehto/runtime';
import {
  decode,
  encodeBytes,
  naddrEncode,
  neventEncode,
  noteEncode,
  nprofileEncode,
  npubEncode,
} from 'nostr-tools/nip19';

const COMMON_SERVICE_VERSION = '1.0.0';
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

/** Context passed to host-provided NAP-COMMON hooks. */
export interface CommonServiceContext {
  /** Window id of the requesting napplet. */
  windowId: string;
}

/** Options for {@link createCommonService}. */
export interface CommonServiceOptions {
  /** Host-owned profile lookup. */
  getProfile?: (target: CommonProfileTarget, context: CommonServiceContext) => CommonProfileResult | Promise<CommonProfileResult>;
  /** Host-owned current-user follows lookup. */
  follows?: (context: CommonServiceContext) => CommonFollowsResult | Promise<CommonFollowsResult>;
  /** Host-owned follow action. */
  follow?: (pubkeys: string[], context: CommonServiceContext) => CommonActionResult | Promise<CommonActionResult>;
  /** Host-owned unfollow action. */
  unfollow?: (pubkeys: string[], context: CommonServiceContext) => CommonActionResult | Promise<CommonActionResult>;
  /** Host-owned reaction action. */
  react?: (
    targetEventId: string,
    reaction: CommonReaction,
    customEmojiHref: string | undefined,
    context: CommonServiceContext,
  ) => CommonActionResult | Promise<CommonActionResult>;
  /** Host-owned report action. */
  report?: (
    target: CommonReportTarget,
    reason: CommonReportReason,
    text: string,
    context: CommonServiceContext,
  ) => CommonActionResult | Promise<CommonActionResult>;
}

type Send = (msg: NappletMessage) => void;

const COMMON_DESCRIPTOR: ServiceDescriptor = {
  name: 'common',
  version: COMMON_SERVICE_VERSION,
  description: 'NAP-COMMON reference handler for shell-mediated social helpers',
};

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return fallback;
}

function encodeNip19(input: CommonNip19EncodeInput): CommonNip19EncodeResult {
  try {
    switch (input.type) {
      case 'npub':
        return { ok: true, value: npubEncode(input.hex), nip19Type: input.type };
      case 'note':
        return { ok: true, value: noteEncode(input.hex), nip19Type: input.type };
      case 'nprofile':
        return { ok: true, value: nprofileEncode({ pubkey: input.pubkey, relays: input.relays }), nip19Type: input.type };
      case 'nevent':
        return {
          ok: true,
          value: neventEncode({ id: input.eventId, relays: input.relays, author: input.author, kind: input.kind }),
          nip19Type: input.type,
        };
      case 'naddr':
        return {
          ok: true,
          value: naddrEncode({ identifier: input.identifier, pubkey: input.pubkey, kind: input.kind, relays: input.relays }),
          nip19Type: input.type,
        };
      case 'nrelay':
        return { ok: true, value: encodeBytes('nrelay', new TextEncoder().encode(input.relay)), nip19Type: input.type };
      default:
        return { ok: false, error: 'unsupported NIP-19 type' };
    }
  } catch (err) {
    return { ok: false, error: errorMessage(err, 'NIP-19 encode failed') };
  }
}

function decodeNip19Value(value: string): CommonNip19DecodeResult {
  try {
    const decoded = decode(value);
    switch (decoded.type) {
      case 'npub':
      case 'note':
        return { ok: true, nip19Type: decoded.type, hex: decoded.data };
      case 'nprofile':
        return { ok: true, nip19Type: decoded.type, pubkey: decoded.data.pubkey, relays: decoded.data.relays };
      case 'nevent':
        return {
          ok: true,
          nip19Type: decoded.type,
          eventId: decoded.data.id,
          relays: decoded.data.relays,
          author: decoded.data.author,
          kind: decoded.data.kind,
        };
      case 'naddr':
        return {
          ok: true,
          nip19Type: decoded.type,
          identifier: decoded.data.identifier,
          pubkey: decoded.data.pubkey,
          kind: decoded.data.kind,
          relays: decoded.data.relays,
        };
      default:
        return { ok: false, error: 'unsupported NIP-19 type' };
    }
  } catch (err) {
    if (value.startsWith('nrelay1')) return decodeNrelay(value);
    return { ok: false, error: errorMessage(err, 'NIP-19 decode failed') };
  }
}

function decodeNrelay(value: string): CommonNip19DecodeResult {
  try {
    const separator = value.lastIndexOf('1');
    if (separator <= 0 || separator + 7 > value.length) return { ok: false, error: 'invalid nrelay value' };
    const dataPart = value.slice(separator + 1);
    const words = [...dataPart].map((char) => {
      const index = BECH32_CHARSET.indexOf(char);
      if (index === -1) throw new Error('invalid nrelay character');
      return index;
    });
    const payloadWords = words.slice(0, -6);
    const bytes = convertBits(payloadWords, 5, 8, false);
    return { ok: true, nip19Type: 'nrelay', relay: new TextDecoder().decode(Uint8Array.from(bytes)) };
  } catch (err) {
    return { ok: false, error: errorMessage(err, 'invalid nrelay value') };
  }
}

function convertBits(data: readonly number[], fromBits: number, toBits: number, pad: boolean): number[] {
  let acc = 0;
  let bits = 0;
  const result: number[] = [];
  const maxv = (1 << toBits) - 1;
  const maxAcc = (1 << (fromBits + toBits - 1)) - 1;
  for (const value of data) {
    if (value < 0 || value >> fromBits !== 0) throw new Error('invalid bech32 data');
    acc = ((acc << fromBits) | value) & maxAcc;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      result.push((acc >> bits) & maxv);
    }
  }
  if (pad) {
    if (bits > 0) result.push((acc << (toBits - bits)) & maxv);
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv) !== 0) {
    throw new Error('invalid bech32 padding');
  }
  return result;
}

function settle<T>(
  call: () => T | Promise<T>,
  send: Send,
  okFalse: (error: string) => NappletMessage,
  onValue: (value: T) => NappletMessage,
): void {
  let pending: Promise<T>;
  try {
    pending = Promise.resolve(call());
  } catch (err) {
    send(okFalse(errorMessage(err, 'common request failed')));
    return;
  }
  pending
    .then((value) => send(onValue(value)))
    .catch((err) => send(okFalse(errorMessage(err, 'common request failed'))));
}

/**
 * Create the NAP-COMMON reference service.
 *
 * @param options - Host profile/social hooks for common.* requests.
 * @returns A runtime service handler for the `common` domain.
 */
export function createCommonService(options: CommonServiceOptions = {}): ServiceHandler {
  return {
    descriptor: COMMON_DESCRIPTOR,
    handleMessage(windowId: string, message: NappletMessage, send: Send): void {
      const id = (message as NappletMessage & { id?: string }).id ?? '';
      const context = { windowId };

      if (message.type === 'common.encodeNip19') {
        const input = (message as CommonEncodeNip19Message).input;
        const result = input ? encodeNip19(input) : { ok: false, error: 'invalid input' };
        send({ type: 'common.encodeNip19.result', id, ...result } as NappletMessage);
        return;
      }

      if (message.type === 'common.decodeNip19') {
        const value = (message as CommonDecodeNip19Message).value;
        const result = typeof value === 'string' ? decodeNip19Value(value) : { ok: false, error: 'invalid value' };
        send({ type: 'common.decodeNip19.result', id, ...result } as NappletMessage);
        return;
      }

      if (message.type === 'common.getProfile') {
        const target = (message as CommonGetProfileMessage).target;
        if (!options.getProfile) {
          send({ type: 'common.getProfile.result', id, ok: false, pubkey: target ?? '', error: 'profile lookup unavailable' } as NappletMessage);
          return;
        }
        settle(
          () => options.getProfile!(target, context),
          send,
          (error) => ({ type: 'common.getProfile.result', id, ok: false, pubkey: target ?? '', error } as NappletMessage),
          (result) => ({ type: 'common.getProfile.result', id, ...result } as NappletMessage),
        );
        return;
      }

      if (message.type === 'common.follows') {
        if (!options.follows) {
          send({ type: 'common.follows.result', id, ok: false, pubkeys: [], error: 'follows lookup unavailable' } as NappletMessage);
          return;
        }
        settle(
          () => options.follows!(context),
          send,
          (error) => ({ type: 'common.follows.result', id, ok: false, pubkeys: [], error } as NappletMessage),
          (result) => ({ type: 'common.follows.result', id, ...result } as NappletMessage),
        );
        return;
      }

      if (message.type === 'common.follow') {
        const pubkeys = (message as CommonFollowMessage).pubkeys ?? [];
        settleAction(options.follow, pubkeys, context, send, 'common.follow.result', id, 'follow unavailable');
        return;
      }

      if (message.type === 'common.unfollow') {
        const pubkeys = (message as CommonUnfollowMessage).pubkeys ?? [];
        settleAction(options.unfollow, pubkeys, context, send, 'common.unfollow.result', id, 'unfollow unavailable');
        return;
      }

      if (message.type === 'common.react') {
        const m = message as CommonReactMessage;
        if (!options.react) {
          send({ type: 'common.react.result', id, ok: false, error: 'react unavailable' } as NappletMessage);
          return;
        }
        settle(
          () => options.react!(m.targetEventId, m.reaction, m.customEmojiHref, context),
          send,
          (error) => ({ type: 'common.react.result', id, ok: false, error } as NappletMessage),
          (result) => ({ type: 'common.react.result', id, ...result } as NappletMessage),
        );
        return;
      }

      if (message.type === 'common.report') {
        const m = message as CommonReportMessage;
        if (!options.report) {
          send({ type: 'common.report.result', id, ok: false, error: 'report unavailable' } as NappletMessage);
          return;
        }
        settle(
          () => options.report!(m.target, m.reason, m.text, context),
          send,
          (error) => ({ type: 'common.report.result', id, ok: false, error } as NappletMessage),
          (result) => ({ type: 'common.report.result', id, ...result } as NappletMessage),
        );
        return;
      }

      send({
        type: `${message.type}.error`,
        id,
        error: `Unknown common method: ${message.type}`,
      } as NappletMessage);
    },
    onWindowDestroyed(_windowId: string): void {
      /* no per-window state */
    },
  };
}

function settleAction(
  action: ((pubkeys: string[], context: CommonServiceContext) => CommonActionResult | Promise<CommonActionResult>) | undefined,
  pubkeys: string[],
  context: CommonServiceContext,
  send: Send,
  resultType: string,
  id: string,
  unavailable: string,
): void {
  if (!action) {
    send({ type: resultType, id, ok: false, error: unavailable } as NappletMessage);
    return;
  }
  settle(
    () => action(pubkeys, context),
    send,
    (error) => ({ type: resultType, id, ok: false, error } as NappletMessage),
    (result) => ({ type: resultType, id, ...result } as NappletMessage),
  );
}
