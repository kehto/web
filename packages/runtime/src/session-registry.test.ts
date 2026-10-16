import { describe, expect, it } from 'vitest';
import { createSessionRegistry } from './index.js';
import type { SessionEntry } from './index.js';

const pubkeys = ['', '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'];

function makeEntry(pubkey: string, windowId = 'example-window'): SessionEntry {
  return {
    pubkey,
    windowId,
    origin: 'null',
    type: 'nip5d',
    dTag: 'example-app',
    aggregateHash: 'a'.repeat(64),
    registeredAt: 1800000000000,
    instanceId: 'example-instance',
    provenance: 'nip-5d',
  };
}

describe('SessionRegistry.unregister', () => {
  it.each(pubkeys)('retires every public lookup for pubkey %j', (pubkey) => {
    const registry = createSessionRegistry();
    const entry = makeEntry(pubkey);
    registry.register(entry.windowId, entry);
    expect(registry.isRegistered(entry.windowId)).toBe(true);
    expect(registry.getEntry(pubkey)).toEqual(entry);

    registry.unregister(entry.windowId);
    registry.unregister(entry.windowId);

    expect(registry.isRegistered(entry.windowId)).toBe(false);
    expect(registry.getPubkey(entry.windowId)).toBeUndefined();
    expect(registry.getEntry(pubkey)).toBeUndefined();
    expect(registry.getWindowId(pubkey)).toBeUndefined();
    expect(registry.getEntryByWindowId(entry.windowId)).toBeUndefined();
    expect(registry.getInstanceId(entry.windowId)).toBeUndefined();
    expect(registry.getWindowIdByDTag(entry.dTag)).toBeUndefined();
    expect(registry.getAllEntries()).toEqual([]);

    registry.register(entry.windowId, entry);
    expect(registry.isRegistered(entry.windowId)).toBe(true);
    expect(registry.getEntryByWindowId(entry.windowId)).toEqual(entry);
    registry.unregister(entry.windowId);
    expect(registry.isRegistered(entry.windowId)).toBe(false);
  });

  it.each(pubkeys)('preserves a newer window sharing pubkey %j', (pubkey) => {
    const registry = createSessionRegistry();
    const retired = makeEntry(pubkey, 'retired');
    const live = makeEntry(pubkey, 'live');
    registry.register(retired.windowId, retired);
    registry.register(live.windowId, live);

    registry.unregister(retired.windowId);
    registry.unregister('unknown');
    registry.unregister(retired.windowId);

    expect(registry.isRegistered(retired.windowId)).toBe(false);
    expect(registry.getPubkey(retired.windowId)).toBeUndefined();
    expect(registry.getEntryByWindowId(retired.windowId)).toBeUndefined();
    expect(registry.isRegistered(live.windowId)).toBe(true);
    expect(registry.getPubkey(live.windowId)).toBe(pubkey);
    expect(registry.getEntry(pubkey)).toEqual(live);
    expect(registry.getWindowId(pubkey)).toBe(live.windowId);
    expect(registry.getAllEntries()).toEqual([live]);

    registry.unregister(live.windowId);
    expect(registry.getEntry(pubkey)).toBeUndefined();
    expect(registry.getAllEntries()).toEqual([]);
  });
});
