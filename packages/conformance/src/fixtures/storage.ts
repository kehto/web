import type { DomainFixture } from './types.js';

const KEY = 'conformance-key';

/** NAP-STORAGE at the pinned draft head: set, get, keys and remove round-trip. */
export const STORAGE_FIXTURE: DomainFixture = {
  domain: 'storage',
  cases: [
    { id: 'storage/set', type: 'storage.set', payload: { key: KEY, value: 'v1' } },
    {
      id: 'storage/get', type: 'storage.get', payload: { key: KEY },
      semantics: { rule: 'storage.get returns the value last stored under the key', verify: (reply) => (reply?.value === 'v1' ? null : `value was ${JSON.stringify(reply?.value)}`) },
    },
    {
      id: 'storage/keys', type: 'storage.keys',
      semantics: { rule: 'storage.keys lists every stored key', verify: (reply) => (Array.isArray(reply?.keys) && reply.keys.includes(KEY) ? null : `keys was ${JSON.stringify(reply?.keys)}`) },
    },
    { id: 'storage/remove', type: 'storage.remove', payload: { key: KEY } },
    {
      id: 'storage/get-removed', type: 'storage.get', payload: { key: KEY },
      semantics: { rule: 'storage.get returns null for a removed key', verify: (reply) => (reply?.value === null ? null : `value was ${JSON.stringify(reply?.value)}`) },
    },
  ],
};
