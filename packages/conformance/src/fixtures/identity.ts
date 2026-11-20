import type { DomainFixture, OperationCase } from './types.js';

const HEX_PUBKEY = /^[0-9a-f]{64}$/;

const list = (id: string, type: string, field: string, payload?: Record<string, unknown>): OperationCase => ({
  id, type, ...(payload ? { payload } : {}),
  semantics: { rule: `${type}.result carries a ${field} list`, verify: (reply) => (Array.isArray(reply?.[field]) ? null : `${field} was ${JSON.stringify(reply?.[field])}`) },
});

/** NAP-IDENTITY at napplet/naps master: every read, and identity.changed on sign-out. */
export const IDENTITY_FIXTURE: DomainFixture = {
  domain: 'identity',
  cases: [
    {
      id: 'identity/getPublicKey', type: 'identity.getPublicKey',
      semantics: { rule: 'getPublicKey returns the connected user\'s hex pubkey', verify: (reply) => (typeof reply?.pubkey === 'string' && HEX_PUBKEY.test(reply.pubkey) ? null : `pubkey was ${JSON.stringify(reply?.pubkey)}`) },
    },
    {
      id: 'identity/getRelays', type: 'identity.getRelays',
      semantics: { rule: 'getRelays returns a relay map', verify: (reply) => (reply?.relays && typeof reply.relays === 'object' && !Array.isArray(reply.relays) ? null : `relays was ${JSON.stringify(reply?.relays)}`) },
    },
    {
      id: 'identity/getProfile', type: 'identity.getProfile',
      semantics: { rule: 'getProfile returns a profile object or null', verify: (reply) => (reply && 'profile' in reply && (reply.profile === null || typeof reply.profile === 'object') ? null : `profile was ${JSON.stringify(reply?.profile)}`) },
    },
    list('identity/getFollows', 'identity.getFollows', 'pubkeys'),
    list('identity/getList', 'identity.getList', 'entries', { listType: 'bookmarks' }),
    list('identity/getZaps', 'identity.getZaps', 'zaps'),
    list('identity/getMutes', 'identity.getMutes', 'pubkeys'),
    list('identity/getBlocked', 'identity.getBlocked', 'pubkeys'),
    list('identity/getBadges', 'identity.getBadges', 'badges'),
  ],
  pushes: [
    {
      id: 'identity/changed-sign-out', type: 'identity.changed', trigger: { control: 'identity.signOut' },
      then: [{ id: 'identity/getPublicKey-signed-out', type: 'identity.getPublicKey' }],
      semantics: {
        rule: 'identity.changed is emitted on sign-out, and getPublicKey then returns "" rather than an error',
        verify(push, replies) {
          if (push?.pubkey !== '') return `identity.changed pubkey was ${JSON.stringify(push?.pubkey)}, expected ""`;
          const after = replies['identity/getPublicKey-signed-out'];
          if (after?.error !== undefined) return `getPublicKey while disconnected returned error ${JSON.stringify(after.error)}`;
          return after?.pubkey === '' ? null : `getPublicKey while disconnected returned ${JSON.stringify(after?.pubkey)}`;
        },
      },
    },
    {
      // Restores the signed-in user for every later domain, and proves the change back.
      id: 'identity/changed-sign-in', type: 'identity.changed', trigger: { control: 'identity.signIn' },
      semantics: {
        rule: 'identity.changed is emitted on sign-in with the connected user\'s hex pubkey',
        verify: (push) => (typeof push?.pubkey === 'string' && HEX_PUBKEY.test(push.pubkey) ? null : `identity.changed pubkey was ${JSON.stringify(push?.pubkey)}`),
      },
    },
  ],
};
