/**
 * resource-demo napplet -- fetches a remote image through the resource service
 * and renders it as a visible resource preview.
 *
 * Phase 58 raw-envelope allowlist: the demo intentionally uses resource.bytes
 * to fetch a remote image and surface the response as an object URL.
 */
import '@napplet/shim';
import { applyNapTheme, installNapTheme, onNapThemeChanged } from '../../shared-theme';

const REQUIRED_NAPS = ['resource', 'connect', 'theme'] as const;
const CAPABILITY_WAIT_MS = 1_000;
const CAPABILITY_WAIT_INTERVAL_MS = 25;

const statusEl = document.getElementById('resource-demo-status')!;
const imageEl = document.getElementById('resource-demo-image') as HTMLImageElement;
const sourceEl = document.getElementById('resource-demo-source')!;

const REMOTE_IMAGE_URL = 'https://raw.githubusercontent.com/github/explore/main/topics/typescript/typescript.png';
let currentObjectUrl: string | null = null;

function setStatus(text: string, color: 'gray' | 'green' | 'red' = 'gray'): void {
  statusEl.textContent = text;
  statusEl.style.color =
    color === 'green'
      ? 'var(--nap-theme-success, #39ff14)'
      : color === 'red'
        ? 'var(--nap-theme-danger, #ff3b3b)'
        : 'var(--nap-theme-muted, #888)';
}

function getMissingRequiredNaps(): string[] {
  const supports = window.napplet.shell.supports;
  return REQUIRED_NAPS.filter((capability) => !supports(capability));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForRequiredNaps(): Promise<void> {
  const deadline = Date.now() + CAPABILITY_WAIT_MS;
  let missing = getMissingRequiredNaps();
  while (missing.length > 0 && Date.now() < deadline) {
    await sleep(CAPABILITY_WAIT_INTERVAL_MS);
    missing = getMissingRequiredNaps();
  }
  if (missing.length > 0) {
    throw new Error(`unsupported NAP capability: ${missing.join(', ')}`);
  }
}

type ResourceBytesResult = {
  type: 'resource.bytes.result';
  requestId: string;
  status: number;
  headers: Readonly<Record<string, string>>;
  bodyBase64: string;
};

type ResourceBytesError = {
  type: 'resource.bytes.error';
  requestId: string;
  code: string;
  message: string;
};

function newRequestId(): string {
  return `res-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function dispatchResourceBytes(requestId: string, url: string): void {
  window.parent.postMessage(
    { type: 'resource.bytes', requestId, url },
    '*',
  );
}

function decodeBase64(bodyBase64: string): Uint8Array {
  const binary = atob(bodyBase64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function setRemoteImageFromBytes(bytes: Uint8Array, contentType: string | undefined): void {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
  const blob = new Blob([bytes], { type: contentType || 'image/png' });
  const objectUrl = URL.createObjectURL(blob);
  currentObjectUrl = objectUrl;
  imageEl.src = objectUrl;
  imageEl.addEventListener('load', () => {
    URL.revokeObjectURL(objectUrl);
    if (currentObjectUrl === objectUrl) currentObjectUrl = null;
  }, { once: true });
  sourceEl.textContent = REMOTE_IMAGE_URL;
}

async function init(): Promise<void> {
  installNapTheme();
  onNapThemeChanged((theme) => {
    applyNapTheme(theme);
  });
  await waitForRequiredNaps();

  const requestId = newRequestId();
  setStatus('loading remote image', 'gray');
  sourceEl.textContent = REMOTE_IMAGE_URL;

  const handleMessage = (event: MessageEvent) => {
    if (event.source !== window.parent) return;
    const envelope = event.data as ResourceBytesResult | ResourceBytesError | null;
    if (!envelope || typeof envelope !== 'object' || envelope.requestId !== requestId) return;

    if (envelope.type === 'resource.bytes.result') {
      const bytes = decodeBase64(envelope.bodyBase64);
      setRemoteImageFromBytes(bytes, envelope.headers['content-type'] ?? undefined);
      setStatus(`loaded remote image (${envelope.status})`, 'green');
      window.removeEventListener('message', handleMessage);
      return;
    }

    if (envelope.type === 'resource.bytes.error') {
      imageEl.removeAttribute('src');
      sourceEl.textContent = `${REMOTE_IMAGE_URL} — ${envelope.code}: ${envelope.message}`;
      setStatus('image fetch failed', 'red');
      window.removeEventListener('message', handleMessage);
    }
  };

  window.addEventListener('message', handleMessage);
  dispatchResourceBytes(requestId, REMOTE_IMAGE_URL);
}

init().catch((err) => {
  setStatus('init failed', 'red');
  sourceEl.textContent = err instanceof Error ? err.message : String(err);
});

window.addEventListener('pagehide', () => {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
});
