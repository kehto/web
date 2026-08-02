import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPajaAdapter, type PajaSignerProvider } from './browser-adapter.js';
import { resolvePajaFrameEnvironment } from './browser-target-frame.js';
import type { PajaHostConfig } from './options.js';
import { normalizePajaSimulation } from './simulation.js';

const CONFIG = {
  version: 1,
  window: { id: 'window-a', dTag: 'domain-test', aggregateHash: 'hash-a' },
} as PajaHostConfig;

function closeAdapter(adapter: ReturnType<typeof createPajaAdapter>): void {
  (adapter.relayPool.getRelayPool() as unknown as { close(): void }).close();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Paja real DM availability', () => {
  it('registers NIP-17 only for the live relay plus real dev-key signer combination', () => {
    let method: ReturnType<PajaSignerProvider['getMethod']> = 'none';
    const listeners = new Set<() => void>();
    const provider: PajaSignerProvider = {
      getSigner: () => null,
      getMethod: () => method,
      getPubkey: () => null,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    const simulation = normalizePajaSimulation({
      relay: { mode: 'live', urls: ['wss://relay.example'] },
      upload: { mode: 'disabled' },
    });
    const environmentChanged = vi.fn();
    const adapter = createPajaAdapter(
      CONFIG,
      () => simulation,
      () => {},
      () => {},
      () => true,
      provider,
      undefined,
      environmentChanged,
    );

    expect(adapter.services?.dm).toBeUndefined();
    expect(resolvePajaFrameEnvironment(adapter, CONFIG.window).capabilities.domains).not.toContain('dm');

    method = 'dev';
    for (const listener of listeners) listener();
    expect(adapter.services?.dm?.descriptor).toMatchObject({ name: 'dm', version: '1.0.0' });
    expect(resolvePajaFrameEnvironment(adapter, CONFIG.window).capabilities.domains).toContain('dm');
    expect(environmentChanged).toHaveBeenCalledOnce();

    method = 'nip07';
    for (const listener of listeners) listener();
    expect(adapter.services?.dm).toBeUndefined();
    expect(resolvePajaFrameEnvironment(adapter, CONFIG.window).capabilities.domains).not.toContain('dm');
    expect(environmentChanged).toHaveBeenCalledTimes(2);
    closeAdapter(adapter);
  });

  it('never registers DM for a non-live relay backend', () => {
    const adapter = createPajaAdapter(
      CONFIG,
      () => normalizePajaSimulation({ relay: { mode: 'memory' } }),
      () => {},
      () => {},
      () => true,
      { getSigner: () => null, getMethod: () => 'dev', getPubkey: () => null },
    );
    expect(adapter.services?.dm).toBeUndefined();
    closeAdapter(adapter);
  });
});

describe('Paja real FS availability', () => {
  it('advertises FS only after the OPFS root probe succeeds', async () => {
    const root = { kind: 'directory', name: 'root' };
    const getDirectory = vi.fn(async () => root);
    vi.stubGlobal('navigator', { storage: { getDirectory } });
    const environmentChanged = vi.fn();
    const adapter = createPajaAdapter(
      CONFIG,
      () => normalizePajaSimulation({ relay: { mode: 'disabled' } }),
      () => {},
      () => {},
      () => true,
      undefined,
      undefined,
      environmentChanged,
    );

    expect(adapter.services?.fs).toBeUndefined();
    await adapter.ready;
    expect(adapter.services?.fs?.descriptor.name).toBe('fs');
    expect(getDirectory).toHaveBeenCalledOnce();
    expect(resolvePajaFrameEnvironment(adapter, CONFIG.window).capabilities.domains).toContain('fs');
    await vi.waitFor(() => expect(environmentChanged).toHaveBeenCalledOnce());
    closeAdapter(adapter);
  });

  it('keeps FS unadvertised when OPFS is unavailable or policy-disabled', async () => {
    vi.stubGlobal('navigator', { storage: { getDirectory: vi.fn(async () => { throw new Error('denied'); }) } });
    const unavailable = createPajaAdapter(
      CONFIG,
      () => normalizePajaSimulation({ relay: { mode: 'disabled' } }),
      () => {},
      () => {},
      () => true,
    );
    await unavailable.ready;
    expect(unavailable.services?.fs).toBeUndefined();
    expect(resolvePajaFrameEnvironment(unavailable, CONFIG.window).capabilities.domains).not.toContain('fs');
    closeAdapter(unavailable);

    vi.stubGlobal('navigator', { storage: { getDirectory: vi.fn(async () => ({ kind: 'directory', name: 'root' })) } });
    const disabled = createPajaAdapter(
      CONFIG,
      () => normalizePajaSimulation({
        relay: { mode: 'disabled' },
        capabilities: { domains: { fs: false } },
      }),
      () => {},
      () => {},
      () => true,
    );
    await disabled.ready;
    expect(disabled.services?.fs).toBeDefined();
    expect(resolvePajaFrameEnvironment(disabled, CONFIG.window).capabilities.domains).not.toContain('fs');
    closeAdapter(disabled);
  });
});
