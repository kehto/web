import type { MediaAction, MediaMetadata, MediaSessionContext, MediaState } from '@napplet/nap/media/types';
import type { ServiceHandler } from '@kehto/runtime';
import type { MediaSessionCreateOptions } from './media-service.js';

/** Playback state including NAP-MEDIA draft transition reasons. */
export interface MediaPlaybackState extends MediaState { reason?: string }
/** A command never changes session ownership. */
export interface MediaPlaybackCommand { action: MediaAction; value?: number; reason?: string }
/** Host-visible session snapshot. Source bytes and URLs remain private. */
export interface MediaSessionSnapshot {
  sessionId: string;
  windowId: string;
  owner: 'shell' | 'napplet';
  metadata?: MediaMetadata;
  context?: MediaSessionContext;
  state?: MediaPlaybackState;
  actions: readonly MediaAction[];
}
/** One host-owned audio/video output, released on retirement. */
export interface MediaPlayback {
  readonly element?: HTMLMediaElement;
  readonly state: MediaPlaybackState;
  readonly actions: readonly MediaAction[];
  command(command: MediaPlaybackCommand): void;
  destroy(): void;
}
/** Backend resolves sources through host resource policy before returning playback. */
export interface MediaPlaybackBackend {
  open(windowId: string, options: MediaSessionCreateOptions, signal: AbortSignal,
    changed: (state: MediaPlaybackState, actions: readonly MediaAction[]) => void): Promise<MediaPlayback>;
}
/** Service plus host controls and observable snapshots for a player surface. */
export interface MediaService extends ServiceHandler {
  getSessions(): readonly MediaSessionSnapshot[];
  subscribe(listener: (sessions: readonly MediaSessionSnapshot[]) => void): () => void;
  command(sessionId: string, command: MediaPlaybackCommand): void;
  retire(sessionId: string, reason?: string): void;
  getElement(sessionId: string): HTMLMediaElement | undefined;
  destroy(): void;
}

/** Validate commands at both wire and host-control boundaries. */
export function validMediaCommand(command: MediaPlaybackCommand, actions: readonly MediaAction[]): boolean {
  if (!actions.includes(command.action)) return false;
  if (command.action !== 'seek' && command.action !== 'volume') return true;
  return typeof command.value === 'number' && Number.isFinite(command.value)
    && command.value >= 0 && (command.action !== 'volume' || command.value <= 1);
}
