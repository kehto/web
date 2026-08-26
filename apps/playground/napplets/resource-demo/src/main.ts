/**
 * resource-demo napplet -- fetches a remote image through the resource service
 * and renders it as a visible resource preview.
 *
 * Uses the injected NAP-RESOURCE projection to fetch remote bytes and surface
 * the response as an object URL.
 */
import { getMissingNapDomains } from '../../domain-availability';
import { applyNapTheme, installNapTheme, onNapThemeChanged } from '../../shared-theme';

const REQUIRED_NAPS = ['resource', 'theme'] as const;
// Match the 5s deadline every other playground napplet uses: the host prelude
// installs window.napplet domain objects before authored code runs, but slower
// CI can still race the iframe bootstrap.
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

interface HintAwareResourceApi {
  bytesMany(
    requests: Array<{ url: string; servers?: string[] }>,
  ): Promise<ResourceBytesManyItem[]>;
}

function getResourceApi(): HintAwareResourceApi {
  const resource: unknown = Reflect.get(window.napplet, 'resource');
  if (
    typeof resource !== 'object'
    || resource === null
    || typeof Reflect.get(resource, 'bytesMany') !== 'function'
  ) {
    throw new Error('unsupported NAP capability: resource');
  }
  return resource as HintAwareResourceApi;
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

  setStatus('loading remote images', 'gray');
  sourceEl.textContent = REMOTE_IMAGE_URL;
  bulkEl.textContent = 'bulk loading';

  const resource = getResourceApi();
  const items = await resource.bytesMany(REMOTE_IMAGE_URLS.map((url) => ({ url })));
  const first = items[0];
  if (!first?.ok) {
    imageEl.removeAttribute('src');
    sourceEl.textContent = `${REMOTE_IMAGE_URL} — ${first?.error ?? 'missing-result'}: ${first?.message ?? ''}`;
    bulkEl.textContent = 'bulk failed';
    setStatus('image fetch failed', 'red');
    return;
  }
  setRemoteImageFromBlob(first.blob);
  const successes = items.filter((item) => item.ok).length;
  bulkEl.textContent = `bulk loaded ${successes}/${items.length}`;
  setStatus(`loaded remote images (${successes}/${items.length})`, 'green');
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
