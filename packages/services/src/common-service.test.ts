import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import { encodeBytes } from 'nostr-tools/nip19';

import { createCommonService, type CommonServiceOptions } from './common-service.js';

const WINDOW_ID = 'win-common';
const HEX = '0'.repeat(64);

function collectSent(): { sent: NappletMessage[]; send: (msg: NappletMessage) => void } {
  const sent: NappletMessage[] = [];
  return {
    sent,
    send: (msg) => { sent.push(msg); },
  };
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('createCommonService', () => {
  it('returns a common service descriptor', () => {
    const service = createCommonService();
    expect(service.descriptor.name).toBe('common');
    expect(service.descriptor.version).toBe('1.0.0');
  });

  it('encodes and decodes public NIP-19 npub values', () => {
    const service = createCommonService();
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'common.encodeNip19', id: 'enc-1', input: { type: 'npub', hex: HEX } } as NappletMessage, send);
    expect(sent[0]).toMatchObject({ type: 'common.encodeNip19.result', id: 'enc-1', ok: true, nip19Type: 'npub' });
    const encoded = (sent[0] as unknown as { value: string }).value;
    expect(encoded).toMatch(/^npub1/);

    service.handleMessage(WINDOW_ID, { type: 'common.decodeNip19', id: 'dec-1', value: encoded } as NappletMessage, send);
    expect(sent[1]).toEqual({ type: 'common.decodeNip19.result', id: 'dec-1', ok: true, nip19Type: 'npub', hex: HEX });
  });

  it('encodes and decodes nrelay values', () => {
    const service = createCommonService();
    const { sent, send } = collectSent();
    const relay = 'wss://relay.example';

    service.handleMessage(WINDOW_ID, { type: 'common.encodeNip19', id: 'enc-relay', input: { type: 'nrelay', relay } } as NappletMessage, send);
    expect(sent[0]).toMatchObject({ type: 'common.encodeNip19.result', id: 'enc-relay', ok: true, nip19Type: 'nrelay' });

    service.handleMessage(WINDOW_ID, { type: 'common.decodeNip19', id: 'dec-relay', value: encodeBytes('nrelay', new TextEncoder().encode(relay)) } as NappletMessage, send);
    expect(sent[1]).toEqual({ type: 'common.decodeNip19.result', id: 'dec-relay', ok: true, nip19Type: 'nrelay', relay });
  });

  it('returns ok:false for invalid decode input', () => {
    const service = createCommonService();
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'common.decodeNip19', id: 'bad', value: 'nope' } as NappletMessage, send);
    expect(sent[0]).toMatchObject({ type: 'common.decodeNip19.result', id: 'bad', ok: false });
  });

  it('delegates profile lookup with caller context', async () => {
    const getProfile = vi.fn<NonNullable<CommonServiceOptions['getProfile']>>(() => ({ ok: true, pubkey: HEX, profile: { name: 'alice' } }));
    const service = createCommonService({ getProfile });
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'common.getProfile', id: 'profile-1', target: HEX } as NappletMessage, send);
    await flush();

    expect(getProfile).toHaveBeenCalledWith(HEX, { windowId: WINDOW_ID });
    expect(sent[0]).toEqual({ type: 'common.getProfile.result', id: 'profile-1', ok: true, pubkey: HEX, profile: { name: 'alice' } });
  });

  it('returns shaped ok:false profile result when no profile hook is configured', () => {
    const service = createCommonService();
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'common.getProfile', id: 'profile-2', target: HEX } as NappletMessage, send);
    expect(sent[0]).toEqual({
      type: 'common.getProfile.result',
      id: 'profile-2',
      ok: false,
      pubkey: HEX,
      error: 'profile lookup unavailable',
    });
  });

  it('delegates follows lookup and social actions', async () => {
    const options: CommonServiceOptions = {
      follows: vi.fn(() => ({ ok: true, pubkeys: [HEX] })),
      follow: vi.fn(() => ({ ok: true, eventId: 'follow-event' })),
      unfollow: vi.fn(() => ({ ok: true, eventId: 'unfollow-event' })),
      react: vi.fn(() => ({ ok: true, eventId: 'react-event' })),
      report: vi.fn(() => ({ ok: true, eventId: 'report-event' })),
    };
    const service = createCommonService(options);
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'common.follows', id: 'follows-1' } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, { type: 'common.follow', id: 'follow-1', pubkeys: [HEX] } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, { type: 'common.unfollow', id: 'unfollow-1', pubkeys: [HEX] } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, { type: 'common.react', id: 'react-1', targetEventId: HEX, reaction: '+' } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, {
      type: 'common.report',
      id: 'report-1',
      target: { type: 'event', id: HEX },
      reason: 'spam',
      text: 'spam',
    } as NappletMessage, send);
    await flush();

    expect(options.follows).toHaveBeenCalledWith({ windowId: WINDOW_ID });
    expect(options.follow).toHaveBeenCalledWith([HEX], { windowId: WINDOW_ID });
    expect(options.unfollow).toHaveBeenCalledWith([HEX], { windowId: WINDOW_ID });
    expect(options.react).toHaveBeenCalledWith(HEX, '+', undefined, { windowId: WINDOW_ID });
    expect(options.report).toHaveBeenCalledWith({ type: 'event', id: HEX }, 'spam', 'spam', { windowId: WINDOW_ID });
    expect(sent).toEqual([
      { type: 'common.follows.result', id: 'follows-1', ok: true, pubkeys: [HEX] },
      { type: 'common.follow.result', id: 'follow-1', ok: true, eventId: 'follow-event' },
      { type: 'common.unfollow.result', id: 'unfollow-1', ok: true, eventId: 'unfollow-event' },
      { type: 'common.react.result', id: 'react-1', ok: true, eventId: 'react-event' },
      { type: 'common.report.result', id: 'report-1', ok: true, eventId: 'report-event' },
    ]);
  });

  it('returns shaped ok:false results for unavailable social hooks', () => {
    const service = createCommonService();
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'common.follows', id: 'follows-2' } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, { type: 'common.follow', id: 'follow-2', pubkeys: [HEX] } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, { type: 'common.unfollow', id: 'unfollow-2', pubkeys: [HEX] } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, { type: 'common.react', id: 'react-2', targetEventId: HEX, reaction: '+' } as NappletMessage, send);
    service.handleMessage(WINDOW_ID, { type: 'common.report', id: 'report-2', target: { type: 'pubkey', pubkey: HEX }, reason: 'other', text: '' } as NappletMessage, send);

    expect(sent).toEqual([
      { type: 'common.follows.result', id: 'follows-2', ok: false, pubkeys: [], error: 'follows lookup unavailable' },
      { type: 'common.follow.result', id: 'follow-2', ok: false, error: 'follow unavailable' },
      { type: 'common.unfollow.result', id: 'unfollow-2', ok: false, error: 'unfollow unavailable' },
      { type: 'common.react.result', id: 'react-2', ok: false, error: 'react unavailable' },
      { type: 'common.report.result', id: 'report-2', ok: false, error: 'report unavailable' },
    ]);
  });

  it('contains host exceptions as shaped ok:false results', async () => {
    const service = createCommonService({ follows: () => { throw new Error('relay offline'); } });
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'common.follows', id: 'follows-3' } as NappletMessage, send);
    await flush();

    expect(sent[0]).toEqual({ type: 'common.follows.result', id: 'follows-3', ok: false, pubkeys: [], error: 'relay offline' });
  });

  it('contains unknown common actions', () => {
    const service = createCommonService();
    const { sent, send } = collectSent();

    service.handleMessage(WINDOW_ID, { type: 'common.unknown', id: 'u1' } as NappletMessage, send);
    expect(sent).toEqual([{ type: 'common.unknown.error', id: 'u1', error: 'Unknown common method: common.unknown' }]);
  });
});
