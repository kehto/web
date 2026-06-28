/**
 * resource-demo napplet -- fetches a remote image through the resource service
 * and renders it as a visible resource preview.
 *
 * Phase 58 raw-envelope allowlist: the demo intentionally uses resource.bytesMany
 * to fetch remote bytes and surface the response as an object URL.
 */
import '@napplet/shim';
import { getMissingNapDomains } from '../../domain-availability';
import { applyNapTheme, installNapTheme, onNapThemeChanged } from '../../shared-theme';

const REQUIRED_NAPS = ['resource', 'theme'] as const;
// Match the 5s deadline every other playground napplet uses: the host prelude
// and @napplet/shim@0.24 both install window.napplet domain objects before
// authored code runs, but slower CI can still race the iframe bootstrap.
const CAPABILITY_WAIT_MS = 5_000;
const CAPABILITY_WAIT_INTERVAL_MS = 25;

const statusEl = document.getElementById('resource-demo-status')!;
const imageEl = document.getElementById('resource-demo-image') as HTMLImageElement;
const sourceEl = document.getElementById('resource-demo-source')!;
const bulkEl = document.getElementById('resource-demo-bulk')!;

const REMOTE_IMAGE_URL = 'https://raw.githubusercontent.com/github/explore/main/topics/typescript/typescript.png';
const REMOTE_IMAGE_URLS = [REMOTE_IMAGE_URL, REMOTE_IMAGE_URL] as const;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForRequiredNaps(): Promise<void> {
  const deadline = Date.now() + CAPABILITY_WAIT_MS;
  let missing = getMissingNapDomains(REQUIRED_NAPS);
  while (missing.length > 0 && Date.now() < deadline) {
    await sleep(CAPABILITY_WAIT_INTERVAL_MS);
    missing = getMissingNapDomains(REQUIRED_NAPS);
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
  id?: string;
  requestId?: string;
  error?: string;
  code?: string;
  message?: string;
};

type ResourceBytesManyItem =
  | {
      url: string;
      ok: true;
      blob: Blob;
      mime: string;
    }
  | {
      url: string;
      ok: false;
      error: string;
      code?: string;
      message?: string;
    };

type ResourceBytesManyResult = {
  type: 'resource.bytesMany.result';
  id: string;
  requestId?: string;
  items: ResourceBytesManyItem[];
};

type ResourceBytesManyError = {
  type: 'resource.bytesMany.error';
  id: string;
  requestId?: string;
  error: string;
  code?: string;
  message?: string;
};

function newRequestId(): string {
  return `res-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function dispatchResourceBytesMany(requestId: string, urls: readonly string[]): void {
  window.parent.postMessage(
    { type: 'resource.bytesMany', id: requestId, urls },
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

function setRemoteImageFromBlob(blob: Blob): void {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
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
  setStatus('loading remote images', 'gray');
  sourceEl.textContent = REMOTE_IMAGE_URL;
  bulkEl.textContent = 'bulk loading';

  const handleMessage = (event: MessageEvent) => {
    if (event.source !== window.parent) return;
    const envelope = event.data as ResourceBytesResult | ResourceBytesError | ResourceBytesManyResult | ResourceBytesManyError | null;
    if (!envelope || typeof envelope !== 'object') return;
    const envelopeId = 'id' in envelope ? envelope.id : envelope.requestId;
    if (envelopeId !== requestId) return;

    if (envelope.type === 'resource.bytes.result') {
      const bytes = decodeBase64(envelope.bodyBase64);
      setRemoteImageFromBytes(bytes, envelope.headers['content-type'] ?? undefined);
      setStatus(`loaded remote image (${envelope.status})`, 'green');
      window.removeEventListener('message', handleMessage);
      return;
    }

    if (envelope.type === 'resource.bytes.error') {
      imageEl.removeAttribute('src');
      sourceEl.textContent = `${REMOTE_IMAGE_URL} — ${envelope.error ?? envelope.code}: ${envelope.message ?? ''}`;
      setStatus('image fetch failed', 'red');
      window.removeEventListener('message', handleMessage);
      return;
    }

    if (envelope.type === 'resource.bytesMany.result') {
      const first = envelope.items[0];
      if (!first?.ok) {
        imageEl.removeAttribute('src');
        sourceEl.textContent = `${REMOTE_IMAGE_URL} — ${first?.error ?? 'missing-result'}: ${first?.message ?? ''}`;
        bulkEl.textContent = 'bulk failed';
        setStatus('image fetch failed', 'red');
        window.removeEventListener('message', handleMessage);
        return;
      }
      setRemoteImageFromBlob(first.blob);
      const successes = envelope.items.filter((item) => item.ok).length;
      bulkEl.textContent = `bulk loaded ${successes}/${envelope.items.length}`;
      setStatus(`loaded remote images (${successes}/${envelope.items.length})`, 'green');
      window.removeEventListener('message', handleMessage);
      return;
    }

    if (envelope.type === 'resource.bytesMany.error') {
      imageEl.removeAttribute('src');
      sourceEl.textContent = `${REMOTE_IMAGE_URL} — ${envelope.error}: ${envelope.message ?? ''}`;
      bulkEl.textContent = 'bulk failed';
      setStatus('image fetch failed', 'red');
      window.removeEventListener('message', handleMessage);
    }
  };

  window.addEventListener('message', handleMessage);
  dispatchResourceBytesMany(requestId, REMOTE_IMAGE_URLS);
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
