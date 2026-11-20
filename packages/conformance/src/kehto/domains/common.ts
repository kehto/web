import { createCommonService } from '@kehto/services';
import { decode } from 'nostr-tools/nip19';
import { FIXTURE_PEER_PUBKEY } from '../user.js';
import type { DomainBackendModule } from './types.js';

/** Relay origin the COMMON plan names. Planning only: nothing connects to it. */
const COMMON_RELAY = 'wss://relay.conformance.invalid/';

/** Normalize a hex pubkey, `npub`, or `nprofile` to hex; `null` when it is none of them. */
function toHex(target: unknown): string | null {
  if (typeof target !== 'string') return null;
  if (/^[0-9a-f]{64}$/.test(target)) return target;
  try {
    const decoded = decode(target);
    if (decoded.type === 'npub') return decoded.data;
    if (decoded.type === 'nprofile') return decoded.data.pubkey;
  } catch {
    // Not a NIP-19 value.
  }
  return null;
}

/** NAP-COMMON backend: the reference common service over an in-memory profile and follow store. */
export const COMMON_BACKEND: DomainBackendModule = {
  domain: 'common',
  create() {
    const profiles = new Map<string, Record<string, unknown>>([[FIXTURE_PEER_PUBKEY, { name: 'conformance peer' }]]);
    const follows = new Set<string>([FIXTURE_PEER_PUBKEY]);
    const published: { kind: number; summary: string }[] = [];
    let sequence = 0;
    const publish = (kind: number, summary: string) => {
      published.push({ kind, summary });
      sequence += 1;
      return { ok: true, eventId: sequence.toString(16).padStart(64, '0') };
    };
    const follow = (targets: string[], add: boolean) => {
      const hex = targets.map(toHex);
      if (!hex.length || hex.some((value) => value === null)) return { ok: false, error: 'invalid-pubkey' };
      for (const value of hex as string[]) { if (add) follows.add(value); else follows.delete(value); }
      return publish(3, [...follows].join(','));
    };
    return {
      services: {
        common: createCommonService({
          planRelays: () => [COMMON_RELAY],
          getProfile: (target) => {
            const pubkey = toHex(target);
            if (!pubkey) return { ok: false, pubkey: '', error: 'invalid-profile-target' };
            return { ok: true, pubkey, profile: profiles.get(pubkey) ?? null };
          },
          follows: () => ({ ok: true, pubkeys: [...follows] }),
          follow: (pubkeys) => follow(pubkeys, true),
          unfollow: (pubkeys) => follow(pubkeys, false),
          react: (eventId, reaction) => publish(7, `${eventId}:${reaction}`),
          report: (target, reason) => publish(1984, `${JSON.stringify(target)}:${reason}`),
        }),
      },
      adapter: { common: { isAvailable: () => true } },
      controls: {
        /** Evidence: the kind and a summary of every event the backend published, oldest first. */
        'common.published': () => [...published],
      },
    };
  },
};
