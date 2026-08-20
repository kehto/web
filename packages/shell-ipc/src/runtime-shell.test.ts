import { access, mkdtemp, readdir, rm } from 'node:fs/promises';
import { connect, type Socket } from 'node:net';
import { describe, expect, it, vi } from 'vitest';
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
  it('composes dedicated endpoints through one runtime and retires only the closed endpoint', async () => {
    const baseDirectory = await mkdtemp('/tmp/k-ipc-runtime-shell-composition-');
    const composition = await createIpcShellProjection({
      baseDirectory,
      runtimeAdapter: createAdapter([], []),
    });
    const endpointA = await composition.registerEndpoint({
      windowId: 'ipc-composition-a',
      dTag: 'ipc-composition-a',
      aggregateHash: 'composition-a',
      environment: { capabilities: { domains: ['inc'] }, services: [] },
    });
    const endpointB = await composition.registerEndpoint({
      windowId: 'ipc-composition-b',
      dTag: 'ipc-composition-b',
      aggregateHash: 'composition-b',
      environment: { capabilities: { domains: ['inc'] }, services: [] },
    });
    const peerA = await connectPeer(endpointA.path);
    const peerB = await connectPeer(endpointB.path);
    const framesA = collectFrames(peerA);
    const framesB = collectFrames(peerB);
    const destroyWindow = vi.spyOn(composition.runtime, 'destroyWindow');
    const unregister = vi.spyOn(composition.runtime.sessionRegistry, 'unregister');
    const destroy = vi.spyOn(composition.runtime, 'destroy');

    try {
      peerA.write(encodeJsonSequence({ type: 'shell.ready' }));
      peerB.write(encodeJsonSequence({ type: 'shell.ready' }));
      await waitFor(() => framesA.length === 1 && framesB.length === 1);
      expect(composition.runtime.sessionRegistry.getEntryByWindowId('ipc-composition-a')).toBeDefined();
      const sessionB = composition.runtime.sessionRegistry.getEntryByWindowId('ipc-composition-b');
      expect(sessionB).toBeDefined();

      peerA.write(encodeJsonSequence({ type: 'inc.channel.open', id: 'open-a-b', target: 'ipc-composition-b' }));
      await waitFor(() => framesA.some((frame) => (frame as { type?: string }).type === 'inc.channel.open.result')
        && framesB.some((frame) => (frame as { type?: string }).type === 'inc.channel.opened'));
      const opened = framesB.find((frame) => (frame as { type?: string }).type === 'inc.channel.opened') as { channelId: string; peer: string };
      expect(opened).toMatchObject({ peer: 'ipc-composition-a' });
      const result = framesA.find((frame) => (frame as { type?: string }).type === 'inc.channel.open.result') as { channelId: string; peer: string };
      expect(result).toMatchObject({ channelId: opened.channelId, peer: 'ipc-composition-b' });

      await endpointA.close();
      await waitFor(() => framesB.some((frame) => (frame as { type?: string }).type === 'inc.channel.closed'));
      expect(framesB.filter((frame) => (frame as { type?: string }).type === 'inc.channel.closed')).toEqual([
        { type: 'inc.channel.closed', channelId: opened.channelId, reason: 'peer destroyed' },
      ]);
      expect(destroyWindow).toHaveBeenCalledWith('ipc-composition-a');
      expect(unregister).toHaveBeenCalledWith('ipc-composition-a');
      expect(destroyWindow.mock.invocationCallOrder[0]).toBeLessThan(unregister.mock.invocationCallOrder[0]);
      expect(composition.runtime.sessionRegistry.getEntryByWindowId('ipc-composition-b')).toBe(sessionB);
      await expect(access(endpointA.path)).rejects.toThrow();
      await expect(access(endpointB.path)).resolves.toBeUndefined();

      peerB.write(encodeJsonSequence({ type: 'inc.channel.list', id: 'list-after-a-close' }));
      await waitFor(() => framesB.some((frame) => (frame as { type?: string; id?: string }).type === 'inc.channel.list.result'
        && (frame as { id?: string }).id === 'list-after-a-close'));
      expect(framesB.at(-1)).toEqual({ type: 'inc.channel.list.result', id: 'list-after-a-close', channels: [] });

      await composition.unregisterEndpoint('ipc-composition-b');
      await composition.unregisterEndpoint('ipc-composition-b');
      expect(unregister).toHaveBeenCalledTimes(2);
      await composition.close();
      await composition.close();
      expect(destroy).toHaveBeenCalledTimes(1);
    } finally {
      peerA.destroy();
      peerB.destroy();
      await composition.close();
      await rm(baseDirectory, { recursive: true, force: true });
    }
  });

  it('binds one raw peer through exact readiness and public runtime dispatch', async () => {
    const baseDirectory = await mkdtemp('/tmp/k-ipc-runtime-shell-');
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
      expect(Object.isFrozen(projection.registration)).toBe(true);
      expect(Object.isFrozen(projection.registration.environment)).toBe(true);
      expect(Object.isFrozen(projection.registration.environment.capabilities)).toBe(true);
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

      peer.write(encodeJsonSequence({ type: 'keys.registerAction', id: 'bound-action', action: { id: 'action-1' } }));
      await waitFor(() => peerFrames.length === 2);
      expect(peerFrames[1]).toEqual({ type: 'keys.registerAction.result', id: 'bound-action', actionId: 'action-1' });
      expect(secondFrames).toEqual([]);

      peer.write(encodeJsonSequence({ type: 'keys.forward', key: 'y', code: 'KeyY' }));
      await waitFor(() => hotkeys.length === 1);
      expect(hotkeys).toEqual(['KeyY']);
      expect(aclChecks).toEqual(['keys:bind', 'keys:forward']);
    } finally {
      peer.destroy();
      secondPeer?.destroy();
      await projection.close();
      await rm(baseDirectory, { recursive: true, force: true });
    }
  });

  it('keeps peer-provided endpoint identity terminal under the projection binding guard', async () => {
    const baseDirectory = await mkdtemp('/tmp/k-ipc-runtime-shell-identity-');
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

  it('binds runtime identity, capability gates, and shell.init to the frozen transport registration', async () => {
    const baseDirectory = await mkdtemp('/tmp/k-ipc-runtime-shell-frozen-registration-');
    const hotkeys: string[] = [];
    const mutableRegistration = {
      windowId: 'frozen-window',
      dTag: 'frozen-napplet',
      aggregateHash: 'frozen-hash',
      environment: {
        capabilities: { domains: ['keys'] },
        services: ['original-service'],
      },
    };
    const projection = await createIpcShellProjection({
      baseDirectory,
      registration: mutableRegistration,
      runtimeAdapter: createAdapter(hotkeys, []),
    });
    mutableRegistration.windowId = 'caller-mutated-window';
    mutableRegistration.dTag = 'caller-mutated-napplet';
    mutableRegistration.aggregateHash = 'caller-mutated-hash';
    mutableRegistration.environment.capabilities.domains.splice(0, 1);
    mutableRegistration.environment.services.push('caller-mutated-service');
    const peer = await connectPeer(projection.path);
    const frames = collectFrames(peer);

    try {
      peer.write(encodeJsonSequence({ type: 'shell.ready' }));
      await waitFor(() => frames.length === 1);
      expect(projection.registration).toMatchObject({
        windowId: 'frozen-window',
        dTag: 'frozen-napplet',
        aggregateHash: 'frozen-hash',
      });
      expect(frames).toEqual([{
        type: 'shell.init',
        capabilities: { domains: ['keys'] },
        services: ['original-service'],
      }]);
      expect(projection.runtime.sessionRegistry.getEntryByWindowId('frozen-window')).toMatchObject({
        windowId: 'frozen-window',
        dTag: 'frozen-napplet',
        aggregateHash: 'frozen-hash',
      });
      expect(projection.runtime.sessionRegistry.getEntryByWindowId('caller-mutated-window')).toBeUndefined();

      peer.write(encodeJsonSequence({ type: 'keys.forward', key: 'f', code: 'KeyF' }));
      await waitFor(() => hotkeys.length === 1);
      expect(hotkeys).toEqual(['KeyF']);
    } finally {
      peer.destroy();
      await projection.close();
      await rm(baseDirectory, { recursive: true, force: true });
    }
  });

  it('rejects invalid shell capability registration before allocating a socket directory', async () => {
    const baseDirectory = await mkdtemp('/tmp/k-ipc-runtime-shell-invalid-');

    try {
      await expect(createIpcShellProjection({
        baseDirectory,
        registration: {
          ...registration,
          environment: { capabilities: { domains: ['keys', 7] as never }, services: [] },
        },
        runtimeAdapter: createAdapter([], []),
      })).rejects.toMatchObject({ code: 'INVALID_REGISTRATION' });
      await expect(readdir(baseDirectory)).resolves.toEqual([]);
    } finally {
      await rm(baseDirectory, { recursive: true, force: true });
    }
  });

  it('tears down only the current ready peer before accepting a replacement', async () => {
    const baseDirectory = await mkdtemp('/tmp/k-ipc-runtime-shell-cleanup-');
    const projection = await createIpcShellProjection({
      baseDirectory,
      registration,
      runtimeAdapter: createAdapter([], []),
    });
    const first = await connectPeer(projection.path);
    const firstFrames = collectFrames(first);
    const destroyWindow = vi.spyOn(projection.runtime, 'destroyWindow');
    const unregister = vi.spyOn(projection.runtime.sessionRegistry, 'unregister');

    try {
      first.write(encodeJsonSequence({ type: 'shell.ready' }));
      await waitFor(() => firstFrames.length === 1);
      const firstSession = projection.runtime.sessionRegistry.getEntryByWindowId(registration.windowId);
      expect(firstSession).toBeDefined();

      const firstClosed = waitForClose(first);
      first.end();
      await firstClosed;
      await waitFor(() => destroyWindow.mock.calls.length === 1);
      expect(unregister).toHaveBeenCalledWith(registration.windowId);
      expect(destroyWindow.mock.invocationCallOrder[0]).toBeLessThan(unregister.mock.invocationCallOrder[0]);
      expect(projection.runtime.sessionRegistry.getEntryByWindowId(registration.windowId)).toBeUndefined();
      await expect(access(projection.path)).resolves.toBeUndefined();

      const replacement = await connectPeer(projection.path);
      const replacementFrames = collectFrames(replacement);
      try {
        replacement.write(encodeJsonSequence({ type: 'shell.ready' }));
        await waitFor(() => replacementFrames.length === 1);
        const replacementSession = projection.runtime.sessionRegistry.getEntryByWindowId(registration.windowId);
        expect(replacementSession).toBeDefined();

        // A stale operation on the already-retired peer must not touch the replacement.
        first.destroy();
        await new Promise((resolve) => setTimeout(resolve, 15));
        expect(destroyWindow).toHaveBeenCalledTimes(1);
        expect(unregister).toHaveBeenCalledTimes(1);
        expect(projection.runtime.sessionRegistry.getEntryByWindowId(registration.windowId)).toBe(replacementSession);
      } finally {
        replacement.destroy();
      }
    } finally {
      first.destroy();
      await projection.close();
      await rm(baseDirectory, { recursive: true, force: true });
    }
  });

  it('uses the same cleanup path for abrupt peer destruction and projection shutdown', async () => {
    const baseDirectory = await mkdtemp('/tmp/k-ipc-runtime-shell-shutdown-');
    const projection = await createIpcShellProjection({
      baseDirectory,
      registration,
      runtimeAdapter: createAdapter([], []),
    });
    const peer = await connectPeer(projection.path);
    const frames = collectFrames(peer);
    const destroyWindow = vi.spyOn(projection.runtime, 'destroyWindow');
    const unregister = vi.spyOn(projection.runtime.sessionRegistry, 'unregister');
    const destroy = vi.spyOn(projection.runtime, 'destroy');

    peer.write(encodeJsonSequence({ type: 'shell.ready' }));
    await waitFor(() => frames.length === 1);
    const peerClosed = waitForClose(peer);
    peer.destroy(new Error('abrupt test disconnect'));
    await peerClosed;
    await waitFor(() => destroyWindow.mock.calls.length === 1);
    expect(unregister).toHaveBeenCalledTimes(1);

    await projection.close();
    await projection.close();
    expect(destroyWindow).toHaveBeenCalledTimes(1);
    expect(unregister).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
    await expect(access(projection.path)).rejects.toThrow();
    await rm(baseDirectory, { recursive: true, force: true });
  });

  it('keeps host-bound identity and runtime domain and ACL gates intact after readiness', async () => {
    const baseDirectory = await mkdtemp('/tmp/k-ipc-runtime-shell-policy-');
    const allowedHotkeys: string[] = [];
    const allowedAcl: string[] = [];
    const allowed = await createIpcShellProjection({
      baseDirectory,
      registration,
      runtimeAdapter: createAdapter(allowedHotkeys, allowedAcl),
    });
    const allowedPeer = await connectPeer(allowed.path);
    const allowedFrames = collectFrames(allowedPeer);

    try {
      allowedPeer.write(encodeJsonSequence({ type: 'shell.ready' }));
      await waitFor(() => allowedFrames.length === 1);
      const entry = allowed.runtime.sessionRegistry.getEntryByWindowId(registration.windowId);
      expect(entry).toMatchObject({
        windowId: registration.windowId,
        dTag: registration.dTag,
        aggregateHash: registration.aggregateHash,
        instanceId: 'host-generated-instance-id',
      });

      allowedPeer.write(encodeJsonSequence({ type: 'keys.forward', key: 'a', code: 'KeyA' }));
      await waitFor(() => allowedHotkeys.length === 1);
      expect(allowedHotkeys).toEqual(['KeyA']);
      expect(allowedAcl).toContain('keys:forward');

      allowed.runtime.aclState.block('', registration.dTag, registration.aggregateHash);
      allowedPeer.write(encodeJsonSequence({ type: 'keys.forward', key: 'b', code: 'KeyB' }));
      await new Promise((resolve) => setTimeout(resolve, 15));
      expect(allowedHotkeys).toEqual(['KeyA']);
      expect(allowedAcl).toContain('keys:forward');
    } finally {
      allowedPeer.destroy();
      await allowed.close();
      await rm(baseDirectory, { recursive: true, force: true });
    }

    const deniedDirectory = await mkdtemp('/tmp/k-ipc-runtime-shell-domain-');
    const deniedHotkeys: string[] = [];
    const denied = await createIpcShellProjection({
      baseDirectory: deniedDirectory,
      registration,
      runtimeAdapter: {
        ...createAdapter(deniedHotkeys, []),
        isDomainAllowed: () => false,
      },
    });
    const deniedPeer = await connectPeer(denied.path);
    const deniedFrames = collectFrames(deniedPeer);
    try {
      deniedPeer.write(encodeJsonSequence({ type: 'shell.ready' }));
      await waitFor(() => deniedFrames.length === 1);
      deniedPeer.write(encodeJsonSequence({ type: 'keys.forward', key: 'c', code: 'KeyC' }));
      await new Promise((resolve) => setTimeout(resolve, 15));
      expect(deniedHotkeys).toEqual([]);
    } finally {
      deniedPeer.destroy();
      await denied.close();
      await rm(deniedDirectory, { recursive: true, force: true });
    }

    const environmentDirectory = await mkdtemp('/tmp/k-ipc-runtime-shell-environment-');
    const environmentHotkeys: string[] = [];
    const environmentDenied = await createIpcShellProjection({
      baseDirectory: environmentDirectory,
      registration: {
        ...registration,
        environment: { capabilities: { domains: [] }, services: [] },
      },
      runtimeAdapter: createAdapter(environmentHotkeys, []),
    });
    const environmentPeer = await connectPeer(environmentDenied.path);
    const environmentFrames = collectFrames(environmentPeer);
    try {
      environmentPeer.write(encodeJsonSequence({ type: 'shell.ready' }));
      await waitFor(() => environmentFrames.length === 1);
      environmentPeer.write(encodeJsonSequence({ type: 'keys.forward', key: 'd', code: 'KeyD' }));
      await new Promise((resolve) => setTimeout(resolve, 15));
      expect(environmentHotkeys).toEqual([]);
    } finally {
      environmentPeer.destroy();
      await environmentDenied.close();
      await rm(environmentDirectory, { recursive: true, force: true });
    }
  });
});
