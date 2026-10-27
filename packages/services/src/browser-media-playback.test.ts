import { describe, expect, it, vi } from 'vitest';
import type { ServiceHandler } from '@kehto/runtime';
import type { NappletMessage } from '@napplet/core';
import { createBrowserMediaPlayback } from './browser-media-playback.js';

function fixture(mime = 'audio/wav') {
  const element = Object.assign(new EventTarget(), {
    tagName: mime.startsWith('video') ? 'VIDEO' : 'AUDIO',
    src: '', duration: 12, currentTime: 0, volume: 1, paused: true,
    ended: false, buffered: { length: 0, start: () => 3 },
    canPlayType: vi.fn(() => 'probably'),
    play: vi.fn(async () => { element.paused = false; element.dispatchEvent(new Event('playing')); }),
    pause: vi.fn(() => { element.paused = true; element.dispatchEvent(new Event('pause')); }),
    load: vi.fn(() => element.dispatchEvent(new Event('loadedmetadata'))),
    remove: vi.fn(), removeAttribute: vi.fn(() => { element.src = ''; }),
  });
  const doc = { createElement: vi.fn(() => element as unknown as HTMLMediaElement) } as unknown as Document;
  const urls = { createObjectURL: vi.fn(() => 'blob:media-proof'), revokeObjectURL: vi.fn() };
  const requests: { windowId: string; message: NappletMessage }[] = [];
  const resource: ServiceHandler = {
    descriptor: { name: 'resource', version: '1' },
    handleMessage(windowId, message, send) {
      requests.push({ windowId, message });
      if (message.type === 'resource.bytes') send({ type: 'resource.bytes.result', id: (message as NappletMessage & { id: string }).id, blob: new Blob(['test'], { type: mime }) } as NappletMessage);
    },
  };
  const backend = createBrowserMediaPlayback({ resource, document: doc, urls });
  return { element, doc, urls, requests, resource, backend };
}

describe('policy-mediated browser playback', () => {
  it('passes endpoint identity through resource policy and releases output exactly once', async () => {
    const f = fixture(); const changed = vi.fn();
    const playback = await f.backend.open('source-window', { owner: 'shell', source: { blossomHash: 'a'.repeat(64) } }, new AbortController().signal, changed);
    expect(f.requests[0]).toMatchObject({ windowId: 'source-window', message: { type: 'resource.bytes', url: `blossom:${'a'.repeat(64)}` } });
    expect(f.element.src).toBe('blob:media-proof');
    expect(playback.actions).toContain('seek');
    playback.command({ action: 'seek', value: 99 });
    expect(f.element.currentTime).toBe(12);
    playback.command({ action: 'volume', value: 3 });
    expect(f.element.volume).toBe(1);
    playback.command({ action: 'play', reason: 'user' });
    await Promise.resolve();
    expect(playback.state.status).toBe('playing');
    f.element.dispatchEvent(new Event('ended'));
    expect(playback.state).toMatchObject({ status: 'stopped', reason: 'ended' });
    playback.destroy(); playback.destroy();
    changed.mockClear();
    f.element.dispatchEvent(new Event('playing'));
    playback.command({ action: 'play' });
    expect(changed).not.toHaveBeenCalled();
    expect(f.urls.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:media-proof');
    expect(f.element.src).toBe('');
    expect(f.element.paused).toBe(true);
  });

  it('uses classified video bytes and suppresses live seeking', async () => {
    const f = fixture('video/webm');
    const playback = await f.backend.open('w', { owner: 'shell', live: true, source: { url: 'https://example.com/media', mimeType: 'audio/wav' } }, new AbortController().signal, () => {});
    expect(f.doc.createElement).toHaveBeenCalledWith('video');
    expect(playback.actions).not.toContain('seek');
    playback.command({ action: 'seek', value: 10 });
    expect(f.element.currentTime).toBe(0);
    f.element.currentTime = 6;
    playback.command({ action: 'stop' });
    expect(f.element.currentTime).toBe(6);
    f.element.buffered.length = 1;
    f.element.ended = true;
    playback.command({ action: 'play' });
    expect(f.element.currentTime).toBe(3);
    playback.destroy();
  });

  it('rejects non-media bytes and unsupported source references without allocating output', async () => {
    const f = fixture('text/html');
    await expect(f.backend.open('w', { owner: 'shell', source: { url: 'https://example.com/page' } }, new AbortController().signal, () => {})).rejects.toThrow('unsupported media type');
    await expect(f.backend.open('w', { owner: 'shell', source: { nostr: { eventId: 'b'.repeat(64) } } }, new AbortController().signal, () => {})).rejects.toThrow('unsupported source');
    expect(f.urls.createObjectURL).not.toHaveBeenCalled();
    expect(f.requests).toHaveLength(1);
  });

  it('cleans up on decoding failure and autoplay denial', async () => {
    const f = fixture();
    f.element.load.mockImplementationOnce(() => f.element.dispatchEvent(new Event('error')));
    await expect(f.backend.open('w', { owner: 'shell', source: { url: 'https://example.com/broken' } }, new AbortController().signal, () => {})).rejects.toThrow('decoding failed');
    expect(f.urls.revokeObjectURL).toHaveBeenCalledTimes(1);
    f.element.play.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
    await expect(f.backend.open('w', { owner: 'shell', autoplay: true, source: { url: 'https://example.com/good' } }, new AbortController().signal, () => {})).rejects.toThrow('denied');
    expect(f.urls.revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it('cancels the matching resource request when the endpoint disappears', async () => {
    const f = fixture();
    const messages: NappletMessage[] = [];
    f.resource.handleMessage = (_windowId, message) => { messages.push(message); };
    const abort = new AbortController();
    const pending = f.backend.open('w', { owner: 'shell', source: { url: 'https://example.com/slow' } }, abort.signal, () => {});
    abort.abort();
    await expect(pending).rejects.toThrow('cancelled');
    expect(messages[1]).toEqual({ type: 'resource.cancel', id: (messages[0] as NappletMessage & { id: string }).id });
    expect(f.urls.createObjectURL).not.toHaveBeenCalled();
  });
});
