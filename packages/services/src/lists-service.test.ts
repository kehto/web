import { describe, expect, it, vi } from 'vitest';
import type { ListItem, ListRef, ListSupport, NappletMessage } from '@napplet/core';

import { createListsService, type ListsServiceOptions } from './lists-service.js';

const WINDOW_ID = 'win-lists';
const LIST: ListRef = { type: 'bookmarks' };
const ITEM: ListItem = { itemType: 'event', value: 'e'.repeat(64), relay: 'wss://relay.example' };
const SUPPORT: ListSupport = {
  kind: 10003,
  type: 'bookmarks',
  addressable: false,
  supportedItemTypes: ['event'],
};

function collectSent(): { sent: NappletMessage[]; send: (msg: NappletMessage) => void } {
  const sent: NappletMessage[] = [];
  return {
    sent,
    send: (msg) => { sent.push(msg); },
  };
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('createListsService', () => {
  it('returns a lists service descriptor', () => {
    const service = createListsService();
    expect(service.descriptor.name).toBe('lists');
    expect(service.descriptor.version).toBe('1.0.0');
  });

  it('returns an empty supported list when no supported hook is configured', () => {
    const service = createListsService();
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'lists.supported', id: 'sup-1' } as NappletMessage, send);

    expect(sent).toEqual([{ type: 'lists.supported.result', id: 'sup-1', lists: [] }]);
  });

  it('delegates supported metadata with caller context', async () => {
    const supported = vi.fn<NonNullable<ListsServiceOptions['supported']>>(() => [SUPPORT]);
    const service = createListsService({ supported });
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'lists.supported', id: 'sup-2' } as NappletMessage, send);
    await flush();

    expect(supported).toHaveBeenCalledWith({ windowId: WINDOW_ID });
    expect(sent).toEqual([{ type: 'lists.supported.result', id: 'sup-2', lists: [SUPPORT] }]);
  });

  it('delegates add and remove mutations with list, items, options, and caller context', async () => {
    const options: ListsServiceOptions = {
      add: vi.fn(() => ({ ok: true, eventId: 'add-event', added: 1 })),
      remove: vi.fn(() => ({ ok: true, eventId: 'remove-event', removed: 1 })),
    };
    const service = createListsService(options);
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'lists.add', id: 'add-1', list: LIST, items: [ITEM], options: { create: true } } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, { type: 'lists.remove', id: 'remove-1', list: LIST, items: [ITEM] } as NappletMessage, send);
    await flush();

    expect(options.add).toHaveBeenCalledWith(LIST, [ITEM], { create: true }, { windowId: WINDOW_ID });
    expect(options.remove).toHaveBeenCalledWith(LIST, [ITEM], undefined, { windowId: WINDOW_ID });
    expect(sent).toEqual([
      { type: 'lists.add.result', id: 'add-1', ok: true, eventId: 'add-event', added: 1 },
      { type: 'lists.remove.result', id: 'remove-1', ok: true, eventId: 'remove-event', removed: 1 },
    ]);
  });

  it('returns structured unsupported results for unavailable mutation hooks', () => {
    const service = createListsService();
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'lists.add', id: 'add-2', list: LIST, items: [ITEM] } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, { type: 'lists.remove', id: 'remove-2', list: LIST, items: [ITEM] } as NappletMessage, send);

    expect(sent).toEqual([
      { type: 'lists.add.result', id: 'add-2', ok: false, error: 'unsupported', reason: 'lists.add unavailable', supported: [] },
      { type: 'lists.remove.result', id: 'remove-2', ok: false, error: 'unsupported', reason: 'lists.remove unavailable', supported: [] },
    ]);
  });

  it('contains host exceptions as shaped ok:false mutation results', async () => {
    const service = createListsService({ add: () => { throw new Error('publish offline'); } });
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'lists.add', id: 'add-3', list: LIST, items: [ITEM] } as NappletMessage, send);
    await flush();

    expect(sent).toEqual([{ type: 'lists.add.result', id: 'add-3', ok: false, error: 'list-unavailable', reason: 'publish offline' }]);
  });

  it('contains unknown lists actions', () => {
    const service = createListsService();
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'lists.unknown', id: 'u1' } as NappletMessage, send);

    expect(sent).toEqual([{ type: 'lists.unknown.error', id: 'u1', error: 'Unknown lists method: lists.unknown' }]);
  });
});
