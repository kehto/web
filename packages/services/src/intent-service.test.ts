// @ts-expect-error Node types are intentionally absent from package compilation.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type {
  IntentAvailability,
  IntentRequest,
  IntentResult,
  NappletMessage,
} from '@napplet/core';
import type { ServiceRuntimeContext } from '@kehto/runtime';
import { createIntentService, type IntentResolver } from './intent-service.js';

const WINDOW = 'win-1';
const SENDER = 'source-dtag';
const CONVENTION = 'napplet:note/open';
const REQUEST: IntentRequest = {
  archetype: 'note',
  action: 'open',
  convention: CONVENTION,
  payload: { target: 'abc' },
};
const HANDLED: IntentResult = {
  ok: true,
  archetype: 'note',
  action: 'open',
  handled: true,
  handler: 'noteview',
  windowId: 'target-window',
  convention: CONVENTION,
};
const AVAILABILITY: IntentAvailability = {
  archetype: 'note',
  available: true,
  candidates: [{
    dTag: 'noteview',
    title: 'Note',
    actions: ['open'],
    conventions: [CONVENTION],
    isDefault: true,
  }],
  hasDefault: true,
};

interface MockResolver extends IntentResolver {
  emitChanged(availability: IntentAvailability): void;
}

function resolver(overrides: Partial<IntentResolver> = {}): MockResolver {
  let listener: ((availability: IntentAvailability) => void) | undefined;
  return {
    invoke: vi.fn(async () => HANDLED),
    available: vi.fn(async () => AVAILABILITY),
    handlers: vi.fn(async () => [AVAILABILITY]),
    onChanged: vi.fn((next) => {
      listener = next;
      return () => {
        listener = undefined;
      };
    }),
    emitChanged(availability) {
      listener?.(availability);
    },
    ...overrides,
  };
}

function context(overrides: Partial<ServiceRuntimeContext> = {}): ServiceRuntimeContext {
  return {
    resolveDTag: vi.fn((windowId: string) => windowId === WINDOW ? SENDER : undefined),
    listWindowIds: vi.fn(() => Object.freeze(['win-a', 'win-b'])),
    sendToEligibleNapplet: vi.fn(() => true),
    ...overrides,
  };
}

function sentCollector(): { sent: NappletMessage[]; send(message: NappletMessage): void } {
  const sent: NappletMessage[] = [];
  return { sent, send: (message) => sent.push(message) };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function rejected(
  archetype: string,
  action: string,
  error: string,
): IntentResult {
  return { ok: false, archetype, action, handled: false, error };
}

describe('createIntentService', () => {
  it('uses the published canonical declarations and exposes the intent descriptor', () => {
    const source = readFileSync(new URL('./intent-service.ts', import.meta.url), 'utf8');
    expect(source).toContain("from '@napplet/core'");
    expect(createIntentService({ resolver: resolver() }).descriptor.name).toBe('intent');
    // @ts-expect-error runtime guard
    expect(() => createIntentService({})).toThrow(/resolver is required/);
  });

  it('attests sender identity, normalizes the default action, and returns one canonical result', async () => {
    const mock = resolver();
    const service = createIntentService({ resolver: mock });
    service.onRegistered?.(context());
    const collector = sentCollector();
    service.handleMessage(
      WINDOW,
      {
        type: 'intent.invoke',
        id: 'invoke-1',
        request: {
          archetype: 'note',
          convention: CONVENTION,
          payload: { sender: 'forged' },
        },
      } as unknown as NappletMessage,
      collector.send,
    );
    await flush();

    expect(mock.invoke).toHaveBeenCalledWith({
      archetype: 'note',
      action: 'open',
      convention: CONVENTION,
      payload: { sender: 'forged' },
    }, { sender: SENDER });
    expect(collector.sent).toEqual([{
      type: 'intent.invoke.result',
      id: 'invoke-1',
      result: HANDLED,
    }]);
  });

  it.each([
    ['missing request', undefined, '', 'open', 'invalid request'],
    ['array request', [], '', 'open', 'invalid request'],
    ['missing archetype', { action: 'open' }, '', 'open', 'invalid request'],
    ['empty action', { ...REQUEST, action: '' }, 'note', '', 'invalid request'],
    ['bad convention', { ...REQUEST, convention: `${CONVENTION}?x=1` }, 'note', 'open', 'invalid convention'],
    ['caller sender', { ...REQUEST, sender: 'forged' }, 'note', 'open', 'invoke rejected'],
    ['empty handler', { ...REQUEST, handler: '' }, 'note', 'open', 'invoke rejected'],
    ['bad behavior', { ...REQUEST, behavior: { focus: 'yes' } }, 'note', 'open', 'invoke rejected'],
    ['unknown behavior', { ...REQUEST, behavior: { closeSource: true } }, 'note', 'open', 'invoke rejected'],
  ])('rejects %s before resolver selection', async (
    _label,
    request,
    archetype,
    action,
    error,
  ) => {
    const mock = resolver();
    const service = createIntentService({ resolver: mock });
    service.onRegistered?.(context());
    const collector = sentCollector();
    service.handleMessage(
      WINDOW,
      { type: 'intent.invoke', id: 'bad', request } as unknown as NappletMessage,
      collector.send,
    );
    await flush();
    expect(collector.sent).toEqual([{
      type: 'intent.invoke.result',
      id: 'bad',
      result: rejected(archetype as string, action as string, error as string),
    }]);
    expect(mock.invoke).not.toHaveBeenCalled();
  });

  it('rejects unattested sources and contains resolver failures', async () => {
    for (const invoke of [
      resolver({ invoke: vi.fn(() => { throw new Error('sync'); }) }),
      resolver({ invoke: vi.fn(async () => { throw new Error('async'); }) }),
    ]) {
      const service = createIntentService({ resolver: invoke });
      service.onRegistered?.(context());
      const collector = sentCollector();
      service.handleMessage(
        WINDOW,
        { type: 'intent.invoke', id: 'failed', request: REQUEST } as NappletMessage,
        collector.send,
      );
      await flush();
      expect(collector.sent[0]).toEqual({
        type: 'intent.invoke.result',
        id: 'failed',
        result: rejected('note', 'open', 'invoke rejected'),
      });
    }

    const missing = createIntentService({ resolver: resolver() });
    missing.onRegistered?.(context({ resolveDTag: () => undefined }));
    const collector = sentCollector();
    missing.handleMessage(
      WINDOW,
      { type: 'intent.invoke', id: 'missing', request: REQUEST } as NappletMessage,
      collector.send,
    );
    await flush();
    expect(collector.sent[0]).toEqual({
      type: 'intent.invoke.result',
      id: 'missing',
      result: rejected('note', 'open', 'invoke rejected'),
    });
  });

  it('returns availability and handler snapshots and reports infrastructure errors', async () => {
    const mock = resolver();
    const service = createIntentService({ resolver: mock });
    const collector = sentCollector();
    service.handleMessage(
      WINDOW,
      { type: 'intent.available', id: 'a1', archetype: 'note' } as NappletMessage,
      collector.send,
    );
    service.handleMessage(
      WINDOW,
      { type: 'intent.handlers', id: 'h1' } as NappletMessage,
      collector.send,
    );
    await flush();
    expect(collector.sent).toEqual([
      { type: 'intent.available.result', id: 'a1', availability: AVAILABILITY },
      { type: 'intent.handlers.result', id: 'h1', handlers: [AVAILABILITY] },
    ]);

    const failed = createIntentService({
      resolver: resolver({
        available: vi.fn(async () => { throw new Error('catalog unavailable'); }),
      }),
    });
    const errors = sentCollector();
    failed.handleMessage(
      WINDOW,
      { type: 'intent.available', id: 'a2', archetype: 'note' } as NappletMessage,
      errors.send,
    );
    await flush();
    expect(errors.sent).toEqual([{
      type: 'intent.available.result',
      id: 'a2',
      error: 'catalog unavailable',
    }]);
  });

  it('broadcasts changed availability only to currently eligible windows and unsubscribes', () => {
    const mock = resolver();
    const runtime = context();
    const service = createIntentService({ resolver: mock });
    service.onRegistered?.(runtime);
    mock.emitChanged(AVAILABILITY);
    expect(runtime.sendToEligibleNapplet).toHaveBeenNthCalledWith(
      1,
      'win-a',
      { type: 'intent.changed', availability: AVAILABILITY },
    );
    expect(runtime.sendToEligibleNapplet).toHaveBeenNthCalledWith(
      2,
      'win-b',
      { type: 'intent.changed', availability: AVAILABILITY },
    );

    service.onUnregistered?.();
    mock.emitChanged(AVAILABILITY);
    expect(runtime.sendToEligibleNapplet).toHaveBeenCalledTimes(2);
  });
});
