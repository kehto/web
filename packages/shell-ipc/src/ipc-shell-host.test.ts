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

  it('returns one deferred terminal promise for concurrent close and wait calls', async () => {
    const host = await launchIpcShellHost({
      shutdownGraceMs: 100,
      registration: {
        windowId: 'host-close-window', dTag: 'host-close', aggregateHash: 'host-close-hash',
        environment: { capabilities: { domains: [] }, services: [] },
      },
      runtimeAdapter: createAdapter(),
      command: { file: process.execPath, args: ['-e', "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"] },
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const close1 = host.close();
    const close2 = host.close();
    const wait1 = host.waitForExit();
    const wait2 = host.waitForExit();
    expect(close1).toBe(close2);
    expect(close1).toBe(wait1);
    expect(wait1).toBe(wait2);
    let settled = false;
    void close1.then(() => { settled = true; });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(settled).toBe(false);
    await expect(close1).resolves.toMatchObject({ status: 137, signal: 'SIGKILL', reason: 'shutdown-timeout' });
  });

  it.each([
    ['SIGHUP', 129], ['SIGINT', 130], ['SIGTERM', 143],
  ] as const)('retains independent child %s termination', async (signal, status) => {
    const host = await launchIpcShellHost({
      registration: {
        windowId: `host-signal-${signal}`, dTag: 'host-signal', aggregateHash: 'host-signal-hash',
        environment: { capabilities: { domains: [] }, services: [] },
      },
      runtimeAdapter: createAdapter(),
      command: { file: process.execPath, args: ['-e', `process.kill(process.pid, '${signal}')`] },
    });
    await expect(host.waitForExit()).resolves.toMatchObject({ status, signal, reason: 'independent-child-signal' });
  });

  it('escalates a current ready peer disconnect that remains alive', async () => {
    const script = [
      "const net=require('node:net')",
      "const socket=net.connect(process.env.KEHTO_IPC_SOCKET_PATH)",
      "socket.once('connect',()=>socket.write(Buffer.from('\\x1e{\\\"type\\\":\\\"shell.ready\\\"}\\n')))",
      "socket.once('data',()=>{process.on('SIGTERM',()=>{});socket.end();setInterval(()=>{},1000)})",
    ].join(';');
    const host = await launchIpcShellHost({
      shutdownGraceMs: 25,
      registration: {
        windowId: 'host-peer-window', dTag: 'host-peer', aggregateHash: 'host-peer-hash',
        environment: { capabilities: { domains: [] }, services: [] },
      },
      runtimeAdapter: createAdapter(),
      command: { file: process.execPath, args: ['-e', script] },
    });
    await expect(host.waitForExit()).resolves.toMatchObject({ status: 137, signal: 'SIGKILL', reason: 'peer-disconnected' });
  });
});
