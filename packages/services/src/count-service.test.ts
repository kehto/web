import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@napplet/core';

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
});
