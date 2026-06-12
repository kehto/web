/**
 * Media-controller demo napplet — exercises real media backend (MEDIA-03, Phase 27).
 *
 * Per 27-CONTEXT.md Area 3:
 *   - On init: calls mediaCreateSession({ owner: 'napplet', ... }) through the
 *     published @napplet/nub media helper surface.
 *   - After session create, the napplet subscribes to mediaOnCommand(sessionId, ...)
 *     — on each media.command push from the shell (emitted by Plan 27-01 when a
 *     navigator.mediaSession setActionHandler fires), the callback invokes; the
 *     napplet updates #media-controller-command-count + #media-controller-last-command
 *     and reflects play/pause actions locally via setStatus + audio element.
 *   - Play / Pause buttons call mediaReportState(sessionId, { status: 'playing'|'paused' })
 *     — the shell mirrors that status to navigator.mediaSession.playbackState.
 *   - #media-controller-status transitions: 'connecting...' → 'session-ready' → 'playing' | 'paused'
 *
 * Anti-features (enforced per v1.4 milestone — see Phase 27 acceptance greps):
 *   - no raw media.session.create envelope plumbing
 *   - no direct nostr/signer/legacy-bus imports
 *   - no hand-rolled correlation IDs (helper owns them)
 *
 * Subpath selection rationale (v1.6 Phase 32 fix): imports the pure SDK helpers
 * from `@napplet/nub/media/sdk`, NOT the root `@napplet/nub/media` subpath. The
 * root subpath has a `registerNub(DOMAIN, ...)` side effect at module-init time
 * that collides with `@napplet/shim`'s own registration of the "media" domain,
 * throwing `NAP domain "media" is already registered` and stalling init().
 * The `/sdk` subpath re-exports the same helpers with zero side effects.
 */
import '@napplet/shim';
import { installNapTheme } from '../../shared-theme';
import {
  mediaCreateSession,
  mediaReportState,
  mediaOnCommand,
} from '@napplet/nub/media/sdk';
import type { MediaAction } from '@napplet/nub/media/types';

const REQUIRED_NAPS = ['media', 'theme'] as const;

const DEMO_METADATA = {
  title: 'Kehto Demo Track',
  artist: 'v1.4 Media',
  mediaType: 'audio' as const,
};
const DEMO_CAPABILITIES: MediaAction[] = ['play', 'pause'];

const statusEl = document.getElementById('media-controller-status')!;
const playBtn = document.getElementById('media-controller-play')! as HTMLButtonElement;
const pauseBtn = document.getElementById('media-controller-pause')! as HTMLButtonElement;
const countEl = document.getElementById('media-controller-command-count')!;
const lastEl = document.getElementById('media-controller-last-command')!;
const logEl = document.getElementById('media-controller-log')!;
const audioEl = document.getElementById('media-controller-audio')! as HTMLAudioElement;

function setStatus(text: string, color: 'gray' | 'green' | 'blue' | 'red' = 'gray'): void {
  statusEl.textContent = text;
  statusEl.style.color =
    color === 'green' ? '#39ff14'
    : color === 'blue' ? '#5a7aff'
    : color === 'red' ? '#ff3b3b'
    : '#888';
}

function getMissingRequiredNaps(): string[] {
  const supports = window.napplet.shell.supports;
  return REQUIRED_NAPS.filter((capability) => !supports(capability));
}

function log(text: string): void {
  const div = document.createElement('div');
  div.className = 'media-log-entry';
  const time = new Date().toLocaleTimeString('en', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  div.textContent = `${time} ${text}`;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}

let commandCount = 0;

async function init(): Promise<void> {
  const missing = getMissingRequiredNaps();
  if (missing.length > 0) {
    throw new Error(`unsupported NAP capability: ${missing.join(', ')}`);
  }
  installNapTheme();

  log('creating media session');

  const createResult = await mediaCreateSession({
    owner: 'napplet',
    metadata: DEMO_METADATA,
    capabilities: DEMO_CAPABILITIES,
  });
  if (createResult.error) {
    throw new Error(createResult.error);
  }
  if (createResult.owner !== 'napplet' || !createResult.sessionId) {
    throw new Error('media.session.create.result missing napplet-owned session id');
  }
  const { sessionId } = createResult;

  // Wire Play / Pause buttons to mediaReportState — the shell mirrors status
  // to navigator.mediaSession.playbackState when this session is active.
  playBtn.onclick = () => {
    mediaReportState(sessionId, { status: 'playing' });
    setStatus('playing', 'green');
    void audioEl.play().catch(() => { /* best-effort if a policy still refuses */ });
    log('-> mediaReportState(playing)');
  };
  pauseBtn.onclick = () => {
    mediaReportState(sessionId, { status: 'paused' });
    setStatus('paused', 'blue');
    audioEl.pause();
    log('-> mediaReportState(paused)');
  };

  mediaOnCommand(sessionId, (action, value) => {
    commandCount += 1;
    countEl.textContent = String(commandCount);
    lastEl.textContent = action;
    log(`media.command received — action=${action}${value !== undefined ? ` value=${value}` : ''}`);
    // Reflect the shell-initiated action in the napplet's local state so the
    // UI stays in sync with OS transport clicks.
    if (action === 'play') {
      setStatus('playing', 'green');
      void audioEl.play().catch(() => {});
    } else if (action === 'pause') {
      setStatus('paused', 'blue');
      audioEl.pause();
    }
  });

  setStatus('session-ready', 'green');
  log(`media.session.create.result — sessionId=${sessionId}`);
}

init().catch((err) => {
  if (
    statusEl.textContent === 'connecting...'
  ) {
    setStatus('register failed', 'red');
    log(`init failed — ${err instanceof Error ? err.message : String(err)}`);
  }
});
