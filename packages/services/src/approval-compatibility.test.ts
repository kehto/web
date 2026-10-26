import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import type { ServiceRuntimeContext } from '@kehto/runtime';
import { createBleService } from './ble-service.js';
import { createSerialService } from './serial-service.js';
import { createFsService } from './fs-service.js';
import { createDmService } from './dm-service.js';
import { createCommonService } from './common-service.js';
import { createListsService } from './lists-service.js';

const cases = [
  {
    domain: 'BLE',
    diagnostic: '[FW-BLE-LEGACY-001] Configure RuntimeAdapter.permissions and host-private selected-device approval; unbound BLE hooks are deprecated. Warning once per service instance.',
    create: () => {
      const hook = vi.fn(() => ({ session: { id: 'ble-1', state: 'open' as const, device: { id: 'device' } } }));
      return { service: createBleService({ open: hook }), hook };
    },
    message: { type: 'ble.open', request: { acceptAllDevices: true } },
  },
  {
    domain: 'SERIAL',
    diagnostic: '[FW-SERIAL-LEGACY-001] Configure RuntimeAdapter.permissions and host-private selected-device approval; unbound serial hooks are deprecated. Warning once per service instance.',
    create: () => {
      const hook = vi.fn(() => ({ session: { id: 'serial-1', state: 'open' as const, info: {} } }));
      return { service: createSerialService({ open: hook }), hook };
    },
    message: { type: 'serial.open', request: { options: { baudRate: 9600 } } },
  },
  {
    domain: 'FS',
    diagnostic: '[FW-FS-LEGACY-001] Configure RuntimeAdapter.permissions and verified session permissionPrincipal; host-only filesystem authorization is deprecated. Warning once per service instance.',
    create: () => {
      const hook = vi.fn(() => ({ roots: [], limits: { maxReadBytes: 8, maxWriteBytes: 8 } }));
      const service = createFsService({ backend: {
        info: hook, pickFile: () => ({ entries: [] }), pickFiles: () => ({ entries: [] }),
        pickDirectory: () => ({ entries: [] }), pickSaveFile: () => ({ entries: [] }),
        stat: (_windowId, path) => ({ path, kind: 'file' }), list: () => [],
        read: () => ({ data: '', offset: 0, bytesRead: 0, eof: true }), write: () => ({ bytesWritten: 0 }),
        mkdir() {}, remove() {}, move() {}, watch: () => ({ close() {} }),
      } });
      return { service, hook };
    },
    message: { type: 'fs.info' },
  },
  {
    domain: 'DM',
    diagnostic: '[FW-DM-LEGACY-001] Configure an approval-aware DM adapter with immutable relay planning; legacy adapter execution is deprecated. Warning once per service instance.',
    create: () => {
      const hook = vi.fn(() => ({ conversations: [] }));
      return { service: createDmService({ adapter: {
        status: () => ({ available: true, implementations: ['test'], capabilities: ['history'] }),
        conversations: hook, messages: () => ({ messages: [] }), send: async () => { throw new Error('unused send'); },
        subscribe: () => ({ subscriptionId: 'unused' }), unsubscribe: () => ({ ok: true }),
        planRelays: () => ['wss://approved.test'],
      } }), hook };
    },
    message: { type: 'dm.conversations' },
  },
  {
    domain: 'COMMON',
    diagnostic: '[FW-COMMON-LEGACY-001] Configure immutable COMMON relay planning for approval-aware social operations. Warning once per service instance.',
    create: () => {
      const hook = vi.fn(() => ({ ok: true, pubkey: 'a'.repeat(64), profile: { name: 'alice' } }));
      return { service: createCommonService({ getProfile: hook, planRelays: () => ['wss://approved.test'] }), hook };
    },
    message: { type: 'common.getProfile', target: 'a'.repeat(64) },
  },
  {
    domain: 'LISTS',
    diagnostic: '[FW-LISTS-LEGACY-001] Configure immutable LISTS mutation planning for approval-aware list changes. Warning once per service instance.',
    create: () => {
      const hook = vi.fn(() => ({ ok: true, eventId: 'a'.repeat(64), added: 1 }));
      return { service: createListsService({ add: hook, planMutation: () => ({ relays: ['wss://approved.test'], resource: 'list:bookmarks' }) }), hook };
    },
    message: { type: 'lists.add', list: { type: 'bookmarks' }, items: [{ itemType: 'event', value: 'a'.repeat(64) }] },
  },
];

function request(message: { type: string }, id: string): NappletMessage {
  const envelope = { ...message, id };
  return envelope as NappletMessage;
}

describe('approval compatibility diagnostics', () => {
  it.each(cases)('$domain warns once per service, preserves legacy behavior, and stays silent on the enforced path', async ({ create, message, diagnostic }) => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const legacy = create();
      const send = vi.fn();
      for (const id of ['one', 'two']) legacy.service.handleMessage(id, request(message, id), send);
      await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
      expect(legacy.hook).toHaveBeenCalledTimes(2);
      expect(send.mock.calls.every(([reply]) => !('error' in reply))).toBe(true);
      expect(warning).toHaveBeenCalledExactlyOnceWith(diagnostic);

      const next = create();
      next.service.handleMessage('three', request(message, 'three'), send);
      await vi.waitFor(() => expect(next.hook).toHaveBeenCalledTimes(1));
      expect(warning).toHaveBeenCalledTimes(2);

      const enforced = create();
      const authorizeOperation = vi.fn(async () => ({ status: 'denied' as const }));
      enforced.service.onRegistered?.({ authorizeOperation } as unknown as ServiceRuntimeContext);
      const deniedSend = vi.fn();
      enforced.service.handleMessage('four', request(message, 'four'), deniedSend);
      await vi.waitFor(() => expect(deniedSend).toHaveBeenCalledTimes(1));
      expect(authorizeOperation).toHaveBeenCalledTimes(1);
      expect(enforced.hook).not.toHaveBeenCalled();
      expect(warning).toHaveBeenCalledTimes(2);
    } finally { warning.mockRestore(); }
  });
});
