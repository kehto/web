import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import type { ApprovalSignal, ServiceRuntimeContext } from '@kehto/runtime';

import { createCountService } from './count-service.js';

describe('createCountService', () => {
  it('returns an exact count for a valid count.query request', async () => {
    const service = createCountService({
      count: ({ filters }) => filters.length,
    });
    const sent: NappletMessage[] = [];

    service.handleMessage(
      'window-a',
      { type: 'count.query', id: 'count-1', filters: [{ kinds: [1] }, { kinds: [6] }] } as NappletMessage,
      (message) => sent.push(message),
    );
    await Promise.resolve();

    expect(sent).toEqual([{
      type: 'count.query.result',
      id: 'count-1',
      ok: true,
      count: 2,
      approximate: false,
    }]);
  });

  it('rejects invalid empty filters', () => {
    const service = createCountService({ count: () => 0 });
    const sent: NappletMessage[] = [];

    service.handleMessage(
      'window-a',
      { type: 'count.query', id: 'invalid', filters: [] } as NappletMessage,
      (message) => sent.push(message),
    );

    expect(sent[0]).toMatchObject({
      type: 'count.query.result',
      id: 'invalid',
      ok: false,
      error: 'invalid-filter',
    });
  });

  it('refuses unsupported filters with a clear reason', () => {
    const service = createCountService({
      count: () => 0,
      isFilterSupported: (filter) => Object.keys(filter).length === 0 ? 'empty filters are too expensive' : true,
    });
    const sent: NappletMessage[] = [];

    service.handleMessage(
      'window-a',
      { type: 'count.query', id: 'unsupported', filters: [{}] } as NappletMessage,
      (message) => sent.push(message),
    );

    expect(sent[0]).toMatchObject({
      type: 'count.query.result',
      id: 'unsupported',
      ok: false,
      error: 'unsupported-filter',
      reason: 'empty filters are too expensive',
    });
  });

  it('does not forward event payload fields from backend results', async () => {
    const service = createCountService({
      count: () => ({
        ok: true,
        count: 7,
        events: [{ id: 'must-not-leak' }],
      } as any),
    });
    const sent: NappletMessage[] = [];

    service.handleMessage(
      'window-a',
      { type: 'count.query', id: 'no-events', filters: [{ kinds: [1] }] } as NappletMessage,
      (message) => sent.push(message),
    );
    await Promise.resolve();

    expect(sent[0]).toMatchObject({
      type: 'count.query.result',
      id: 'no-events',
      ok: true,
      count: 7,
    });
    expect((sent[0] as any).events).toBeUndefined();
  });

  it('suppresses a late backend result after permission revocation', async () => {
    let resolve!: (value: number) => void;
    const service = createCountService({ count: () => new Promise<number>((done) => { resolve = done; }) });
    const sent: NappletMessage[] = [];
    service.handleMessage('window-a', { type: 'count.query', id: 'late', filters: [{ kinds: [1] }] } as NappletMessage, (message) => sent.push(message));
    service.onPermissionRevoked?.('window-a');
    resolve(1);
    await Promise.resolve();
    expect(sent).toEqual([]);
  });

  it('uses the same planned relays on the legacy path and warns once while configured calls stay quiet', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const count = vi.fn(({ relays }) => ({ ok: true, count: relays?.length ?? 0 }));
      const legacy = createCountService({ planCount: () => ({ relays: ['wss://count.example'] }), count });
      const sent: NappletMessage[] = [];
      for (const id of ['one', 'two']) legacy.handleMessage('window-a', {
        type: 'count.query', id, filters: [{ kinds: [1] }],
      } as NappletMessage, (message) => sent.push(message));
      await vi.waitFor(() => expect(sent).toHaveLength(2));
      expect(count).toHaveBeenCalledWith(expect.objectContaining({ relays: ['wss://count.example'] }));
      expect(warning).toHaveBeenCalledTimes(1);
      expect(warning.mock.calls[0]?.[0]).toMatch(/FW-COUNT-LEGACY-001.*RuntimeAdapter.permissions.*once per service instance/);

      warning.mockClear();
      const canonical = createCountService({ planCount: () => ({ relays: ['wss://count.example'] }), count });
      canonical.onRegistered?.({ authorizeOperation: async (_windowId: string, _operation: string, _requirements: readonly unknown[], execute: (signal: ApprovalSignal) => unknown) =>
        ({ status: 'executed' as const, value: await execute(new AbortController().signal) }) } as unknown as ServiceRuntimeContext);
      canonical.handleMessage('window-a', { type: 'count.query', id: 'three', filters: [{ kinds: [1] }] } as NappletMessage, (message) => sent.push(message));
      await vi.waitFor(() => expect(sent).toHaveLength(3));
      expect(warning).not.toHaveBeenCalled();
    } finally { warning.mockRestore(); }
  });

  it('never includes success fields on a failed COUNT result', async () => {
    const service = createCountService({ count: () => ({ ok: false, error: 'count-unavailable', count: 9, relays: ['wss://private.example'] }) });
    const sent: NappletMessage[] = [];
    service.handleMessage('window-a', { type: 'count.query', id: 'failed', filters: [{ kinds: [1] }] } as NappletMessage, (message) => sent.push(message));
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent).toEqual([{ type: 'count.query.result', id: 'failed', ok: false, error: 'count-unavailable' }]);
  });
});
