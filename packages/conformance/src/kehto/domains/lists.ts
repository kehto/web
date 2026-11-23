import { createListsService } from '@kehto/services';
import type { ListItemType, ListMutationResult, ListSupport } from '@napplet/core';
import type { DomainBackendModule } from './types.js';

/** Relay origin the LISTS plan names. Planning only: nothing connects to it. */
const LISTS_RELAY = 'wss://relay.conformance.invalid/';

interface ListRefLike { readonly kind?: number; readonly type?: string; readonly identifier?: string }
interface ListItemLike { readonly itemType: ListItemType; readonly value: string }

/** The one list this backend supports: the NIP-51 mute list. */
const MUTE_LIST: ListSupport = { kind: 10000, type: 'mute-list', addressable: false, supportedItemTypes: ['pubkey', 'hashtag', 'word', 'event'], privateItems: false };

const listKey = (list: ListRefLike): string => `${list.kind ?? list.type ?? ''}:${list.identifier ?? ''}`;
const isMuteList = (list: ListRefLike): boolean => list.kind === MUTE_LIST.kind || list.type === MUTE_LIST.type;

/** NAP-LISTS backend: the reference lists service over an in-memory mute list. */
export const LISTS_BACKEND: DomainBackendModule = {
  domain: 'lists',
  create() {
    const items: string[] = [];
    let sequence = 0;
    const mutate = (list: ListRefLike, changes: readonly ListItemLike[], add: boolean): ListMutationResult => {
      if (!isMuteList(list)) return { ok: false, error: 'unsupported-list', reason: 'only the mute list is supported', supported: [structuredClone(MUTE_LIST)] };
      if (changes.some((item) => !MUTE_LIST.supportedItemTypes?.includes(item.itemType))) return { ok: false, error: 'unsupported-item' };
      let changed = 0;
      for (const key of changes.map((item) => `${item.itemType}:${item.value}`)) {
        const index = items.indexOf(key);
        if (add && index < 0) { items.push(key); changed += 1; }
        if (!add && index >= 0) { items.splice(index, 1); changed += 1; }
      }
      sequence += 1;
      const eventId = sequence.toString(16).padStart(64, '0');
      return add ? { ok: true, eventId, added: changed, skipped: changes.length - changed } : { ok: true, eventId, removed: changed, skipped: changes.length - changed };
    };
    return {
      services: {
        lists: createListsService({
          planMutation: (list) => ({ relays: [LISTS_RELAY], resource: listKey(list) }),
          supported: () => [structuredClone(MUTE_LIST)],
          add: (list, changes) => mutate(list, changes, true),
          remove: (list, changes) => mutate(list, changes, false),
        }),
      },
      adapter: { lists: { isAvailable: () => true } },
      controls: {
        /** Evidence: the mute list's current items as `<itemType>:<value>`, in list order. */
        'lists.items': () => [...items],
      },
    };
  },
};
