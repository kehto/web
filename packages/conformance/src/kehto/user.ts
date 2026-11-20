/**
 * kehto/user.ts — The fixture user and its signer. The key has no value.
 */
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import * as nip04 from 'nostr-tools/nip04';
import * as nip44 from 'nostr-tools/nip44';
import type { EventTemplate, NostrEvent } from 'nostr-tools';

const USER_SECRET = Uint8Array.from({ length: 32 }, (_, index) => (index === 31 ? 0x07 : 0x42));
const PEER_SECRET = Uint8Array.from({ length: 32 }, (_, index) => (index === 31 ? 0x08 : 0x43));

/** Hex public key of the fixture user. */
export const FIXTURE_USER_PUBKEY = getPublicKey(USER_SECRET);
/** Hex public key of a second fixture identity (follows, DM peers). */
export const FIXTURE_PEER_PUBKEY = getPublicKey(PEER_SECRET);
/** Relay map the fixture signer reports. */
export const FIXTURE_RELAYS: Readonly<Record<string, { read: boolean; write: boolean }>> = Object.freeze({ 'wss://relay.conformance.invalid': { read: true, write: true } });

/** A NIP-07-style cipher pair keyed by the peer's hex pubkey. */
export interface FixtureCipher {
  encrypt(pubkey: string, plaintext: string): Promise<string>;
  decrypt(pubkey: string, ciphertext: string): Promise<string>;
}

/** The signed-in state and one stable signer object. */
export interface FixtureUser {
  signedIn: boolean;
  readonly signer: {
    getPublicKey(): Promise<string>;
    getRelays(): Promise<Record<string, { read: boolean; write: boolean }>>;
    signEvent(event: EventTemplate | NostrEvent): Promise<NostrEvent>;
    /** Real NIP-44 v2 so `relay.publishEncrypted` can prove ciphertext. */
    readonly nip44: FixtureCipher;
    /** Real NIP-04, for `encryption: "nip04"`. */
    readonly nip04: FixtureCipher;
  };
  /** The signer while signed in, otherwise `null`. */
  current(): FixtureUser['signer'] | null;
  /** The pubkey while signed in, otherwise `null`. */
  pubkey(): string | null;
}

/**
 * Create the fixture user, signed in.
 *
 * @returns A user whose signer object never changes identity.
 */
export function createFixtureUser(): FixtureUser {
  const signer = {
    getPublicKey: async () => FIXTURE_USER_PUBKEY,
    getRelays: async () => ({ ...FIXTURE_RELAYS }),
    signEvent: async (event: EventTemplate | NostrEvent) => finalizeEvent({ kind: event.kind, created_at: event.created_at, tags: event.tags, content: event.content }, USER_SECRET),
    nip44: {
      encrypt: async (pubkey: string, plaintext: string) => nip44.encrypt(plaintext, nip44.getConversationKey(USER_SECRET, pubkey)),
      decrypt: async (pubkey: string, ciphertext: string) => nip44.decrypt(ciphertext, nip44.getConversationKey(USER_SECRET, pubkey)),
    },
    nip04: {
      encrypt: async (pubkey: string, plaintext: string) => nip04.encrypt(USER_SECRET, pubkey, plaintext),
      decrypt: async (pubkey: string, ciphertext: string) => nip04.decrypt(USER_SECRET, pubkey, ciphertext),
    },
  };
  const user: FixtureUser = {
    signedIn: true,
    signer,
    current: () => (user.signedIn ? signer : null),
    pubkey: () => (user.signedIn ? FIXTURE_USER_PUBKEY : null),
  };
  return user;
}
