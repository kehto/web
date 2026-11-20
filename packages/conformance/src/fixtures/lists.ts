import type { DomainFixture } from './types.js';

const MUTED = { itemType: 'pubkey', value: '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d' };

/** NAP-LISTS at napplet/naps#68 (7cf00cdb): supported lists, then add and remove one mute-list item. */
export const LISTS_FIXTURE: DomainFixture = {
  domain: 'lists',
  cases: [
    { id: 'lists/supported', type: 'lists.supported' },
    { id: 'lists/add', type: 'lists.add', payload: { list: { kind: 10000 }, items: [MUTED] } },
    { id: 'lists/remove', type: 'lists.remove', payload: { list: { type: 'mute-list' }, items: [MUTED] } },
  ],
};
