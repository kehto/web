/**
 * Persistent Paja catalog of resolver-verified napplet installations.
 *
 * The catalog deliberately contains only serializable facts copied from a
 * verified pointer result. Runtime frames, sessions, and controller state are
 * owned elsewhere, so closing a tab cannot alter handler eligibility.
 *
 * @packageDocumentation
 */

import { manifestToIntentCatalogEntry } from '@kehto/services';
import type { IntentCatalogEntry } from '@kehto/services';
import type { PajaDecodedPointer, PajaResolvedPointer } from './runtime-resolver.js';

/** Serializable verified pointer and manifest facts for one installed napplet. */
export interface InstalledNappletRecord {
  /** Publisher/kind-safe verified catalog identity used as the handler identity. */
  readonly id: string;
  /** Literal manifest d-tag retained only as artifact metadata. */
  readonly dTag: string;
  /** Verified NIP-5A aggregate hash for the installed artifact. */
  readonly aggregateHash: string;
  /** Pointer identity that can later be re-resolved and verified. */
  readonly pointer: PajaDecodedPointer;
  /** Optional manifest title for handler selection UI. */
  readonly title?: string;
  /** Verified NAP domains required by the artifact. */
  readonly requires: readonly string[];
  /** Optional integrations; declarations do not grant capabilities. */
  readonly optional?: readonly string[];
  /** Exact manifest convention contracts used for intent eligibility. */
  readonly archetypes: readonly {
    readonly slug: string;
    readonly convention: string;
    readonly params: readonly string[];
  }[];
}

/** Return whether a live runtime target is exactly the installed verified artifact. */
export function matchesInstalledNappletRecord(
  record: Pick<InstalledNappletRecord, 'id' | 'aggregateHash'>,
  target: Pick<InstalledNappletRecord, 'id' | 'aggregateHash'>,
): boolean {
  return target.id === record.id && target.aggregateHash === record.aggregateHash;
}

/** Listener notified when an installed artifact is inserted or removed. */
export type InstalledNappletCatalogListener = (id: string) => void;

/**
 * Stores verified Paja installations separately from the browser runtime.
 *
 * @example
 * ```ts
 * const catalog = new InstalledNappletCatalog();
 * catalog.install(resolvedPointer);
 * const candidates = catalog.intentCatalog();
 * ```
 */
export class InstalledNappletCatalog {
  private readonly records = new Map<string, InstalledNappletRecord>();
  private readonly listeners = new Set<InstalledNappletCatalogListener>();

  /** Insert or replace a record from an already resolver-verified pointer. */
  install(resolved: PajaResolvedPointer): InstalledNappletRecord {
    const record = freezeRecord({
      id: resolved.manifest.catalogId,
      dTag: resolved.dTag,
      aggregateHash: resolved.aggregateHash,
      pointer: copyPointer(resolved.pointer),
      ...(resolved.manifest.title === undefined ? {} : { title: resolved.manifest.title }),
      requires: [...resolved.manifest.requires],
      optional: [...(resolved.manifest.optional ?? [])],
      archetypes: resolved.manifest.archetypes.map((archetype) => ({
        slug: archetype.slug,
        convention: archetype.convention,
        params: [...archetype.params],
      })),
    });
    this.records.set(record.id, record);
    this.notify(record.id);
    return record;
  }

  /** Remove an artifact explicitly; frame teardown never calls this method. */
  remove(id: string): boolean {
    const removed = this.records.delete(id);
    if (removed) this.notify(id);
    return removed;
  }

  /** Return whether a verified installation exists for a catalog ID. */
  has(id: string): boolean {
    return this.records.has(id);
  }

  /** Return immutable serializable installed-artifact facts. */
  installed(): readonly InstalledNappletRecord[] {
    return [...this.records.values()];
  }

  /** Return a verified record by catalog ID. */
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
    target: Pick<InstalledNappletRecord, 'id' | 'aggregateHash'>,
  ): InstalledNappletRecord | null {
    if (this.records.get(selected.id) !== selected) return null;
    return matchesInstalledNappletRecord(selected, target) ? selected : null;
  }

  /**
   * Return declared handlers whose host environment can receive intent delivery.
   * @param canReceiveIntent - Resolve intent availability for each verified identity;
   * without host policy, return declared candidates for the host to filter.
   * @returns Named intent candidates usable under the supplied host policy.
   */
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

  /** Subscribe to explicit install and artifact-removal changes. */
  onChanged(listener: InstalledNappletCatalogListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(id: string): void {
    for (const listener of this.listeners) listener(id);
  }
}

function copyPointer(pointer: PajaDecodedPointer): PajaDecodedPointer {
  if (pointer.type === 'naddr') {
    return Object.freeze({
      type: 'naddr' as const,
      value: pointer.value,
      identifier: pointer.identifier,
      pubkey: pointer.pubkey,
      kind: pointer.kind,
      relays: Object.freeze([...pointer.relays]),
    });
  }
  return Object.freeze({
    type: 'nevent' as const,
    value: pointer.value,
    id: pointer.id,
    ...(pointer.author === undefined ? {} : { author: pointer.author }),
    ...(pointer.kind === undefined ? {} : { kind: pointer.kind }),
    relays: Object.freeze([...pointer.relays]),
  });
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
