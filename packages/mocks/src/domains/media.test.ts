import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import type { MockScheduler } from '../core/types.js';
import { MEDIA_MOCK_ENTRY, MEDIA_SPEC_REF, MEDIA_TORRENT_SPEC_REF, MOCK_MEDIA_PLAYLIST, createMockMediaService } from './media.js';

const NOW = 1_767_225_600_000;
const clock = { now: () => NOW };
const TRACK = MOCK_MEDIA_PLAYLIST[0]!;
const SHELL_CONTROLS = ['play', 'pause', 'stop', 'next', 'prev', 'seek', 'volume'];

function sink() {
  const sent: NappletMessage[] = [];
  return { sent, send: (msg: NappletMessage) => { sent.push(msg); } };
}
const msg = (fields: Record<string, unknown>): NappletMessage => fields as unknown as NappletMessage;

function createShell(service = createMockMediaService({ clock }), fields: Record<string, unknown> = {}) {
  const { sent, send } = sink();
  service.handleMessage('w1', msg({ type: 'media.session.create', id: 'm1', owner: 'shell', source: { url: TRACK.url }, autoplay: true, ...fields }), send);
  return { service, sent, send };
}

describe('createMockMediaService', () => {
  it('describes the service and spec refs', () => {
    const service = createMockMediaService();
    expect(service.descriptor).toEqual({ name: 'media', version: '1.2.0', description: 'Mock NAP-MEDIA session registry and shell player' });
    expect(service.messageCapabilities).toBeUndefined();
    expect(service.mock.routes).toEqual(['media.session.create', 'media.session.update', 'media.session.destroy', 'media.state', 'media.capabilities', 'media.command']);
    expect(MEDIA_SPEC_REF).toEqual({ nap: 'NAP-MEDIA', status: 'draft', source: 'pr', pr: 10, sha: '7806f4385302', path: 'naps/NAP-MEDIA.md' });
    expect(MEDIA_TORRENT_SPEC_REF.pr).toBe(133);
    expect(MEDIA_MOCK_ENTRY).toMatchObject({ domain: 'media', kind: 'service', spec: MEDIA_SPEC_REF });
  });

  it('creates a napplet-owned session with the preferred id and pushes shell controls', () => {
    const service = createMockMediaService();
    const { sent, send } = sink();
    service.handleMessage('w1', msg({ type: 'media.session.create', id: 'm1', owner: 'napplet', sessionId: 's1', metadata: { title: 'My Song' }, capabilities: ['play', 'pause', 'bogus'] }), send);
    expect(sent).toEqual([
      { type: 'media.session.create.result', id: 'm1', sessionId: 's1', owner: 'napplet' },
      { type: 'media.controls', sessionId: 's1', controls: SHELL_CONTROLS },
    ]);
    expect(service.mock.state().sessions.get('s1')).toMatchObject({ owner: 'napplet', actions: ['play', 'pause'], metadata: { title: 'My Song' } });
  });

  it('plays a seeded playlist track for shell-owned sessions and advances on tick', () => {
    const { service, sent } = createShell();
    expect(sent).toEqual([
      { type: 'media.session.create.result', id: 'm1', sessionId: 'media-1', owner: 'shell' },
      { type: 'media.controls', sessionId: 'media-1', controls: SHELL_CONTROLS },
      { type: 'media.capabilities', sessionId: 'media-1', actions: ['play', 'pause', 'stop', 'seek', 'volume', 'next', 'prev'] },
      { type: 'media.state', sessionId: 'media-1', status: 'buffering' },
      { type: 'media.state', sessionId: 'media-1', status: 'playing', position: 0, volume: 1, duration: 214 },
    ]);
    expect(service.mock.state().sessions.get('media-1')?.metadata).toEqual({ title: 'Morning Compile', artist: 'The Kernel Panics', album: 'Build Logs', artwork: { url: TRACK.artwork }, duration: 214, mediaType: 'audio' });
    service.tick(5_000);
    expect(sent.at(-1)).toEqual({ type: 'media.state', sessionId: 'media-1', status: 'playing', position: 5, volume: 1, duration: 214 });
    service.tick(300_000);
    expect(sent.at(-1)).toEqual({ type: 'media.state', sessionId: 'media-1', status: 'stopped', position: 214, volume: 1, duration: 214, reason: 'ended' });
    expect(service.mock.state().sessions.has('media-1')).toBe(true);
  });

  it('applies napplet commands on shell-owned playback and walks the playlist', () => {
    const { service, sent, send } = createShell();
    sent.length = 0;
    service.handleMessage('w1', msg({ type: 'media.command', sessionId: 'media-1', action: 'seek', value: 100 }), send);
    service.handleMessage('w1', msg({ type: 'media.command', sessionId: 'media-1', action: 'volume', value: 0.5 }), send);
    service.handleMessage('w1', msg({ type: 'media.command', sessionId: 'media-1', action: 'pause' }), send);
    service.handleMessage('w1', msg({ type: 'media.command', sessionId: 'media-1', action: 'next' }), send);
    service.handleMessage('w1', msg({ type: 'media.command', sessionId: 'media-1', action: 'seek', value: -1 }), send);
    expect(sent).toEqual([
      { type: 'media.state', sessionId: 'media-1', status: 'playing', position: 100, volume: 1, duration: 214 },
      { type: 'media.state', sessionId: 'media-1', status: 'playing', position: 100, volume: 0.5, duration: 214 },
      { type: 'media.state', sessionId: 'media-1', status: 'paused', position: 100, volume: 0.5, duration: 214, reason: 'user' },
      { type: 'media.state', sessionId: 'media-1', status: 'paused', position: 0, volume: 0.5, duration: 187, reason: 'user' },
    ]);
    expect(service.mock.state().sessions.get('media-1')?.metadata.title).toBe('Package Manager Blues');
  });

  it('binds torrent job files (PR #133) with buffering, seeking, and destruction', () => {
    const service = createMockMediaService({ clock });
    const { sent, send } = sink();
    service.handleMessage('w1', msg({ type: 'media.session.create', id: 'tm1', owner: 'shell', source: { torrent: { jobId: 'debian-12-netinst', fileIndex: 0 } }, autoplay: true }), send);
    service.handleMessage('w1', msg({ type: 'media.command', sessionId: 'media-1', action: 'seek', value: 120 }), send);
    service.handleMessage('w1', msg({ type: 'media.command', sessionId: 'media-1', action: 'pause' }), send);
    service.handleMessage('w1', msg({ type: 'media.session.destroy', sessionId: 'media-1' }), send);
    service.handleMessage('w1', msg({ type: 'media.command', sessionId: 'media-1', action: 'play' }), send);
    expect(sent).toEqual([
      { type: 'media.session.create.result', id: 'tm1', sessionId: 'media-1', owner: 'shell' },
      { type: 'media.controls', sessionId: 'media-1', controls: SHELL_CONTROLS },
      { type: 'media.capabilities', sessionId: 'media-1', actions: ['play', 'pause', 'stop', 'seek', 'volume'] },
      { type: 'media.state', sessionId: 'media-1', status: 'buffering' },
      { type: 'media.state', sessionId: 'media-1', status: 'playing', position: 0, volume: 1, duration: 631 },
      { type: 'media.state', sessionId: 'media-1', status: 'buffering', position: 120 },
      { type: 'media.state', sessionId: 'media-1', status: 'playing', position: 120, volume: 1, duration: 631 },
      { type: 'media.state', sessionId: 'media-1', status: 'paused', position: 120, volume: 1, duration: 631, reason: 'user' },
      { type: 'media.session.ended', sessionId: 'media-1', reason: 'destroyed' },
    ]);
  });

  it('leaves an admitted torrent session paused without autoplay and retires it on job removal', () => {
    const service = createMockMediaService();
    const { sent, send } = sink();
    service.handleMessage('w1', msg({ type: 'media.session.create', id: 'tm2', owner: 'shell', source: { torrent: { jobId: 'arch-2024-11', fileIndex: 0 } } }), send);
    expect(sent.at(-1)).toEqual({ type: 'media.state', sessionId: 'media-1', status: 'paused', position: 0, volume: 1, duration: 1180 });
    service.removeTorrentJob('arch-2024-11');
    expect(sent.at(-1)).toEqual({ type: 'media.session.ended', sessionId: 'media-1', reason: 'source-unavailable' });
    expect(service.mock.state().sessions.size).toBe(0);
    expect(service.mock.state().torrentJobs.has('arch-2024-11')).toBe(false);
  });

  it('rejects malformed, blocked, and unresolvable sources with NAP error strings', () => {
    const service = createMockMediaService({ autoplayPolicy: 'deny', torrentJobs: { 'fedora-41-workstation': { ready: false }, 'alpine-3-20-standard': { selected: false } } });
    const { sent, send } = sink();
    const create = (id: string, fields: Record<string, unknown>) => service.handleMessage('w1', msg({ type: 'media.session.create', id, ...fields }), send);
    create('e1', {});
    create('e2', { owner: 'shell' });
    create('e3', { owner: 'shell', source: { url: TRACK.url, torrent: { jobId: 'debian-12-netinst', fileIndex: 0 } } });
    create('e4', { owner: 'shell', source: { torrent: { jobId: 'debian-12-netinst', fileIndex: 0 } }, live: true });
    create('e5', { owner: 'shell', source: { torrent: { jobId: 'debian-12-netinst', fileIndex: 3 } } });
    create('e6', { owner: 'shell', source: { torrent: { jobId: 'other-job', fileIndex: 0 } } });
    create('e7', { owner: 'shell', source: { torrent: { jobId: 'fedora-41-workstation', fileIndex: 0 } } });
    create('e8', { owner: 'shell', source: { torrent: { jobId: 'alpine-3-20-standard', fileIndex: 0 } } });
    create('e9', { owner: 'shell', source: { nostr: { eventId: 'abc' } } });
    create('e10', { owner: 'shell', source: { url: 'http://media.example.org/plain.mp3' } });
    create('e11', { owner: 'shell', source: { url: TRACK.url }, autoplay: true });
    create('e12', { owner: 'napplet', sessionId: 'has spaces' });
    expect(sent).toEqual([
      { type: 'media.session.create.result', id: 'e1', error: 'missing owner' },
      { type: 'media.session.create.result', id: 'e2', owner: 'shell', error: 'missing source' },
      { type: 'media.session.create.result', id: 'e3', owner: 'shell', error: 'invalid source' },
      { type: 'media.session.create.result', id: 'e4', owner: 'shell', error: 'invalid source' },
      { type: 'media.session.create.result', id: 'e5', owner: 'shell', error: 'invalid source' },
      { type: 'media.session.create.result', id: 'e6', owner: 'shell', error: 'source not found' },
      { type: 'media.session.create.result', id: 'e7', owner: 'shell', error: 'source not ready' },
      { type: 'media.session.create.result', id: 'e8', owner: 'shell', error: 'source blocked' },
      { type: 'media.session.create.result', id: 'e9', owner: 'shell', error: 'unsupported source' },
      { type: 'media.session.create.result', id: 'e10', owner: 'shell', error: 'source blocked' },
      { type: 'media.session.create.result', id: 'e11', owner: 'shell', error: 'autoplay denied' },
      { type: 'media.session.create.result', id: 'e12', owner: 'napplet', error: 'invalid session ID' },
    ]);
    expect(service.mock.state().sessions.size).toBe(0);
  });

  it('enforces the per-window session limit and never reuses retired ids', () => {
    const service = createMockMediaService({ maxSessionsPerWindow: 1 });
    const { sent, send } = sink();
    service.handleMessage('w1', msg({ type: 'media.session.create', id: 'a', owner: 'napplet', sessionId: 's1' }), send);
    service.handleMessage('w1', msg({ type: 'media.session.create', id: 'b', owner: 'napplet', sessionId: 's2' }), send);
    expect(sent.at(-1)).toEqual({ type: 'media.session.create.result', id: 'b', owner: 'napplet', error: 'session limit exceeded' });
    service.handleMessage('w1', msg({ type: 'media.session.destroy', sessionId: 's1' }), send);
    service.handleMessage('w1', msg({ type: 'media.session.create', id: 'c', owner: 'napplet', sessionId: 's1' }), send);
    expect(sent.at(-2)).toEqual({ type: 'media.session.create.result', id: 'c', sessionId: 'media-1', owner: 'napplet' });
  });

  it('records napplet-owned state and capabilities and relays shell commands', () => {
    const service = createMockMediaService();
    const { sent, send } = sink();
    service.handleMessage('w1', msg({ type: 'media.session.create', id: 'a', owner: 'napplet', sessionId: 's1' }), send);
    service.handleMessage('w1', msg({ type: 'media.capabilities', sessionId: 's1', actions: ['play', 'pause', 'seek'] }), send);
    service.handleMessage('w1', msg({ type: 'media.state', sessionId: 's1', status: 'playing', position: 42.5, duration: 240, volume: 0.8, reason: 'user' }), send);
    service.handleMessage('w1', msg({ type: 'media.state', sessionId: 's1', status: 'bogus' }), send);
    service.handleMessage('w1', msg({ type: 'media.session.update', sessionId: 's1', metadata: { title: 'Updated Title' } }), send);
    service.handleMessage('w2', msg({ type: 'media.session.update', sessionId: 's1', metadata: { title: 'Hijack' } }), send);
    const session = service.mock.state().sessions.get('s1')!;
    expect(session.actions).toEqual(['play', 'pause', 'seek']);
    expect(session.state).toEqual({ status: 'playing', position: 42.5, duration: 240, volume: 0.8, reason: 'user' });
    expect(session.metadata).toEqual({ title: 'Updated Title' });
    sent.length = 0;
    service.command('s1', { action: 'pause', reason: 'focus-lost' });
    service.command('s1', { action: 'volume', value: 0.5 });
    service.command('s1', { action: 'seek' });
    expect(sent).toEqual([{ type: 'media.command', sessionId: 's1', action: 'pause', reason: 'focus-lost' }]);
  });

  it('retires sessions on preemption and capability revocation, ignoring late commands', () => {
    const { service, sent, send } = createShell();
    const { sent: other, send: sendOther } = sink();
    service.handleMessage('w2', msg({ type: 'media.session.create', id: 'b', owner: 'napplet', sessionId: 's2' }), sendOther);
    sent.length = 0;
    service.retire('media-1');
    service.handleMessage('w1', msg({ type: 'media.command', sessionId: 'media-1', action: 'play' }), send);
    expect(sent).toEqual([{ type: 'media.session.ended', sessionId: 'media-1', reason: 'preempted' }]);
    service.onCapabilityRevoked?.('w2', 'media:control');
    expect(other.at(-1)).toEqual({ type: 'media.session.ended', sessionId: 's2', reason: 'policy' });
    expect(service.mock.state().sessions.size).toBe(0);
  });

  it('runs the tickMs loop through the scheduler and cancels it on reset', () => {
    const queued: Array<() => void> = [];
    let cancelled = 0;
    const scheduler: MockScheduler = { schedule: (_ms, fn) => { queued.push(fn); return () => { cancelled += 1; }; } };
    const { service, sent } = createShell(createMockMediaService({ clock, scheduler, tickMs: 1000 }));
    expect(queued).toHaveLength(1);
    queued.shift()!();
    expect(sent.at(-1)).toMatchObject({ type: 'media.state', status: 'playing', position: 1 });
    expect(queued).toHaveLength(1);
    service.mock.reset();
    expect(cancelled).toBe(1);
    expect(service.mock.state().sessions.size).toBe(0);
    expect(service.mock.sent).toEqual([]);
  });

  it('cleans a destroyed window without notifying it', () => {
    const { service, sent, send } = createShell();
    service.handleMessage('w1', msg({ type: 'media.session.create', id: 'b', owner: 'napplet', sessionId: 's2' }), send);
    sent.length = 0;
    service.onWindowDestroyed?.('w1');
    expect(sent).toEqual([]);
    expect(service.mock.state().sessions.size).toBe(0);
    expect(service.mock.state().usedIds.has('w1')).toBe(false);
  });
});
