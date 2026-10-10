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
  /** Publisher/kind-safe NIP-5D identity used as the handler identity. */
  readonly id: string;
  /** Verified d-tag retained as artifact metadata, never as catalog identity. */
  readonly dTag: string;
  /** Computed verified aggregate identity for the artifact. */
  readonly aggregateHash: string;
  /** Host-owned descriptor used to start the verified artifact later. */
  readonly restart: PlaygroundNappletRestartDescriptor;
  /** Optional verified manifest title for handler selection UI. */
  readonly title?: string;
  /** Verified NAP domains required by the artifact. */
  readonly requires: readonly string[];
  /** Optional integrations; declarations do not grant capabilities. */
  readonly optional?: readonly string[];
  /** Exact verified manifest convention contracts. */
  readonly archetypes: readonly {
    readonly slug: string;
    readonly convention: string;
    readonly params: readonly string[];
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
    const previous = this.records.get(resolved.catalogId);
    const record = freezeRecord({
      id: resolved.catalogId,
      dTag: resolved.dTag,
      aggregateHash: resolved.aggregateHash,
      restart: Object.freeze({ name: restart.name, containerId: restart.containerId }),
      ...(resolved.title === undefined ? {} : { title: resolved.title }),
      requires: [...resolved.requires],
      optional: [...(resolved.optional ?? [])],
      archetypes: resolved.archetypes.map((archetype) => ({
        slug: archetype.slug,
        convention: archetype.convention,
        params: [...archetype.params],
      })),
    });
    this.records.set(record.id, record);
    this.notify([...new Set([
      ...record.archetypes.map((archetype) => archetype.slug),
      ...(previous?.archetypes.map((archetype) => archetype.slug) ?? []),
    ])]);
    return record;
  }

  /** Remove an artifact explicitly; normal frame lifecycle never calls this method. */
  remove(id: string): boolean {
    const previous = this.records.get(id);
    if (!previous) return false;
    this.records.delete(id);
    for (const [archetype, handler] of this.defaults) {
      if (handler === id) this.defaults.delete(archetype);
    }
    this.notify(previous.archetypes.map((archetype) => archetype.slug));
    return true;
  }

  /** Return immutable verified installation facts. */
  installed(): readonly InstalledNappletRecord[] {
    return [...this.records.values()];
  }

  /** Return a verified record by opaque catalog id. */
  get(id: string): InstalledNappletRecord | undefined {
    return this.records.get(id);
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
    if (this.records.get(selected.id) !== selected) return null;
    return matchesInstalledNappletRecord(selected, target) ? selected : null;
  }

  /** Return declared handlers filtered by host intent availability; INC is not required. */
  intentCatalog(
    canReceiveIntent: (record: InstalledNappletRecord) => boolean = () => true,
  ): IntentCatalogEntry[] {
    return this.installed()
      .filter(canReceiveIntent)
      .map((record) => manifestToIntentCatalogEntry({
        catalogId: record.id,
        ...(record.title === undefined ? {} : { title: record.title }),
        archetypes: record.archetypes.map((archetype) => ({
          slug: archetype.slug,
          convention: archetype.convention,
          params: [...archetype.params],
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

  /** Find the opaque catalog ID bound to one live verified artifact. */
  findCatalogId(target: { readonly dTag?: string; readonly aggregateHash?: string }): string | undefined {
    return this.installed().find((record) => matchesInstalledNappletRecord(record, target))?.id;
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
    readonly params: readonly string[];
  }[];
}): InstalledNappletRecord {
  return Object.freeze({
    ...record,
    requires: Object.freeze([...record.requires]),
    optional: Object.freeze([...(record.optional ?? [])]),
    archetypes: Object.freeze(record.archetypes.map((archetype) =>
      Object.freeze({ ...archetype, params: Object.freeze([...archetype.params]) }))),
  });
}
