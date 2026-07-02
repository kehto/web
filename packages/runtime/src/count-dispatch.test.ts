import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@napplet/core';

import { createRuntime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry, findEnvelopeResponse } from './test-utils.js';

const WINDOW_ID = 'win-count-1';
const DTAG = 'count-napp';
const HASH = 'c'.repeat(64);

function registerSession(runtime: ReturnType<typeof createRuntime>): void {
  runtime.sessionRegistry.register(WINDOW_ID, createNip5dSessionEntry(WINDOW_ID, DTAG, HASH));
}

describe('runtime count domain dispatch', () => {
  it('returns an exact aggregate count from a registered count service', async () => {
    const ctx = createMockRuntimeAdapter();
    const runtime = createRuntime(ctx.hooks);
    registerSession(runtime);
    runtime.aclState.grant('', DTAG, HASH, 'relay:read');

    const received: NappletMessage[] = [];
    runtime.registerService('count', {
      descriptor: { name: 'count', version: '1.0.0' },
      handleMessage(_wid, msg, send) {
        received.push(msg);
        send({
          type: 'count.query.result',
          id: 'count-1',
          ok: true,
          count: 42,
          approximate: false,
          relays: ['wss://relay.example'],
        } as NappletMessage);
      },
    });

    runtime.handleMessage(WINDOW_ID, {
      type: 'count.query',
      id: 'count-1',
      filters: [{ kinds: [1] }, { authors: ['a'.repeat(64)] }],
      options: { relays: ['wss://relay.example'] },
    } as NappletMessage);
    await Promise.resolve();

    expect(received).toHaveLength(1);
    expect((received[0] as any).filters).toHaveLength(2);
    const result = findEnvelopeResponse(ctx.sent, 'count.query.result');
    expect(result).toMatchObject({
      id: 'count-1',
      ok: true,
      count: 42,
      approximate: false,
      relays: ['wss://relay.example'],
    });
    expect((result as any).events).toBeUndefined();
  });

  it('rejects empty filters before dispatching to a service', () => {
    const ctx = createMockRuntimeAdapter();
    const runtime = createRuntime(ctx.hooks);
    registerSession(runtime);
    runtime.aclState.grant('', DTAG, HASH, 'relay:read');

    const received: NappletMessage[] = [];
    runtime.registerService('count', {
      descriptor: { name: 'count', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });

    runtime.handleMessage(WINDOW_ID, {
      type: 'count.query',
      id: 'invalid',
      filters: [],
    } as NappletMessage);

    expect(received).toHaveLength(0);
    expect(findEnvelopeResponse(ctx.sent, 'count.query.result')).toMatchObject({
      id: 'invalid',
      ok: false,
      error: 'invalid-filter',
    });
  });

  it('refuses unsupported count requests when no count backend is wired', () => {
    const ctx = createMockRuntimeAdapter();
    const runtime = createRuntime(ctx.hooks);
    registerSession(runtime);
    runtime.aclState.grant('', DTAG, HASH, 'relay:read');

    runtime.handleMessage(WINDOW_ID, {
      type: 'count.query',
      id: 'unsupported',
      filters: [{ kinds: [1] }],
    } as NappletMessage);

    const result = findEnvelopeResponse(ctx.sent, 'count.query.result');
    expect(result).toMatchObject({
      id: 'unsupported',
      ok: false,
      error: 'count-unavailable',
    });
    expect((result as any).reason).toMatch(/refusing to emulate counts by fetching event payloads/);
  });

  it('strips event payloads from count service responses', async () => {
    const ctx = createMockRuntimeAdapter();
    const runtime = createRuntime(ctx.hooks);
    registerSession(runtime);
    runtime.aclState.grant('', DTAG, HASH, 'relay:read');

    runtime.registerService('count', {
      descriptor: { name: 'count', version: '1.0.0' },
      handleMessage(_wid, _msg, send) {
        send({
          type: 'count.query.result',
          id: 'no-events',
          ok: true,
          count: 1,
          events: [{ id: 'event-payload' }],
        } as NappletMessage);
      },
    });

    runtime.handleMessage(WINDOW_ID, {
      type: 'count.query',
      id: 'no-events',
      filters: [{ kinds: [1] }],
    } as NappletMessage);
    await Promise.resolve();

    const result = findEnvelopeResponse(ctx.sent, 'count.query.result');
    expect(result).toMatchObject({ id: 'no-events', ok: true, count: 1 });
    expect((result as any).events).toBeUndefined();
  });
});
