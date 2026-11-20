import type { DomainFixture, SemanticVerdict } from './types.js';

/** NIP-19 example pair (npub, nprofile) from the NIP-19 test vectors. */
const HEX = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';
const NPUB = 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6';
const NPROFILE = 'nprofile1qqsrhuxx8l9ex335q7he0f09aej04zpazpl0ne2cgukyawd24mayt8gpp4mhxue69uhhytnc9e3k7mgpz4mhxue69uhkg6nzv9ejuumpv34kytnrdaksjlyr9p';
const NPROFILE_RELAYS = ['wss://r.x.com', 'wss://djbas.sadkb.com'];
const EVENT_ID = 'b'.repeat(64);

type Reply = Readonly<Record<string, unknown>> | null;

const fields = (reply: Reply, expected: Readonly<Record<string, unknown>>): SemanticVerdict => {
  if (reply?.ok !== true) return `ok was ${JSON.stringify(reply?.ok)}, error ${JSON.stringify(reply?.error)}`;
  for (const [key, value] of Object.entries(expected)) {
    if (JSON.stringify(reply[key]) !== JSON.stringify(value)) return `${key} was ${JSON.stringify(reply[key])}, expected ${JSON.stringify(value)}`;
  }
  return null;
};

/** NAP-COMMON at napplet/naps#67 (8cd0eae8): NIP-19 helpers, profile lookup and the social actions. */
export const COMMON_FIXTURE: DomainFixture = {
  domain: 'common',
  cases: [
    {
      id: 'common/encodeNip19', type: 'common.encodeNip19', payload: { input: { type: 'npub', hex: HEX } },
      semantics: { rule: 'encodeNip19 encodes a public npub per NIP-19 (the NIP-19 example vector)', verify: (reply) => fields(reply, { value: NPUB, nip19Type: 'npub' }) },
    },
    {
      id: 'common/decodeNip19', type: 'common.decodeNip19', payload: { value: NPUB },
      semantics: { rule: 'decodeNip19 normalizes an npub to its hex key', verify: (reply) => fields(reply, { nip19Type: 'npub', hex: HEX }) },
    },
    {
      id: 'common/decodeNip19-nprofile', type: 'common.decodeNip19', payload: { value: NPROFILE },
      semantics: { rule: 'decodeNip19 normalizes an nprofile to a hex pubkey plus its relay TLVs', verify: (reply) => fields(reply, { nip19Type: 'nprofile', pubkey: HEX, relays: NPROFILE_RELAYS }) },
    },
    { id: 'common/getProfile', type: 'common.getProfile', payload: { target: NPUB } },
    { id: 'common/follows', type: 'common.follows' },
    { id: 'common/follow', type: 'common.follow', payload: { pubkeys: [NPUB] } },
    { id: 'common/unfollow', type: 'common.unfollow', payload: { pubkeys: [NPUB] } },
    { id: 'common/react', type: 'common.react', payload: { targetEventId: EVENT_ID, reaction: '+' } },
    { id: 'common/report', type: 'common.report', payload: { target: { type: 'event', id: EVENT_ID, pubkey: HEX }, reason: 'spam', text: '' } },
  ],
};
