import { normalizePublicBlossomServer } from './browser-resource.js';

const STORAGE_KEY = 'kehto:paja:resource-servers';

function normalizeDraft(draft: string): readonly string[] {
  const servers: string[] = [];
  for (const [index, line] of draft.split(/\r?\n/u).entries()) {
    const value = line.trim();
    if (!value) continue;
    const candidate = /^[a-z0-9.-]+(?::\d+)?$/iu.test(value) ? `https://${value}` : value;
    // Do not let URL parsing repair malformed schemes/backslashes or erase empty delimiters.
    const origin = /^https:\/\/[^/\\?#\s]+\/?$/iu.test(candidate)
      ? normalizePublicBlossomServer(candidate) : null;
    if (!origin) throw new Error(`Line ${index + 1}: enter a public HTTPS origin or bare domain (no path, credentials, query or fragment).`);
    if (!servers.includes(origin)) servers.push(origin);
  }
  return Object.freeze(servers);
}

/** Private host-owned resource lookup settings; storage is never required for use. */
export function createPajaResourceSettings(getStorage: () => Storage = () => localStorage) {
  let servers: readonly string[] = Object.freeze([]);
  let status = 'No extra resource servers saved.';
  try {
    const stored = getStorage().getItem(STORAGE_KEY);
    if (stored !== null) {
      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === 'string' && !/[\r\n]/u.test(value))) {
        throw new Error('Invalid stored resource servers');
      }
      servers = normalizeDraft(parsed.join('\n'));
      status = 'Restored saved resource servers.';
    }
  } catch {
    status = 'Saved resource servers could not be restored. Save to use a new list; unavailable storage means session-only changes.';
  }

  return {
    getServers: () => servers,
    getStatus: () => status,
    save(draft: string): { ok: boolean; message: string } {
      let next: readonly string[];
      try {
        next = normalizeDraft(draft);
      } catch (error) {
        return { ok: false, message: (error as Error).message };
      }
      servers = next;
      try {
        const storage = getStorage();
        if (servers.length) storage.setItem(STORAGE_KEY, JSON.stringify(servers));
        else storage.removeItem(STORAGE_KEY);
        status = servers.length ? 'Resource servers saved for this host origin.' : 'Extra resource servers cleared from this host origin.';
      } catch {
        status = 'Resource servers applied session-only. Storage is unavailable; any previously saved list may return after reload.';
      }
      return { ok: true, message: status };
    },
  };
}

/** Attach the sidebar once, with safe text feedback and an explicit disposer. */
export function installPajaResourceSettings() {
  const settings = createPajaResourceSettings();
  const form = document.getElementById('paja-resource-servers-form');
  const input = document.getElementById('paja-resource-servers-input') as HTMLTextAreaElement;
  const status = document.getElementById('paja-resource-servers-status')!;
  input.value = settings.getServers().join('\n');
  status.textContent = settings.getStatus();
  const submit = (event: Event) => {
    event.preventDefault();
    const result = settings.save(input.value);
    input.setAttribute('aria-invalid', String(!result.ok));
    status.textContent = result.message;
    if (result.ok) input.value = settings.getServers().join('\n');
  };
  form?.addEventListener('submit', submit);
  return { getServers: settings.getServers, dispose: () => form?.removeEventListener('submit', submit) };
}
