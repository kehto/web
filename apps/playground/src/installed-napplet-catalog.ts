/**
 * Persistent playground catalog of resolver-verified napplet installations.
 *
 * Live iframe, source, session, and generation state deliberately stays in the
 * shell host. This catalog keeps only serializable verified artifact facts, so
 * a frame replacement or close cannot alter intent-handler eligibility.
 *
 * @packageDocumentation
 */

import { manifestToIntentCatalogEntry } from '@kehto/services';
import type { IntentCatalogEntry } from '@kehto/services';
import type { PlaygroundNapplet } from './napplet-resolver.js';

/** Serializable instructions for loading an already verified installation again. */
export interface PlaygroundNappletRestartDescriptor {
  /** Demo definition name used to resolve the verified artifact again. */
  readonly name: string;
  /** Container that receives a future target iframe. */
  readonly containerId: string;
}

/** Serializable, resolver-verified facts for one installed playground artifact. */
export interface InstalledNappletRecord {
  /** Verified NIP-5A d-tag used as the handler identity. */
  readonly dTag: string;
  /** Computed verified aggregate identity for the artifact. */
  readonly aggregateHash: string;
  /** Host-owned descriptor used to start the verified artifact later. */
  readonly restart: PlaygroundNappletRestartDescriptor;
  /** Optional verified manifest title for handler selection UI. */
  readonly title?: string;
  /** Verified NAP domains required by the artifact. */
  readonly requires: readonly string[];
  /** Exact verified manifest convention contracts. */
  readonly archetypes: readonly {
    readonly slug: string;
    readonly convention: string;
  }[];
}

/** Return whether a live host identity is exactly the installed verified artifact. */
export function matchesInstalledNappletRecord(
  record: Pick<InstalledNappletRecord, 'dTag' | 'aggregateHash'>,
  target: { readonly dTag?: string; readonly aggregateHash?: string },
): boolean {
  return target.dTag === record.dTag && target.aggregateHash === record.aggregateHash;
}

/** Listener invoked when installed availability changes for an archetype. */
export type InstalledNappletCatalogListener = (archetype: string) => void;

/**
 * Stores resolver-verified playground installations independently from frames.
 *
 * @example
 * ```ts
 * const catalog = new InstalledNappletCatalog();
 * catalog.install(verifiedNapplet, { name: 'profile-viewer', containerId: 'profile' });
 * ```
 */
export class InstalledNappletCatalog {
  private readonly records = new Map<string, InstalledNappletRecord>();
  private readonly defaults = new Map<string, string>();
  private readonly listeners = new Set<InstalledNappletCatalogListener>();

  /** Insert or replace facts returned by `resolvePlaygroundNapplet` after verification. */
  install(
    resolved: PlaygroundNapplet,
    restart: PlaygroundNappletRestartDescriptor,
  ): InstalledNappletRecord {
    const previous = this.records.get(resolved.dTag);
    const record = freezeRecord({
      dTag: resolved.dTag,
      aggregateHash: resolved.aggregateHash,
      restart: Object.freeze({ name: restart.name, containerId: restart.containerId }),
      ...(resolved.title === undefined ? {} : { title: resolved.title }),
      requires: [...resolved.requires],
      archetypes: resolved.archetypes.map((archetype) => ({
        slug: archetype.slug,
        convention: archetype.convention,
      })),
    });
    this.records.set(record.dTag, record);
    this.notify([...new Set([
      ...record.archetypes.map((archetype) => archetype.slug),
      ...(previous?.archetypes.map((archetype) => archetype.slug) ?? []),
    ])]);
    return record;
  }

  /** Remove an artifact explicitly; normal frame lifecycle never calls this method. */
  remove(dTag: string): boolean {
    const previous = this.records.get(dTag);
    if (!previous) return false;
    this.records.delete(dTag);
    for (const [archetype, handler] of this.defaults) {
      if (handler === dTag) this.defaults.delete(archetype);
    }
    this.notify(previous.archetypes.map((archetype) => archetype.slug));
    return true;
  }

  /** Return immutable verified installation facts. */
  installed(): readonly InstalledNappletRecord[] {
    return [...this.records.values()];
  }

  /** Return a verified record by d-tag. */
  get(dTag: string): InstalledNappletRecord | undefined {
    return this.records.get(dTag);
  }

  /**
   * Atomically confirm that a resolved target still belongs to the exact record
   * selected before an async operation. The record object is the catalog version
   * token, so even a same-identity replacement cannot pass this check.
   */
  validateCurrent(
    selected: InstalledNappletRecord,
    target: { readonly dTag?: string; readonly aggregateHash?: string },
  ): InstalledNappletRecord | null {
    if (this.records.get(selected.dTag) !== selected) return null;
    return matchesInstalledNappletRecord(selected, target) ? selected : null;
  }

  /** Return manifest-derived exact handler candidates for intent resolution. */
  intentCatalog(): IntentCatalogEntry[] {
    return this.installed()
      .filter((record) => record.requires.includes('inc'))
      .map((record) => manifestToIntentCatalogEntry({
      dTag: record.dTag,
      ...(record.title === undefined ? {} : { title: record.title }),
      archetypes: record.archetypes.map((archetype) => ({
        slug: archetype.slug,
        convention: archetype.convention,
      })),
      }));
  }

  /** Read the user-owned default handler for one archetype. */
  getDefaultHandler(archetype: string): string | undefined {
    return this.defaults.get(archetype);
  }

  /** Change a user-owned default and notify discovery listeners. */
  setDefaultHandler(archetype: string, dTag: string | undefined): void {
    if (dTag === undefined) this.defaults.delete(archetype);
    else this.defaults.set(archetype, dTag);
    this.notify([archetype]);
  }

  /** Subscribe to catalog and default-handler availability changes. */
  onChanged(listener: InstalledNappletCatalogListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(archetypes: readonly string[]): void {
    for (const archetype of new Set(archetypes)) {
      for (const listener of this.listeners) listener(archetype);
    }
  }
}

function freezeRecord(record: Omit<InstalledNappletRecord, 'archetypes'> & {
  readonly archetypes: readonly {
    readonly slug: string;
    readonly convention: string;
  }[];
}): InstalledNappletRecord {
  return Object.freeze({
    ...record,
    requires: Object.freeze([...record.requires]),
    archetypes: Object.freeze(record.archetypes.map((archetype) =>
      Object.freeze({ ...archetype }))),
  });
}
