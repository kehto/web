import type { PajaHostConfig } from './options.js';

/** Read the immutable Paja configuration embedded into the host document. */
export function readPajaHostConfig(): PajaHostConfig {
  const script = document.getElementById('kehto-paja-config');
  if (!script?.textContent) throw new Error('Missing Kehto Paja config.');
  return JSON.parse(script.textContent) as PajaHostConfig;
}

/** Prefer a no-store development config refresh while retaining embedded config on failure. */
export async function readLatestPajaHostConfig(fallback: PajaHostConfig): Promise<PajaHostConfig> {
  try {
    const response = await fetch(new URL('./__kehto/config.json', window.location.href), { cache: 'no-store' });
    if (!response.ok) return fallback;
    return await response.json() as PajaHostConfig;
  } catch (error) {
    console.warn('[paja] config refresh failed; using embedded config', error);
    return fallback;
  }
}

/** Reflect the configured target in the host chrome without changing frame navigation. */
export function displayPajaTargetUrl(config: PajaHostConfig, frame?: HTMLIFrameElement | null): void {
  const label = config.target.mode === 'runtime-pointer'
    ? config.target.pointer?.value ?? 'runtime pointer'
    : config.target.url;
  const targetEl = document.querySelector('.target');
  if (targetEl) {
    targetEl.textContent = label;
    targetEl.setAttribute('title', label);
  }
  if (frame) frame.dataset.targetUrl = label;
}
