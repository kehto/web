import type { CvmRegistryFamily } from '@kehto/services';
import { normalizePajaCvmFamily } from './multiplayer-config.js';

const KEY = 'kehto:paja:cvm-families:v1';
export interface SavedCvmFamily {
  config: CvmRegistryFamily;
  /** Host-recorded provenance, not a provider trust assertion. */
  source: string;
  manual: boolean;
}

function normalize(value: unknown): SavedCvmFamily[] {
  if (!Array.isArray(value) || value.length > 16) throw new Error('Save at most 16 CVM families.');
  const pairs = new Set<string>();
  return value.map(entry => {
    if (!entry || typeof entry.source !== 'string' || entry.source.length > 4096 || typeof entry.manual !== 'boolean') throw new Error('Invalid saved CVM family.');
    const config = normalizePajaCvmFamily(entry.config);
    const pair = JSON.stringify([config.family, config.server.pubkey]);
    if (pairs.has(pair)) throw new Error('This family label and provider are already saved.');
    pairs.add(pair);
    return { config, source: entry.source, manual: entry.manual };
  });
}

/** Restore host-origin selections without allowing corrupt data to select a provider. */
export function readCvmFamilies(): SavedCvmFamily[] {
  try { return normalize(JSON.parse(localStorage.getItem(KEY) ?? '[]')); }
  catch { return []; }
}

/** Validate before committing the complete selection list; storage failures propagate to the UI. */
export function saveCvmFamilies(entries: SavedCvmFamily[]): void {
  localStorage.setItem(KEY, JSON.stringify(normalize(entries)));
}

/** Preserve multiple providers and families; explicit saved selections override the same local label/provider pair. */
export function mergeCvmFamilies(configured: readonly CvmRegistryFamily[], saved: readonly SavedCvmFamily[]): CvmRegistryFamily[] {
  const entries = new Map<string, CvmRegistryFamily>();
  for (const config of [...configured, ...saved.map(entry => entry.config)]) entries.set(JSON.stringify([config.family, config.server.pubkey]), config);
  return [...entries.values()];
}
