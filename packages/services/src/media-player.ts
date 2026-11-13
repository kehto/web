import type { MediaAction } from '@napplet/nap/media/types';
import type { MediaService, MediaSessionSnapshot } from './media-playback.js';

const PLAYER_STYLE = `
:host { position:fixed; right:16px; bottom:48px; z-index:10000; width:min(360px,calc(100vw - 32px)); color-scheme:dark; font:14px/1.4 system-ui,sans-serif; color:#f4f0df; }
:host([hidden]) { display:none; }
details { background:#171b1b; border:1px solid #68716c; border-radius:12px; box-shadow:0 6px 24px #0006; }
summary { padding:12px 16px; cursor:pointer; font-weight:600; }
.sessions { max-height:60vh; overflow:auto; padding:0 12px 12px; }
article { border-top:1px solid #49514d; padding-top:12px; margin-top:4px; }
h3,p { margin:0 0 6px; overflow-wrap:anywhere; }
p { color:#c7cdc9; font-size:12px; }
.buttons { display:flex; gap:6px; flex-wrap:wrap; margin:8px 0; }
button { padding:8px 10px; border:1px solid #68716c; border-radius:6px; color:inherit; background:#29312c; cursor:pointer; min-height:40px; }
button:disabled { opacity:.5; cursor:default; }
button:focus-visible, input:focus-visible, summary:focus-visible { outline:2px solid #e9d584; outline-offset:3px; }
label { display:flex; align-items:center; gap:8px; margin:8px 0; }
input { flex:1; min-width:0; accent-color:#e9d584; }
video { display:block; width:100%; max-height:240px; background:#000; border-radius:6px; }
audio { display:none; }
`;

interface PlayerRow {
  root: HTMLElement;
  title: HTMLElement;
  detail: HTMLElement;
  status: HTMLElement;
  buttons: Map<MediaAction, HTMLButtonElement>;
  seek: HTMLInputElement;
  volume: HTMLInputElement;
  media: HTMLElement;
}

function time(value = 0): string {
  const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function makeRow(doc: Document, service: MediaService, sessionId: string): PlayerRow {
  const root = doc.createElement('article');
  root.dataset.sessionId = sessionId;
  const title = doc.createElement('h3');
  const detail = doc.createElement('p');
  const status = doc.createElement('p');
  const media = doc.createElement('div');
  const controls = doc.createElement('div');
  controls.className = 'buttons';
  const buttons = new Map<MediaAction, HTMLButtonElement>();
  for (const [action, text] of [['prev', 'Previous'], ['play', 'Play'], ['pause', 'Pause'], ['stop', 'Stop'], ['next', 'Next']] as const) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.onclick = () => service.command(sessionId, { action, reason: 'user' });
    controls.append(button);
    buttons.set(action, button);
  }
  const close = doc.createElement('button');
  close.type = 'button';
  close.textContent = 'Close session';
  close.onclick = () => service.retire(sessionId, 'user');
  controls.append(close);
  const range = (name: string, action: 'seek' | 'volume', max: string, step: string) => {
    const label = doc.createElement('label');
    label.append(name);
    const input = doc.createElement('input');
    input.type = 'range'; input.min = '0'; input.max = max; input.step = step;
    input.setAttribute('aria-label', name);
    input.onchange = () => service.command(sessionId, { action, value: Number(input.value), reason: 'user' });
    label.append(input);
    return { label, input };
  };
  const seek = range('Position', 'seek', '0', '0.1');
  const volume = range('Volume', 'volume', '1', '0.01');
  root.append(title, detail, media, status, controls, seek.label, volume.label);
  return { root, title, detail, status, buttons, seek: seek.input, volume: volume.input, media };
}

function updateRow(row: PlayerRow, session: MediaSessionSnapshot, service: MediaService): void {
  row.title.textContent = session.metadata?.title || 'Untitled media';
  row.detail.textContent = [session.metadata?.artist, session.metadata?.album, session.context?.label, session.context?.detail].filter(Boolean).join(' · ');
  const state = session.state;
  row.status.textContent = `${state?.status ?? 'Ready'} · ${time(state?.position)} / ${time(state?.duration ?? session.metadata?.duration)}${state?.reason === 'error' ? ' · Playback failed. Try Play again.' : ''}`;
  for (const [action, button] of row.buttons) {
    button.hidden = !session.actions.includes(action)
      || (action === 'play' && state?.status === 'playing')
      || (action === 'pause' && state?.status !== 'playing' && state?.status !== 'buffering');
  }
  row.seek.disabled = !session.actions.includes('seek');
  row.seek.max = String(state?.duration ?? session.metadata?.duration ?? 0);
  row.volume.disabled = !session.actions.includes('volume');
  if (row.seek.getRootNode() instanceof ShadowRoot && (row.seek.getRootNode() as ShadowRoot).activeElement !== row.seek) row.seek.value = String(state?.position ?? 0);
  if (row.volume.getRootNode() instanceof ShadowRoot && (row.volume.getRootNode() as ShadowRoot).activeElement !== row.volume) row.volume.value = String(state?.volume ?? 1);
  const element = service.getElement(session.sessionId);
  if (element && element.parentElement !== row.media) row.media.append(element);
}

/**
 * Mount accessible host controls for all media sessions, including video output.
 * The panel is hidden when empty and collapsible while playback continues.
 * @param service - Media service owning playback and session commands.
 * @param container - Host container; defaults to document.body.
 * @returns Cleanup for the UI subscription and mounted panel.
 * @example
 * ```ts
 * const unmount = mountMediaPlayer(media);
 * // On host teardown: unmount(); media.destroy();
 * ```
 */
export function mountMediaPlayer(service: MediaService, container: HTMLElement = document.body): () => void {
  const doc = container.ownerDocument;
  const host = doc.createElement('section');
  host.dataset.kehtoMediaPlayer = '';
  host.setAttribute('aria-label', 'Media player');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style'); style.textContent = PLAYER_STYLE;
  const details = doc.createElement('details'); details.open = true;
  const summary = doc.createElement('summary'); summary.textContent = 'Media player';
  const sessions = doc.createElement('div'); sessions.className = 'sessions';
  details.append(summary, sessions); shadow.append(style, details); container.append(host);
  const rows = new Map<string, PlayerRow>();
  const off = service.subscribe(snapshots => {
    host.hidden = snapshots.length === 0;
    summary.textContent = `Media player (${snapshots.length})`;
    const live = new Set(snapshots.map(session => session.sessionId));
    for (const [id, row] of rows) if (!live.has(id)) { row.root.remove(); rows.delete(id); }
    for (const session of snapshots) {
      let row = rows.get(session.sessionId);
      if (!row) { row = makeRow(doc, service, session.sessionId); rows.set(session.sessionId, row); sessions.append(row.root); }
      updateRow(row, session, service);
    }
  });
  return () => { off(); host.remove(); };
}
