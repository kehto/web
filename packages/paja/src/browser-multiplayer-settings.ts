import { normalizePajaMultiplayer, type PajaMultiplayerConfig } from './multiplayer-config.js';

const KEY = 'kehto:paja:multiplayer:v1';

/** Restore explicit host settings; malformed persisted data never selects a provider. */
export function readPajaMultiplayerSettings(fallback?: PajaMultiplayerConfig): PajaMultiplayerConfig | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === null ? fallback : normalizePajaMultiplayer(JSON.parse(raw));
  } catch { return fallback; }
}

/** Save validated settings, then reload so every active transport is torn down together. */
export function installPajaMultiplayerSettings(initial?: PajaMultiplayerConfig): () => void {
  const form = document.getElementById('paja-multiplayer-form');
  const input = document.getElementById('paja-multiplayer-input') as HTMLTextAreaElement;
  const status = document.getElementById('paja-multiplayer-status');
  if (!form || !input || !status) return () => undefined;
  input.value = initial ? JSON.stringify(initial, null, 2) : '';
  const submit = (event: Event) => {
    event.preventDefault();
    try {
      const value = input.value.trim() ? normalizePajaMultiplayer(JSON.parse(input.value)) : undefined;
      if (value) localStorage.setItem(KEY, JSON.stringify(value));
      else localStorage.removeItem(KEY);
      location.reload();
    } catch (error) { input.setAttribute('aria-invalid', 'true'); status.textContent = error instanceof Error ? error.message : 'Unable to save settings.'; }
  };
  form.addEventListener('submit', submit);
  return () => form.removeEventListener('submit', submit);
}
