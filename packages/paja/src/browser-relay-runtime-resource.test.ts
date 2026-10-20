import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { NostrEvent } from '@napplet/core';

const transport = vi.hoisted(() => ({
  ensureRelay: vi.fn(),
  subscribe: vi.fn(),
  close: vi.fn(),
}));

vi.mock('nostr-tools/pool', () => ({
  SimplePool: class {
    ensureRelay = transport.ensureRelay;
    destroy() {}
  },
}));

import { createPajaRelayBackend } from './browser-relay-runtime.js';
import { normalizePajaSimulation } from './simulation.js';

const closeBackends: Array<() => void> = [];
beforeEach(() => {
  transport.ensureRelay.mockReset();
  transport.subscribe.mockReset();
  transport.close.mockReset();
  transport.subscribe.mockReturnValue({ close: transport.close });
  transport.ensureRelay.mockResolvedValue({ subscribe: transport.subscribe });
});
afterEach(() => { for (const close of closeBackends.splice(0)) close(); });

function backend() {
  const simulation = normalizePajaSimulation({ relay: { mode: 'live', urls: ['wss://relay.example'] } });
  const value = createPajaRelayBackend(() => simulation, () => true);
  closeBackends.push(() => value.close());
  return value;
}

it('does not open discovery transport for an already aborted resource request', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(backend().query(['wss://relay.example'], [{ kinds: [10063] }], 10_000,
    { reason: 'host' }, controller.signal)).resolves.toEqual([]);
  expect(transport.ensureRelay).not.toHaveBeenCalled();
  expect(transport.subscribe).not.toHaveBeenCalled();
});

it('aborts a pending discovery connection and prevents a late subscription', async () => {
  let connect!: (relay: { subscribe: typeof transport.subscribe }) => void;
  transport.ensureRelay.mockReturnValue(new Promise((resolve) => { connect = resolve; }));
  const controller = new AbortController();
  const pending = backend().query(['wss://relay.example'], [{ kinds: [10063] }], 10_000,
    { reason: 'host' }, controller.signal);
  expect(transport.ensureRelay).toHaveBeenCalledOnce();
  const signal = transport.ensureRelay.mock.calls[0]![1].abort as AbortSignal;
  expect(signal.aborted).toBe(false);
  controller.abort();
  expect(signal.aborted).toBe(true);
  await expect(pending).resolves.toEqual([]);
  connect({ subscribe: transport.subscribe });
  await Promise.resolve();
  expect(transport.subscribe).not.toHaveBeenCalled();
});

it('closes active discovery transport and ignores late events after resource cancellation', async () => {
  const controller = new AbortController();
  const pending = backend().query(['wss://relay.example'], [{ kinds: [10063] }], 10_000,
    { reason: 'host' }, controller.signal);
  await vi.waitFor(() => expect(transport.subscribe).toHaveBeenCalledOnce());
  const callbacks = transport.subscribe.mock.calls[0]![1] as {
    onevent(event: NostrEvent): void; oneose(): void;
  };
  controller.abort();
  expect(transport.close).toHaveBeenCalledExactlyOnceWith('paja query aborted');
  callbacks.onevent({
    id: 'a'.repeat(64), pubkey: 'b'.repeat(64), kind: 10063,
    created_at: 1, tags: [], content: '', sig: 'c'.repeat(128),
  });
  callbacks.oneose();
  await expect(pending).resolves.toEqual([]);
  expect(transport.close).toHaveBeenCalledOnce();
});
