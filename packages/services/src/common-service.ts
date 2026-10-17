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
import type { ApprovalSignal, ServiceDescriptor, ServiceHandler, ServiceRuntimeContext } from '@kehto/runtime';
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

/** NAP-COMMON operations which require a side-effect-free relay plan. */
export type CommonRelayOperation = 'profile' | 'follows' | 'follow' | 'unfollow' | 'react' | 'report';

/** Context passed to host-provided NAP-COMMON hooks. */
export interface CommonServiceContext {
  /** Window id of the requesting napplet. */
  readonly windowId: string;
  /** Immutable relay plan approved for this operation. */
  readonly relays?: readonly string[];
  /** Revoked when this operation's approval or source lifetime ends. */
  readonly signal?: ApprovalSignal;
}

/** Options for {@link createCommonService}. */
export interface CommonServiceOptions {
  /** Disclose actual relay destinations without querying or signing. */
  planRelays?: (operation: CommonRelayOperation, target?: unknown) => readonly string[] | null;
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

function originScopes(operation: string, relays: readonly string[], resources: readonly string[] = []): readonly CommonPermissionRequirement[] {
  const requirements: CommonPermissionRequirement[] = [
    { category: 'interface', domain: 'common', operation: 'access', scope: { kind: 'exact', value: 'common' } },
    ...resources.map((value) => ({ category: 'resource' as const, domain: 'common', operation, scope: { kind: 'exact' as const, value } })),
  ];
  for (const relay of relays) {
    try {
      const url = new URL(relay);
      if ((url.protocol !== 'ws:' && url.protocol !== 'wss:') || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error();
      requirements.push({ category: 'network', domain: 'common', operation, scope: { kind: 'origin', value: url.origin } });
    } catch { throw new Error('forbidden'); }
  }
  return requirements;
}

type CommonPermissionRequirement = Parameters<NonNullable<ServiceRuntimeContext['authorizeOperation']>>[2][number];

function requestId(message: NappletMessage): string {
  const id = (message as unknown as { id?: unknown }).id;
  return typeof id === 'string' ? id : '';
}

/**
 * Create the NAP-COMMON reference service.
 *
 * @param options - Host profile/social hooks for common.* requests.
 * @returns A runtime service handler for the `common` domain.
 */
// aislop-ignore-next-line function-too-long -- Approval planning, source generations, and canonical COMMON terminals form one service boundary.
export function createCommonService(options: CommonServiceOptions = {}): ServiceHandler {
  const generations = new Map<string, symbol>();
  let runtime: ServiceRuntimeContext | undefined;
  let warnedLegacy = false;

  const generationFor = (windowId: string): symbol => {
    let generation = generations.get(windowId);
    if (!generation) { generation = Symbol(windowId); generations.set(windowId, generation); }
    return generation;
  };
  const current = (windowId: string, generation: symbol): boolean => generations.get(windowId) === generation;
  const warnLegacy = (): void => {
    if (warnedLegacy) return;
    warnedLegacy = true;
    console.warn('[FW-COMMON-LEGACY-001] Configure immutable COMMON relay planning for approval-aware social operations. Warning once per service instance.');
  };
  const plan = (operation: CommonRelayOperation, target?: unknown): readonly string[] => {
    const relays = options.planRelays?.(operation, target);
    if (!relays || relays.length === 0) throw new Error('invalid request');
    return Object.freeze([...new Set(relays)]);
  };
  const execute = async <T>(windowId: string, generation: symbol, operation: string, relays: readonly string[], resources: readonly string[], action: (context: CommonServiceContext) => T | Promise<T>): Promise<T> => {
    if (!runtime?.authorizeOperation) {
      warnLegacy();
      return action({ windowId });
    }
    const outcome = await runtime.authorizeOperation(windowId, operation, originScopes(operation, relays, resources), async (signal) => {
      if (!current(windowId, generation) || signal.aborted) throw new Error('user-denied');
      const value = await action({ windowId, relays, signal });
      if (!current(windowId, generation) || signal.aborted) throw new Error('user-denied');
      return value;
    });
    if (outcome.status !== 'executed') throw new Error('user-denied');
    return outcome.value;
  };
  const local = <T>(windowId: string, generation: symbol, operation: string, action: () => T): void => {
    if (!runtime?.authorizeOperation) { if (current(windowId, generation)) action(); return; }
    void runtime.authorizeOperation(windowId, operation, originScopes(operation, []), async (signal) => {
      if (!current(windowId, generation) || signal.aborted) throw new Error('user-denied');
      return action();
    });
  };
  const settleAuthorized = <T>(windowId: string, generation: symbol, operation: CommonRelayOperation, target: unknown, resources: readonly string[], call: (context: CommonServiceContext) => T | Promise<T>, send: Send, failure: (error: string) => NappletMessage, success: (value: T) => NappletMessage): void => {
    void Promise.resolve().then(async () => {
      const relays = runtime?.authorizeOperation ? plan(operation, target) : [];
      return execute(windowId, generation, `common.${operation}`, relays, resources, call);
    }).then((value) => { if (current(windowId, generation)) send(success(value)); })
      .catch((error) => { if (current(windowId, generation)) send(failure(errorMessage(error, 'common request failed'))); });
  };

  return {
    descriptor: COMMON_DESCRIPTOR,
    onRegistered(context): void { runtime = context; },
    onUnregistered(): void { runtime = undefined; },
    handleMessage(windowId: string, message: NappletMessage, send: Send): void {
      const id = requestId(message);
      const generation = generationFor(windowId);
      const context = { windowId };
      if (message.type === 'common.encodeNip19') {
        const input = (message as CommonEncodeNip19Message).input;
        if (!runtime?.authorizeOperation) { send({ type: 'common.encodeNip19.result', id, ...(input ? encodeNip19(input) : { ok: false, error: 'invalid input' }) } as NappletMessage); return; }
        void runtime.authorizeOperation(windowId, 'common.encodeNip19', originScopes('common.encodeNip19', []), async (signal) => {
          if (signal.aborted || !current(windowId, generation)) throw new Error('user-denied');
          return input ? encodeNip19(input) : { ok: false, error: 'invalid input' };
        }).then((outcome) => { if (current(windowId, generation)) send({ type: 'common.encodeNip19.result', id, ...(outcome.status === 'executed' ? outcome.value : { ok: false, error: 'user-denied' }) } as NappletMessage); }).catch((error) => { if (current(windowId, generation)) send({ type: 'common.encodeNip19.result', id, ok: false, error: errorMessage(error, 'common request failed') } as NappletMessage); });
        return;
      }
      if (message.type === 'common.decodeNip19') {
        const value = (message as CommonDecodeNip19Message).value;
        if (!runtime?.authorizeOperation) { send({ type: 'common.decodeNip19.result', id, ...(typeof value === 'string' ? decodeNip19Value(value) : { ok: false, error: 'invalid value' }) } as NappletMessage); return; }
        void runtime.authorizeOperation(windowId, 'common.decodeNip19', originScopes('common.decodeNip19', []), async (signal) => {
          if (signal.aborted || !current(windowId, generation)) throw new Error('user-denied');
          return typeof value === 'string' ? decodeNip19Value(value) : { ok: false, error: 'invalid value' };
        }).then((outcome) => { if (current(windowId, generation)) send({ type: 'common.decodeNip19.result', id, ...(outcome.status === 'executed' ? outcome.value : { ok: false, error: 'user-denied' }) } as NappletMessage); }).catch((error) => { if (current(windowId, generation)) send({ type: 'common.decodeNip19.result', id, ok: false, error: errorMessage(error, 'common request failed') } as NappletMessage); });
        return;
      }
      if (message.type === 'common.getProfile') {
        const target = (message as CommonGetProfileMessage).target;
        if (!options.getProfile) { send({ type: 'common.getProfile.result', id, ok: false, pubkey: target ?? '', error: 'profile lookup unavailable' } as NappletMessage); return; }
        settleAuthorized(windowId, generation, 'profile', target, typeof target === 'string' ? [target] : [], (approved) => options.getProfile!(target, approved), send, (error) => ({ type: 'common.getProfile.result', id, ok: false, pubkey: target ?? '', error } as NappletMessage), (result) => ({ type: 'common.getProfile.result', id, ...result } as NappletMessage)); return;
      }
      if (message.type === 'common.follows') {
        if (!options.follows) { send({ type: 'common.follows.result', id, ok: false, pubkeys: [], error: 'follows lookup unavailable' } as NappletMessage); return; }
        settleAuthorized(windowId, generation, 'follows', undefined, [], (approved) => options.follows!(approved), send, (error) => ({ type: 'common.follows.result', id, ok: false, pubkeys: [], error } as NappletMessage), (result) => ({ type: 'common.follows.result', id, ...result } as NappletMessage)); return;
      }
      if (message.type === 'common.follow' || message.type === 'common.unfollow') {
        const follow = message.type === 'common.follow'; const pubkeys = (message as CommonFollowMessage | CommonUnfollowMessage).pubkeys ?? []; const hook = follow ? options.follow : options.unfollow; const operation = follow ? 'follow' : 'unfollow';
        if (!hook) { send({ type: `common.${operation}.result`, id, ok: false, error: `${operation} unavailable` } as NappletMessage); return; }
        settleAuthorized(windowId, generation, operation, pubkeys, pubkeys, (approved) => hook(pubkeys, approved), send, (error) => ({ type: `common.${operation}.result`, id, ok: false, error } as NappletMessage), (result) => ({ type: `common.${operation}.result`, id, ...result } as NappletMessage)); return;
      }
      if (message.type === 'common.react') {
        const request = message as CommonReactMessage;
        if (!options.react) { send({ type: 'common.react.result', id, ok: false, error: 'react unavailable' } as NappletMessage); return; }
        settleAuthorized(windowId, generation, 'react', request.targetEventId, [request.targetEventId], (approved) => options.react!(request.targetEventId, request.reaction, request.customEmojiHref, approved), send, (error) => ({ type: 'common.react.result', id, ok: false, error } as NappletMessage), (result) => ({ type: 'common.react.result', id, ...result } as NappletMessage)); return;
      }
      if (message.type === 'common.report') {
        const request = message as CommonReportMessage;
        if (!options.report) { send({ type: 'common.report.result', id, ok: false, error: 'report unavailable' } as NappletMessage); return; }
        const resource = request.target.type === 'event' ? request.target.id : request.target.pubkey;
        settleAuthorized(windowId, generation, 'report', request.target, [resource], (approved) => options.report!(request.target, request.reason, request.text, approved), send, (error) => ({ type: 'common.report.result', id, ok: false, error } as NappletMessage), (result) => ({ type: 'common.report.result', id, ...result } as NappletMessage)); return;
      }
      send({ type: `${message.type}.error`, id, error: `Unknown common method: ${message.type}` } as NappletMessage);
    },
    onWindowDestroyed(windowId): void { generations.delete(windowId); },
    onPermissionRevoked(windowId): void { generations.delete(windowId); },
  };
}

