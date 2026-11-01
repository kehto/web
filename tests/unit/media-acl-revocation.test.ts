import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import { createRuntime } from '@kehto/runtime';
import { createMediaService } from '../../packages/services/src/media-service.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry } from '../../packages/runtime/src/test-utils.js';

describe('runtime media output authority', () => {
  it.each(['revoke', 'block'] as const)('retires only matching principals on %s and cannot revive retired IDs', mutation => {
    const { hooks, sent } = createMockRuntimeAdapter();
    const media = createMediaService({ documentTarget: null });
    const runtime = createRuntime({ ...hooks, services: { media } });
    const hash = 'a'.repeat(64);
    for (const [windowId, dTag] of [['a', 'player'], ['b', 'player'], ['c', 'other']]) {
      runtime.sessionRegistry.register(windowId, createNip5dSessionEntry(windowId, dTag, hash));
      runtime.firewallState.setPolicy(dTag, 'allow');
      runtime.handleMessage(windowId, { type: 'media.session.create', id: windowId, owner: 'napplet', sessionId: windowId } as NappletMessage);
    }
    expect(media.getSessions()).toHaveLength(3);
    if (mutation === 'revoke') runtime.aclState.revoke('', 'player', hash, 'media:control');
    else runtime.aclState.block('', 'player', hash);
    expect(media.getSessions().map(session => session.windowId)).toEqual(['c']);
    expect(sent.filter(({ message }) => message.type === 'media.session.ended').map(({ windowId }) => windowId)).toEqual(['a', 'b']);
    runtime.aclState.unblock('', 'player', hash);
    runtime.aclState.grant('', 'player', hash, 'media:control');
    sent.length = 0;
    runtime.handleMessage('a', { type: 'media.command', sessionId: 'a', action: 'play' } as NappletMessage);
    expect(sent).toEqual([]);
    runtime.destroy(); media.destroy();
  });

  it('does not authorize media requests from an unknown endpoint', () => {
    const { hooks } = createMockRuntimeAdapter();
    const handleMessage = vi.fn();
    const runtime = createRuntime({ ...hooks, services: { media: { descriptor: { name: 'media', version: '1' }, handleMessage } } });
    runtime.handleMessage('unknown', { type: 'media.session.create', id: 'c', owner: 'shell', source: { url: 'https://example.com/audio.mp3' } } as NappletMessage);
    expect(handleMessage).not.toHaveBeenCalled();
    runtime.destroy();
  });
});
