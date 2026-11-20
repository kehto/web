/**
 * The resource proxy that a static Paja build uses for NAP-RESOURCE reads.
 *
 * The static `/web/paja/` build has no server, so it can't make NAP-RESOURCE's
 * mandatory DNS-time private-IP checks itself (napplet/naps#80 @ `ae5b9c6`).
 * The host can point it at a standalone proxy (`kehto paja resource-proxy`)
 * that makes them. The URL comes from host config or this host-only setting.
 * A napplet can never set it. The proxy sees every resource URL it fetches and
 * could change plain HTTPS bytes. Blossom bytes are still hash-checked in the
 * browser.
 *
 * @module
 */

const STORAGE_KEY = 'kehto:paja:resource-proxy';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Normalize a resource proxy URL: HTTPS, or HTTP on loopback for development,
 * with no credentials, query or fragment.
 *
 * @param value - Candidate URL.
 * @returns The normalized URL, or `null` when it is not acceptable.
 * @example
 * ```ts
 * normalizePajaResourceProxyUrl('https://proxy.example/'); // 'https://proxy.example/'
 * normalizePajaResourceProxyUrl('http://proxy.example/'); // null
 * ```
 */
export function normalizePajaResourceProxyUrl(value: string): string | null {
  let url: URL;
  try { url = new URL(value.trim()); } catch { return null; }
  const secure = url.protocol === 'https:' || (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname));
  if (!secure || url.username || url.password || url.search || url.hash) return null;
  return url.href;
}

/**
 * Read the user's saved proxy URL for this host origin.
 *
 * @param getStorage - Storage accessor; unavailable storage means no saved URL.
 * @returns The saved, valid proxy URL, or `undefined`.
 * @example
 * ```ts
 * const proxy = readPajaResourceProxyUrl() ?? config.resource?.proxyUrl;
 * ```
 */
export function readPajaResourceProxyUrl(getStorage: () => Storage = () => localStorage): string | undefined {
  try {
    const stored = getStorage().getItem(STORAGE_KEY);
    return stored === null ? undefined : normalizePajaResourceProxyUrl(stored) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Save or clear (empty draft) the user's proxy URL.
 *
 * @param draft - Proxy URL text from the sidebar.
 * @param getStorage - Storage accessor.
 * @returns Whether it was accepted, and a status message.
 * @example
 * ```ts
 * savePajaResourceProxyUrl('https://proxy.example/');
 * ```
 */
export function savePajaResourceProxyUrl(
  draft: string,
  getStorage: () => Storage = () => localStorage,
): { ok: boolean; message: string } {
  const value = draft.trim();
  const url = value === '' ? null : normalizePajaResourceProxyUrl(value);
  if (value !== '' && url === null) {
    return { ok: false, message: 'Enter an HTTPS URL (HTTP only for localhost), without credentials, query or fragment.' };
  }
  try {
    if (url === null) getStorage().removeItem(STORAGE_KEY);
    else getStorage().setItem(STORAGE_KEY, url);
  } catch {
    return { ok: false, message: 'Storage is unavailable, so the proxy could not be saved.' };
  }
  return { ok: true, message: url === null ? 'Resource proxy cleared. Network images are off.' : 'Resource proxy saved for this host origin.' };
}

/**
 * Attach the sidebar proxy field, when the page renders one.
 *
 * @param configured - Proxy URL from host config, shown when nothing is saved.
 * @returns A disposer.
 * @example
 * ```ts
 * const dispose = installPajaResourceProxySetting(config.resource?.proxyUrl);
 * ```
 */
export function installPajaResourceProxySetting(configured: string | undefined): () => void {
  const form = document.getElementById('paja-resource-proxy-form');
  const input = document.getElementById('paja-resource-proxy-input');
  const status = document.getElementById('paja-resource-proxy-status');
  // Server-hosted pages render no proxy field; there is nothing to detach.
  if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement) || !status) return () => undefined;
  const saved = readPajaResourceProxyUrl();
  input.value = saved ?? '';
  input.placeholder = configured ?? 'https://proxy.example/';
  status.textContent = saved
    ? 'Using your saved resource proxy.'
    : configured ? 'Using the host-configured resource proxy.' : 'No resource proxy: network images are off.';
  const submit = (event: Event) => {
    event.preventDefault();
    const result = savePajaResourceProxyUrl(input.value);
    input.setAttribute('aria-invalid', String(!result.ok));
    status.textContent = result.ok && input.value.trim() === '' && configured
      ? 'Saved proxy cleared. Using the host-configured resource proxy.'
      : result.message;
  };
  form.addEventListener('submit', submit);
  return () => form.removeEventListener('submit', submit);
}
