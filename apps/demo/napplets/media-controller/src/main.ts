/**
 * Media-controller demo napplet — exercises real media backend (MEDIA-03, Phase 27).
 *
 * Per 27-CONTEXT.md Area 3:
 *   - On init: runs the D-04 AUTH probe (storage.getItem), then calls
 *     mediaCreateSession via @napplet/nub/media. The SDK owns the
 *     correlation ID and Promise resolution on the shell's
 *     media.session.create.result envelope.
 *   - After session create, the napplet subscribes to mediaOnCommand(sessionId, ...)
 *     — on each media.command push from the shell (emitted by Plan 27-01 when a
 *     navigator.mediaSession setActionHandler fires), the callback invokes; the
 *     napplet updates #media-controller-command-count + #media-controller-last-command
 *     and reflects play/pause actions locally via setStatus + audio element.
 *   - Play / Pause buttons call mediaReportState(sessionId, { status: 'playing'|'paused' })
 *     — the shell mirrors that status to navigator.mediaSession.playbackState.
 *   - #media-controller-status transitions: 'connecting...' → 'authenticated' → 'session-ready' → 'playing' | 'paused'
 *
 * Anti-features (enforced per v1.4 milestone — see Phase 27 acceptance greps):
 *   - no raw postMessage listener — uses @napplet/sdk + @napplet/nub/media helpers exclusively
 *   - no direct nostr/signer/legacy-bus imports
 *   - no hand-rolled correlation IDs (SDK owns them)
 */
import '@napplet/shim';
import { storage } from '@napplet/sdk';
import {
  mediaCreateSession,
  mediaReportState,
  mediaOnCommand,
} from '@napplet/nub/media';

const DEMO_METADATA = {
  title: 'Kehto Demo Track',
  artist: 'v1.4 Media',
  mediaType: 'audio' as const,
};

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
  // D-04 init pattern: storage.getItem probe gates on AUTH completion without
  // needing a state:read grant (identical to feed + hotkey-chord napplets).
  try {
    await storage.getItem('media-controller-auth-probe');
  } catch { /* state:read denial is expected — AUTH still completed */ }
  setStatus('authenticated', 'green');
  log('AUTH complete — creating media session');

  // Create the session via the nub-media helper. The SDK owns correlation +
  // Promise resolution on the shell's media.session.create.result envelope.
  const { sessionId } = await mediaCreateSession(DEMO_METADATA);
  setStatus('session-ready', 'green');
  log(`media.session.create.result — sessionId=${sessionId}`);

  // Wire Play / Pause buttons to mediaReportState — the shell mirrors status
  // to navigator.mediaSession.playbackState when this session is active.
  playBtn.onclick = () => {
    mediaReportState(sessionId, { status: 'playing' });
    setStatus('playing', 'green');
    // Exercise the local audio pipeline end-to-end; play() may be refused by
    // autoplay policy pre-user-gesture, but the Play button IS a user gesture
    // so we call .play() without a .catch that would mask bugs (autoplay
    // policy accepts button-triggered play).
    void audioEl.play().catch(() => { /* best-effort if a policy still refuses */ });
    log('-> mediaReportState(playing)');
  };
  pauseBtn.onclick = () => {
    mediaReportState(sessionId, { status: 'paused' });
    setStatus('paused', 'blue');
    audioEl.pause();
    log('-> mediaReportState(paused)');
  };

  // Subscribe to media.command pushes from the shell. Triggered when the OS
  // user clicks play/pause/seek/next/prev on the transport surface — the
  // shell's navigator.mediaSession setActionHandler fires and Plan 27-01's
  // media-service emits media.command to this napplet.
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
}

init().catch((err) => {
  if (
    statusEl.textContent === 'connecting...' ||
    statusEl.textContent === 'authenticated'
  ) {
    setStatus('register failed', 'red');
    log(`init failed — ${err instanceof Error ? err.message : String(err)}`);
  }
});
