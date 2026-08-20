import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
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

function registration(windowId: string) {
  return {
    windowId,
    dTag: `${windowId}-d-tag`,
    aggregateHash: `${windowId}-hash`,
    environment: { capabilities: { domains: [] as string[] }, services: [] },
  };
}

async function temporaryBase(): Promise<string> {
  return mkdtemp('/tmp/kehto-ipc-host-');
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

  it('retains a frozen registration clone when the caller mutates its input after launch', async () => {
    const callerRegistration = registration('host-frozen-window');
    const host = await launchIpcShellHost({
      registration: callerRegistration,
      runtimeAdapter: createAdapter(),
      command: { file: process.execPath, args: ['-e', 'setInterval(() => {}, 1_000)'] },
    });
    callerRegistration.windowId = 'caller-mutated-window';
    callerRegistration.environment.capabilities.domains.push('caller-mutated-domain');
    expect(host.registration.windowId).toBe('host-frozen-window');
    expect(host.registration.environment.capabilities.domains).toEqual([]);
    expect(Object.isFrozen(host.registration)).toBe(true);
    expect(Object.isFrozen(host.registration.environment)).toBe(true);
    expect(Object.isFrozen(host.registration.environment.capabilities.domains)).toBe(true);
    await host.close();
  });

  it('scrubs stale KEHTO_IPC values from direct child environment', async () => {
    const base = await temporaryBase();
    const report = join(base, 'environment.json');
    try {
      const script = "require('node:fs').writeFileSync(process.argv[1],JSON.stringify(Object.fromEntries(Object.entries(process.env).filter(([key])=>key.startsWith('KEHTO_IPC_')))))";
      const host = await launchIpcShellHost({
        baseDirectory: base,
        registration: registration('host-environment-window'),
        runtimeAdapter: createAdapter(),
        command: {
          file: process.execPath,
          args: ['-e', script, report],
          env: { KEHTO_IPC_SOCKET_PATH: 'stale-path', KEHTO_IPC_STALE: 'stale-secret' },
        },
      });
      await host.waitForExit();
      const environment = JSON.parse(await readFile(report, 'utf8')) as Record<string, string>;
      expect(Object.keys(environment)).toEqual(['KEHTO_IPC_SOCKET_PATH']);
      expect(environment.KEHTO_IPC_SOCKET_PATH).toBe(host.endpointPath);
      expect(environment.KEHTO_IPC_STALE).toBeUndefined();
      await expect(stat(host.endpointPath)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('restores host signal listener counts after real child cleanup', async () => {
    const before = new Map(['SIGHUP', 'SIGINT', 'SIGTERM'].map((signal) => [signal, process.listenerCount(signal)]));
    const host = await launchIpcShellHost({
      registration: registration('host-listeners-window'),
      runtimeAdapter: createAdapter(),
      command: { file: process.execPath, args: ['-e', 'process.exit(0)'] },
    });
    await host.waitForExit();
    for (const [signal, count] of before) expect(process.listenerCount(signal)).toBe(count);
  });

  it('cleans its endpoint directory when spawn fails', async () => {
    const base = await temporaryBase();
    const before = new Map(['SIGHUP', 'SIGINT', 'SIGTERM'].map((signal) => [signal, process.listenerCount(signal)]));
    try {
      await expect(launchIpcShellHost({
        baseDirectory: base,
        registration: registration('host-spawn-failure-window'),
        runtimeAdapter: createAdapter(),
        command: { file: join(base, 'missing-executable'), args: [] },
      })).rejects.toThrow();
      await expect(readdir(base)).resolves.toEqual([]);
      for (const [signal, count] of before) expect(process.listenerCount(signal)).toBe(count);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });
});
