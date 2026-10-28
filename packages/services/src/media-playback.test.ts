import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import { createMediaService } from './media-service.js';
import type { MediaPlayback, MediaPlaybackBackend, MediaPlaybackState } from './media-playback.js';

const wire = (type: string, fields = {}): NappletMessage => ({ type, ...fields }) as NappletMessage;
function setup() {
  const output: NappletMessage[] = [];
  const destroy = vi.fn();
  const command = vi.fn();
  let change: Parameters<MediaPlaybackBackend['open']>[3] = () => {};
  const playback: MediaPlayback = { state: { status: 'paused', volume: 1 }, actions: ['play', 'pause', 'seek', 'volume'], command, destroy };
  const open = vi.fn<MediaPlaybackBackend['open']>(async (_window, _options, _signal, changed) => { change = changed; return playback; });
  const service = createMediaService({ playback: { open }, documentTarget: null });
  const send = (type: string, fields = {}, windowId = 'owner') => service.handleMessage(windowId, wire(type, fields), message => output.push(message));
  const create = async (sessionId = 'player', windowId = 'owner') => {
    send('media.session.create', { id: 'create', owner: 'shell', sessionId, source: { url: 'https://example.com/song.mp3' }, context: { label: 'Playlist' } }, windowId);
    await vi.waitFor(() => expect(service.getSessions().length).toBeGreaterThan(0));
  };
  return { service, output, send, create, open, command, destroy, change: (state: MediaPlaybackState) => change(state, playback.actions) };
}

describe('NAP-MEDIA draft ownership and retirement', () => {
  it('creates shell playback before emitting authoritative state and controls', async () => {
    const fixture = setup();
    await fixture.create();
    expect(fixture.output.map(message => message.type)).toEqual(['media.session.create.result', 'media.capabilities', 'media.controls', 'media.state']);
    expect(fixture.service.getSessions()[0]).toMatchObject({ owner: 'shell', context: { label: 'Playlist' } });
    fixture.send('media.state', { sessionId: 'player', status: 'playing' });
    fixture.send('media.capabilities', { sessionId: 'player', actions: ['next'] });
    expect(fixture.service.getSessions()[0]).toMatchObject({ state: { status: 'paused' }, actions: ['play', 'pause', 'seek', 'volume'] });
    fixture.change({ status: 'playing', position: 12, reason: 'user' });
    expect(fixture.output.at(-1)).toMatchObject({ type: 'media.state', status: 'playing', position: 12, reason: 'user' });
  });

  it('rejects cross-window mutation and invalid or unadvertised commands', async () => {
    const f = setup(); await f.create();
    for (const type of ['media.session.destroy', 'media.session.update', 'media.state', 'media.capabilities', 'media.command']) {
      f.send(type, { sessionId: 'player', metadata: { title: 'stolen' }, status: 'playing', actions: ['next'], action: 'play' }, 'intruder');
    }
    expect(f.service.getSessions()).toHaveLength(1);
    expect(f.destroy).not.toHaveBeenCalled();
    for (const command of [{ action: 'next' }, { action: 'seek' }, { action: 'seek', value: -1 }, { action: 'volume', value: 2 }, { action: 'volume', value: NaN }]) {
      f.send('media.command', { sessionId: 'player', ...command });
    }
    expect(f.command).not.toHaveBeenCalled();
    f.send('media.command', { sessionId: 'player', action: 'volume', value: 0.5, reason: 'focus-gained' });
    expect(f.command).toHaveBeenCalledWith(expect.objectContaining({ action: 'volume', value: 0.5, reason: 'user' }));
  });

  it('stops output before exactly one terminal event and discards stale commands and events', async () => {
    const f = setup(); await f.create();
    f.destroy.mockImplementation(() => { expect(f.service.getSessions()).toEqual([]); f.change({ status: 'playing' }); });
    f.send('media.session.destroy', { sessionId: 'player' });
    f.send('media.session.destroy', { sessionId: 'player' });
    f.send('media.command', { sessionId: 'player', action: 'play' });
    f.change({ status: 'stopped', reason: 'ended' });
    expect(f.output.at(-1)).toEqual({ type: 'media.session.ended', sessionId: 'player', reason: 'destroyed' });
    expect(f.output.filter(message => message.type === 'media.session.ended')).toHaveLength(1);
    expect(f.destroy).toHaveBeenCalledTimes(1);
    expect(f.command).not.toHaveBeenCalled();
    await f.create('player');
    expect(f.service.getSessions()[0].sessionId).not.toBe('player');
  });

  it('keeps a naturally ended session usable and retires on ACL revocation', async () => {
    const f = setup(); await f.create();
    f.change({ status: 'stopped', reason: 'ended' });
    expect(f.service.getSessions()).toHaveLength(1);
    f.service.command('player', { action: 'play' });
    expect(f.command).toHaveBeenCalledTimes(1);
    f.service.onCapabilityRevoked?.('owner', 'relay:read');
    expect(f.service.getSessions()).toHaveLength(1);
    f.service.onCapabilityRevoked?.('owner', 'media:control');
    expect(f.output.at(-1)).toMatchObject({ type: 'media.session.ended', reason: 'policy' });
  });

  it('does not fetch advisory napplet sources and respects empty capabilities', () => {
    const f = setup();
    f.send('media.session.create', { id: 'n', owner: 'napplet', sessionId: 'n', source: { url: 'https://example.com/advisory' }, capabilities: [] });
    f.service.command('n', { action: 'play' });
    f.send('media.command', { sessionId: 'n', action: 'play' });
    expect(f.open).not.toHaveBeenCalled();
    expect(f.output.some(message => message.type === 'media.command')).toBe(false);
    f.service.onWindowDestroyed?.('owner');
    expect(f.service.getSessions()).toEqual([]);
    expect(f.output.some(message => message.type === 'media.session.ended')).toBe(false);
  });

  it('aborts pending creation on teardown without sending to the dead endpoint', async () => {
    const f = setup();
    let resolve!: (playback: MediaPlayback) => void;
    f.open.mockImplementation(() => new Promise(done => { resolve = done; }));
    f.send('media.session.create', { id: 'pending', owner: 'shell', source: { url: 'https://example.com/song.mp3' } });
    await vi.waitFor(() => expect(f.open).toHaveBeenCalled());
    f.service.onWindowDestroyed?.('owner');
    expect(f.open.mock.calls[0][2].aborted).toBe(true);
    resolve({ state: { status: 'paused' }, actions: [], command: f.command, destroy: f.destroy });
    await vi.waitFor(() => expect(f.destroy).toHaveBeenCalled());
    expect(f.output).toEqual([]);
  });

  it('reserves canonical IDs during concurrent creation', async () => {
    const f = setup();
    const resolves: ((playback: MediaPlayback) => void)[] = [];
    f.open.mockImplementation(() => new Promise(resolve => resolves.push(resolve)));
    for (const windowId of ['a', 'b']) f.send('media.session.create', { id: windowId, owner: 'shell', sessionId: 'same', source: { url: 'https://example.com/song.mp3' } }, windowId);
    await vi.waitFor(() => expect(resolves).toHaveLength(2));
    for (const resolve of resolves) resolve({ state: { status: 'paused' }, actions: [], command: f.command, destroy: f.destroy });
    await vi.waitFor(() => expect(f.service.getSessions()).toHaveLength(2));
    expect(new Set(f.service.getSessions().map(session => session.sessionId)).size).toBe(2);
    f.service.destroy();
    expect(f.destroy).toHaveBeenCalledTimes(2);
  });

  it('settles a pending create when a live endpoint loses permission', async () => {
    const f = setup();
    let resolve!: (playback: MediaPlayback) => void;
    f.open.mockImplementation(() => new Promise(done => { resolve = done; }));
    f.send('media.session.create', { id: 'revoked-create', owner: 'shell', source: { url: 'https://example.com/slow.mp3' } });
    await vi.waitFor(() => expect(f.open).toHaveBeenCalled());
    f.service.onCapabilityRevoked?.('owner', 'media:control');
    expect(f.output).toEqual([{ type: 'media.session.create.result', id: 'revoked-create', owner: 'shell', error: 'permission revoked' }]);
    resolve({ state: { status: 'paused' }, actions: [], command: f.command, destroy: f.destroy });
    await vi.waitFor(() => expect(f.destroy).toHaveBeenCalled());
    expect(f.output).toHaveLength(1);
    expect(f.service.getSessions()).toEqual([]);
  });

  it('settles pending requests once when the host removes the service', async () => {
    const f = setup();
    f.open.mockImplementation(() => new Promise((_resolve, reject) => {
      const signal = f.open.mock.calls[0][2];
      signal.addEventListener('abort', () => reject(new Error('closed')), { once: true });
    }));
    f.send('media.session.create', { id: 'unregister', owner: 'shell', source: { url: 'https://example.com/slow.mp3' } });
    await vi.waitFor(() => expect(f.open).toHaveBeenCalled());
    f.service.onUnregistered?.(); f.service.destroy();
    await Promise.resolve();
    expect(f.output).toEqual([{ type: 'media.session.create.result', id: 'unregister', owner: 'shell', error: 'media service unavailable' }]);
    expect(f.service.getSessions()).toEqual([]);
  });

  it('bounds pending creation and emits no retirement for rejected creation', async () => {
    const output: NappletMessage[] = [];
    let reject!: (error: Error) => void;
    const open = vi.fn<MediaPlaybackBackend['open']>(() => new Promise((_resolve, fail) => { reject = fail; }));
    const service = createMediaService({ playback: { open }, maxSessionsPerWindow: 1, documentTarget: null });
    const create = (id: string) => service.handleMessage('w', wire('media.session.create', { id, owner: 'shell', source: { url: 'https://example.com/audio.mp3' } }), message => output.push(message));
    create('first'); create('second');
    expect(output).toEqual([{ type: 'media.session.create.result', id: 'second', owner: 'shell', error: 'session limit exceeded' }]);
    await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    reject(new Error('backend secret must not escape'));
    await vi.waitFor(() => expect(output).toHaveLength(2));
    expect(output[1]).toMatchObject({ type: 'media.session.create.result', id: 'first', error: 'source unavailable or autoplay denied' });
    expect(service.getSessions()).toEqual([]);
    service.destroy();
    expect(output).toHaveLength(2);
  });

  it('orders reentrant retirement after the result and emits no later controls', () => {
    const service = createMediaService({ documentTarget: null });
    const output: NappletMessage[] = [];
    service.handleMessage('w', wire('media.session.create', { id: 'c', owner: 'napplet', sessionId: 's' }), message => {
      output.push(message);
      if (message.type === 'media.session.create.result') service.retire('s', 'policy');
    });
    expect(output.map(message => message.type)).toEqual(['media.session.create.result', 'media.session.ended']);
    expect(service.getSessions()).toEqual([]);
  });
});
