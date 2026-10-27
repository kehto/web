import type { NappletMessage } from '@napplet/core';
import type { ServiceHandler } from '@kehto/runtime';
import type { MediaAction } from '@napplet/nap/media/types';
import type { MediaSessionCreateOptions } from './media-service.js';
import { validMediaCommand } from './media-playback.js';
import type { MediaPlayback, MediaPlaybackBackend, MediaPlaybackState } from './media-playback.js';

/** Browser playback dependencies; the resource service owns source policy. */
export interface BrowserMediaPlaybackOptions {
  resource: ServiceHandler;
  document?: Document;
  urls?: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>;
}

function readSource(resource: ServiceHandler, windowId: string, url: string, signal: AbortSignal): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const id = `media-resource-${crypto.randomUUID()}`;
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); };
    const abort = () => {
      cleanup();
      resource.handleMessage(windowId, { type: 'resource.cancel', id } as NappletMessage, () => {});
      reject(new Error('media source cancelled'));
    };
    const timer = setTimeout(abort, 25_000);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) return abort();
    try {
      resource.handleMessage(windowId, { type: 'resource.bytes', id, url } as NappletMessage, message => {
        const result = message as NappletMessage & { blob?: Blob; id?: string };
        if (result.id !== id || signal.aborted) return;
        cleanup();
        if (result.type === 'resource.bytes.result' && result.blob instanceof Blob) resolve(result.blob);
        else reject(new Error('media source blocked or unavailable'));
      });
    } catch (error) { cleanup(); reject(error); }
  });
}

function sourceUrl(options: MediaSessionCreateOptions): string {
  const source = options.source;
  if (typeof source?.url === 'string' && source.url) return source.url;
  if (typeof source?.blossomHash === 'string' && /^[a-f0-9]{64}$/i.test(source.blossomHash)) return `blossom:${source.blossomHash}`;
  throw new Error('unsupported source');
}

function attachPlayback(
  element: HTMLMediaElement,
  live: boolean,
  release: () => void,
  changed: (state: MediaPlaybackState, actions: readonly MediaAction[]) => void,
): MediaPlayback {
  let retired = false;
  let generation = 0;
  let state: MediaPlaybackState = { status: 'paused', position: 0, volume: element.volume };
  const actions = (): MediaAction[] => [
    'play', 'pause', 'stop', 'volume',
    ...(!live && Number.isFinite(element.duration) && element.duration > 0 ? ['seek' as const] : []),
  ];
  const publish = (status = state.status, reason?: string) => {
    if (retired) return;
    state = {
      status, position: element.currentTime, volume: element.volume,
      ...(Number.isFinite(element.duration) ? { duration: element.duration } : {}),
      ...(reason ? { reason } : {}),
    };
    changed({ ...state }, actions());
  };
  const handlers: Record<string, () => void> = {
    playing: () => publish('playing'),
    pause: () => { if (state.status !== 'stopped') publish('paused'); },
    waiting: () => publish('buffering'),
    ended: () => { generation++; publish('stopped', 'ended'); },
    error: () => { generation++; publish('stopped', 'error'); },
    timeupdate: () => publish(),
    durationchange: () => publish(),
    loadedmetadata: () => publish(),
    volumechange: () => publish(),
    seeked: () => publish(),
  };
  for (const [event, handler] of Object.entries(handlers)) element.addEventListener(event, handler);
  return {
    element,
    get state() { return { ...state }; },
    get actions() { return actions(); },
    command(command) {
      if (retired || !validMediaCommand(command, actions())) return;
      const token = ++generation;
      switch (command.action) {
        case 'play':
          void element.play().then(() => {
            if (!retired && token === generation) publish('playing', command.reason);
          }).catch(() => {
            if (!retired && token === generation) publish('paused', 'error');
          });
          break;
        case 'pause': element.pause(); publish('paused', command.reason); break;
        case 'stop':
          element.pause();
          element.currentTime = 0;
          publish('stopped', command.reason);
          break;
        case 'seek': element.currentTime = Math.min(command.value!, element.duration); publish(); break;
        case 'volume': element.volume = command.value!; publish(); break;
      }
    },
    destroy() {
      if (retired) return;
      retired = true;
      generation++;
      for (const [event, handler] of Object.entries(handlers)) element.removeEventListener(event, handler);
      element.pause();
      element.removeAttribute('src');
      element.load();
      element.remove();
      release();
    },
  };
}

/**
 * Play policy-approved resource bytes using browser audio/video elements.
 * Remote URLs never reach media elements; only revocable Blob URLs do.
 * @param options - Host resource service and optional browser test dependencies.
 * @returns A backend for createMediaService's playback option.
 * @example
 * ```ts
 * const playback = createBrowserMediaPlayback({ resource });
 * const media = createMediaService({ playback });
 * ```
 */
export function createBrowserMediaPlayback(options: BrowserMediaPlaybackOptions): MediaPlaybackBackend {
  const doc = options.document ?? document;
  const urls = options.urls ?? URL;
  return {
    async open(windowId, request, signal, changed) {
      const blob = await readSource(options.resource, windowId, sourceUrl(request), signal);
      if (signal.aborted) throw new Error('media source cancelled');
      if (!/^(audio|video)\//.test(blob.type)) throw new Error('unsupported media type');
      const element = doc.createElement(blob.type.startsWith('video/') ? 'video' : 'audio');
      element.preload = 'metadata';
      if (element instanceof HTMLVideoElement) element.playsInline = true;
      const url = urls.createObjectURL(blob);
      const playback = attachPlayback(element, request.live === true, () => urls.revokeObjectURL(url), changed);
      const abort = () => playback.destroy();
      signal.addEventListener('abort', abort, { once: true });
      try {
        element.src = url;
        element.load();
        if (request.autoplay) await element.play();
        if (signal.aborted) throw new Error('media source cancelled');
        return playback;
      } catch (error) {
        playback.destroy();
        throw error;
      } finally { signal.removeEventListener('abort', abort); }
    },
  };
}
