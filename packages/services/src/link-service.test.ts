import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';

import { createLinkService, type LinkServiceOptions } from './link-service.js';

const WINDOW_ID = 'win-link';

function collectSent(): { sent: NappletMessage[]; send: (msg: NappletMessage) => void } {
  const sent: NappletMessage[] = [];
  return {
    sent,
    send: (msg) => { sent.push(msg); },
  };
}

function openMessage(url: string): NappletMessage {
  return { type: 'link.open', id: 'link-1', url, options: { label: 'Open' } } as NappletMessage;
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('createLinkService', () => {
  it('returns a link service descriptor', () => {
    const service = createLinkService();
    expect(service.descriptor.name).toBe('link');
    expect(service.descriptor.version).toBe('1.0.0');
  });

  it('opens allowed https URLs through the host opener', async () => {
    const open = vi.fn((() => ({ status: 'opened' as const })) as NonNullable<LinkServiceOptions['open']>);
    const service = createLinkService({ open });
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, openMessage('https://example.com/post/123'), send);
    await flush();

    expect(open).toHaveBeenCalledOnce();
    const [context] = open.mock.calls[0]!;
    expect(context).toMatchObject({
      windowId: WINDOW_ID,
      options: { label: 'Open' },
    });
    expect(context.url.href).toBe('https://example.com/post/123');
    expect(sent).toEqual([{ type: 'link.open.result', id: 'link-1', status: 'opened' }]);
  });

  it('denies malformed URLs before host opener', async () => {
    const open = vi.fn(() => ({ status: 'opened' as const }));
    const service = createLinkService({ open });
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, openMessage('not a url'), send);
    await flush();

    expect(open).not.toHaveBeenCalled();
    expect(sent).toEqual([{ type: 'link.open.result', id: 'link-1', status: 'denied', error: 'invalid-url' }]);
  });

  it('denies unsafe schemes before host opener', async () => {
    const open = vi.fn(() => ({ status: 'opened' as const }));
    const service = createLinkService({ open });
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, openMessage('file:///etc/passwd'), send);
    await flush();

    expect(open).not.toHaveBeenCalled();
    expect(sent).toEqual([{ type: 'link.open.result', id: 'link-1', status: 'denied', error: 'unsupported-scheme' }]);
  });

  it('denies valid URLs when no host opener is configured', async () => {
    const service = createLinkService();
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, openMessage('https://example.com/'), send);
    await flush();

    expect(sent).toEqual([{ type: 'link.open.result', id: 'link-1', status: 'denied', error: 'blocked-by-policy' }]);
  });

  it('maps host denials to link.open.result denied', async () => {
    const service = createLinkService({ open: () => ({ status: 'denied' }) });
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, openMessage('https://example.com/'), send);
    await flush();

    expect(sent).toEqual([{ type: 'link.open.result', id: 'link-1', status: 'denied', error: 'blocked-by-policy' }]);
  });

  it('contains host opener exceptions as blocked-by-policy denials', async () => {
    const service = createLinkService({ open: () => { throw new Error('boom'); } });
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, openMessage('https://example.com/'), send);
    await flush();

    expect(sent).toEqual([{ type: 'link.open.result', id: 'link-1', status: 'denied', error: 'blocked-by-policy' }]);
  });

  it('contains unknown link actions', () => {
    const service = createLinkService();
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'link.unknown', id: 'u1' } as NappletMessage, send);

    expect(sent).toEqual([{ type: 'link.unknown.error', id: 'u1', error: 'Unknown link method: link.unknown' }]);
  });
});
