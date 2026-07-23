import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import { renderNappletNamespacePrelude } from '../../packages/shell/src/napplet-namespace.js';
import { createRuntime } from '../../packages/runtime/src/runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from '../../packages/runtime/src/test-utils.js';

const NAP_INC_HEAD = '4593ce9e301ce098fd3dad64206fcd6f144fa7af';
const WEB_PROJECTION_HEAD = '896c32c92deee68dc4d10fc1132b62df20cccb6f';

type Message = { type: string; [key: string]: unknown };
type Listener = (event: { source: unknown; data: Message }) => void;

function createPreludeWindow(): {
  parent: { postMessage: (message: Message) => void };
  crypto: { randomUUID: () => string };
  addEventListener: (type: string, listener: Listener) => void;
  removeEventListener: (type: string, listener: Listener) => void;
  document: { addEventListener: () => void; removeEventListener: () => void; activeElement: null };
  napplet?: Record<string, unknown>;
  posted: Message[];
} {
  const listeners = new Set<Listener>();
  const posted: Message[] = [];
  const parent = { postMessage: (message: Message) => posted.push(message) };
  return {
    parent,
    crypto: { randomUUID: () => 'tracer-id' },
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    document: { addEventListener: () => undefined, removeEventListener: () => undefined, activeElement: null },
    posted,
  };
}

function runPrelude(target: ReturnType<typeof createPreludeWindow>): void {
  const script = renderNappletNamespacePrelude({ domains: ['inc'] });
  const source = script.match(/<script[^>]*>([\s\S]*)<\/script>/)?.[1];
  if (!source) throw new Error('missing prelude source');
  new Function('window', source)(target);
}

describe('NAP-INC canonical event tracer', () => {
  it(`transposes before the wire and preserves exact routing (#89 ${NAP_INC_HEAD}; #90 ${WEB_PROJECTION_HEAD})`, () => {
    const sourcePrelude = createPreludeWindow();
    runPrelude(sourcePrelude);
    const inc = sourcePrelude.napplet?.inc as { emit: (topic: string, payload?: unknown) => void };

    inc.emit('napplet:profile/open?pubkey=a%20b&plus=a+b');
    const emit = sourcePrelude.posted.find((message) => message.type === 'inc.emit');
    expect(emit).toEqual({
      type: 'inc.emit',
      topic: 'napplet:profile/open',
      payload: { pubkey: 'a b', plus: 'a+b' },
    });

    const ctx = createMockRuntimeAdapter();
    const runtime = createRuntime(ctx.hooks);
    runtime.sessionRegistry.register('source-window', createNip5dSessionEntry('source-window', 'source-dtag', 'a'.repeat(64)));
    runtime.sessionRegistry.register('recipient-window', createNip5dSessionEntry('recipient-window', 'recipient-dtag', 'b'.repeat(64)));

    runtime.handleMessage('recipient-window', {
      type: 'inc.subscribe', id: 'recipient-subscription', topic: 'napplet:profile/open',
    } as NappletMessage);
    ctx.sent.length = 0;
    runtime.handleMessage('source-window', { ...emit, sender: 'forged-sender' } as NappletMessage);

    const events = ctx.sent.filter((sent) => (sent.message as Message).type === 'inc.event');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      windowId: 'recipient-window',
      message: {
        type: 'inc.event',
        topic: 'napplet:profile/open',
        sender: 'source-dtag',
        payload: { pubkey: 'a b', plus: 'a+b' },
      },
    });
    expect(events.some((sent) => sent.windowId === 'source-window')).toBe(false);

    ctx.sent.length = 0;
    runtime.handleMessage('source-window', {
      type: 'inc.emit', topic: 'napplet:profile/open?pubkey=raw', payload: { pubkey: 'raw' },
    } as NappletMessage);
    expect(ctx.sent.filter((sent) => (sent.message as Message).type === 'inc.event')).toHaveLength(0);
  });
});
