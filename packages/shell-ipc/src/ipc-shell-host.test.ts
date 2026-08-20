import { stat } from 'node:fs/promises';
import type { RuntimeAdapter } from '@kehto/runtime';
import { describe, expect, it } from 'vitest';
import { launchIpcShellHost } from './index.js';

function createAdapter(): Omit<RuntimeAdapter, 'sendToNapplet'> {
  return {
    auth: { getUserPubkey: () => null, getSigner: () => null },
    config: { getNappUpdateBehavior: () => 'auto-grant' },
    hotkeys: { executeHotkeyFromForward() {} },
    crypto: { verifyEvent: async () => true, randomUUID: () => 'host-test', randomBytes: (length) => new Uint8Array(length) },
    aclPersistence: { persist() {}, load: () => null },
    manifestPersistence: { persist() {}, load: () => null },
    statePersistence: { get: () => null, set: () => true, remove() {}, clear() {}, keys: () => [], calculateBytes: () => 0 },
    windowManager: { createWindow: () => null },
    relayConfig: { addRelay() {}, removeRelay() {}, getRelayConfig: () => ({ discovery: [], super: [], outbox: [] }), getNip66Suggestions: () => [] },
    services: {},
  };
}

describe('launchIpcShellHost', () => {
  it('is exported as the production process-host entry point', () => {
    expect(launchIpcShellHost).toBeTypeOf('function');
  });

  it('owns a raw executable exit and cleans its private endpoint resources', async () => {
    const host = await launchIpcShellHost({
        registration: {
          windowId: 'host-test-window', dTag: 'host-test', aggregateHash: 'host-test-hash',
          environment: { capabilities: { domains: [] }, services: [] },
        },
        runtimeAdapter: createAdapter(),
        command: { file: process.execPath, args: ['-e', 'process.exit(23)'] },
    });
    await expect(host.waitForExit()).resolves.toEqual({
      status: 23, code: 23, signal: null, reason: 'numeric-exit',
    });
    await expect(stat(host.endpointPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
