import { mkdtemp, rm } from 'node:fs/promises';
import { connect, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import type { RuntimeAdapter } from '@kehto/runtime';
import { createIpcShellProjection } from './index.js';
import { encodeJsonSequence } from './json-sequence.js';
import type { IpcDiagnostic, IpcShellEndpointRegistration } from './types.js';

function connectPeer(path: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = connect(path);
    socket.once('connect', () => resolve(socket));
    socket.once('error', reject);
  });
}

function waitForClose(socket: Socket): Promise<void> {
  return new Promise((resolve) => socket.once('close', resolve));
}

function collectFrames(socket: Socket): unknown[] {
  let buffered = Buffer.alloc(0);
  const frames: unknown[] = [];
  socket.on('data', (chunk: Buffer) => {
    buffered = Buffer.concat([buffered, chunk]);
    while (true) {
      const end = buffered.indexOf(0x0a);
      if (end === -1) return;
      frames.push(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffered.subarray(1, end))));
      buffered = buffered.subarray(end + 1);
    }
  });
  return frames;
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('Timed out waiting for runtime-shell condition.');
}

function createAdapter(hotkeys: string[], aclChecks: string[]): RuntimeAdapter {
  return {
    sendToNapplet() {},
    auth: { getUserPubkey: () => null, getSigner: () => null },
    config: { getNappUpdateBehavior: () => 'auto-grant' },
    hotkeys: { executeHotkeyFromForward: (event) => hotkeys.push(event.code) },
    crypto: {
      verifyEvent: async () => true,
      randomUUID: () => 'host-generated-instance-id',
      randomBytes: (length) => new Uint8Array(length),
    },
    aclPersistence: { persist() {}, load: () => null },
    manifestPersistence: { persist() {}, load: () => null },
    statePersistence: {
      get: () => null,
      set: () => true,
      remove() {},
      clear() {},
      keys: () => [],
      calculateBytes: () => 0,
    },
    windowManager: { createWindow: () => null },
    relayConfig: {
      addRelay() {},
      removeRelay() {},
      getRelayConfig: () => ({ discovery: [], super: [], outbox: [] }),
      getNip66Suggestions: () => [],
    },
    onAclCheck: (event) => aclChecks.push(event.capability),
  };
}

const registration: IpcShellEndpointRegistration = {
  windowId: 'ipc-window',
  dTag: 'ipc-napplet',
  aggregateHash: 'hash-123',
  environment: {
    capabilities: { domains: ['keys'] },
    services: [],
  },
};

describe('createIpcShellProjection', () => {
  it('binds one raw peer through exact readiness and public runtime dispatch', async () => {
    const baseDirectory = await mkdtemp(`${tmpdir()}/kehto-ipc-runtime-shell-`);
    const diagnostics: IpcDiagnostic[] = [];
    const hotkeys: string[] = [];
    const aclChecks: string[] = [];
    const projection = await createIpcShellProjection({
      baseDirectory,
      registration,
      runtimeAdapter: createAdapter(hotkeys, aclChecks),
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });
    const peer = await connectPeer(projection.path);
    const peerFrames = collectFrames(peer);
    let secondPeer: Socket | undefined;

    try {
      peer.write(encodeJsonSequence({ type: 'shell.ready', payload: 'not-bare' }));
      await waitFor(() => diagnostics.length === 1);
      expect(diagnostics).toEqual([{
        code: 'SHELL_READY_PAYLOAD_IGNORED',
        registration: { windowId: 'ipc-window', dTag: 'ipc-napplet', aggregateHash: 'hash-123' },
      }]);
      expect(projection.runtime.sessionRegistry.getEntryByWindowId(registration.windowId)).toBeUndefined();
      expect(peerFrames).toEqual([]);

      peer.write(encodeJsonSequence({ type: 'keys.forward', key: 'x', code: 'KeyX' }));
      await new Promise((resolve) => setTimeout(resolve, 15));
      expect(hotkeys).toEqual([]);
      expect(aclChecks).toEqual([]);
      expect(peerFrames).toEqual([]);

      peer.write(encodeJsonSequence({ type: 'shell.ready' }));
      await waitFor(() => peerFrames.length === 1);
      expect(peerFrames).toEqual([{
        type: 'shell.init',
        capabilities: { domains: ['keys'] },
        services: [],
      }]);
      const session = projection.runtime.sessionRegistry.getEntryByWindowId(registration.windowId);
      expect(session).toMatchObject({
        pubkey: '',
        windowId: registration.windowId,
        dTag: registration.dTag,
        aggregateHash: registration.aggregateHash,
        origin: 'ipc',
        type: 'nip5d',
        provenance: 'nip-5d',
        instanceId: 'host-generated-instance-id',
      });

      peer.write(encodeJsonSequence({ type: 'shell.ready' }));
      await new Promise((resolve) => setTimeout(resolve, 15));
      expect(peerFrames).toHaveLength(1);
      expect(projection.runtime.sessionRegistry.getEntryByWindowId(registration.windowId)).toBe(session);

      secondPeer = await connectPeer(projection.path);
      const secondFrames = collectFrames(secondPeer);
      const secondClosed = waitForClose(secondPeer);
      await secondClosed;
      expect(secondFrames).toEqual([]);

      peer.write(encodeJsonSequence({ type: 'keys.forward', key: 'y', code: 'KeyY' }));
      await waitFor(() => hotkeys.length === 1);
      expect(hotkeys).toEqual(['KeyY']);
      expect(aclChecks).toEqual(['hotkey:forward']);
    } finally {
      peer.destroy();
      secondPeer?.destroy();
      await projection.close();
      await rm(baseDirectory, { recursive: true, force: true });
    }
  });

  it('keeps peer-provided endpoint identity terminal under the projection binding guard', async () => {
    const baseDirectory = await mkdtemp(`${tmpdir()}/kehto-ipc-runtime-shell-identity-`);
    const projection = await createIpcShellProjection({
      baseDirectory,
      registration,
      runtimeAdapter: createAdapter([], []),
    });
    const peer = await connectPeer(projection.path);

    try {
      const closed = waitForClose(peer);
      peer.write(encodeJsonSequence({ type: 'shell.ready', windowId: 'peer-controlled' }));
      await closed;
      expect(projection.runtime.sessionRegistry.getEntryByWindowId(registration.windowId)).toBeUndefined();
    } finally {
      peer.destroy();
      await projection.close();
      await rm(baseDirectory, { recursive: true, force: true });
    }
  });
});
