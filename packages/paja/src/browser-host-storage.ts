import {
  PAJA_RUNTIME_TABS_STORAGE_KEY,
  parseRuntimeTabsSnapshot,
  snapshotRuntimeTabs,
  type PajaRuntimeTabsSnapshot,
  type PajaRuntimeTabsSnapshotState,
} from './browser-runtime-tabs.js';
import type { PajaHostConfig } from './options.js';

const PAJA_INTENT_DEFAULTS_STORAGE_KEY = 'kehto.paja.intent-defaults.v1';

function runtimeTabsStorage(config: PajaHostConfig): Storage | null {
  if (config.target.mode !== 'runtime-pointer') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Read saved intent handler choices without making storage availability a policy dependency. */
export function readPajaIntentDefaults(): Map<string, string> {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(PAJA_INTENT_DEFAULTS_STORAGE_KEY) ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return new Map();
    return new Map(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  } catch {
    return new Map();
  }
}

/** Persist convenience-only handler choices while keeping an in-memory policy fallback. */
export function writePajaIntentDefaults(defaults: ReadonlyMap<string, string>): void {
  try {
    window.localStorage.setItem(PAJA_INTENT_DEFAULTS_STORAGE_KEY, JSON.stringify(Object.fromEntries(defaults)));
  } catch {
    // Persistent defaults are user convenience only; policy remains functional in-memory.
  }
}

/** Resolve a runtime pointer from its link parameter before falling back to config. */
export function readInitialRuntimePointer(config: PajaHostConfig): string {
  if (config.target.mode !== 'runtime-pointer') return '';
  const params = new URLSearchParams(window.location.search);
  return params.get('naddr')
    ?? params.get('nevent')
    ?? params.get('pointer')
    ?? config.target.pointer?.value
    ?? '';
}

/** Load the saved pointer-tab snapshot only for a runtime-pointer host. */
export function readPersistedRuntimeTabs(config: PajaHostConfig): PajaRuntimeTabsSnapshot | null {
  const storage = runtimeTabsStorage(config);
  if (!storage) return null;
  try {
    return parseRuntimeTabsSnapshot(storage.getItem(PAJA_RUNTIME_TABS_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Persist currently open pointer tabs without allowing browser storage failures to affect navigation. */
export function persistRuntimeTabs(state: PajaRuntimeTabsSnapshotState & { readonly config: PajaHostConfig }): void {
  const storage = runtimeTabsStorage(state.config);
  if (!storage) return;
  const snapshot = snapshotRuntimeTabs(state);
  try {
    if (snapshot) storage.setItem(PAJA_RUNTIME_TABS_STORAGE_KEY, JSON.stringify(snapshot));
    else storage.removeItem(PAJA_RUNTIME_TABS_STORAGE_KEY);
  } catch {
    // Storage persistence is best-effort; Paja runtime loading must keep working.
  }
}
