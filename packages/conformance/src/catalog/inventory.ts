/**
 * catalog/inventory.ts — The pinned operation inventory and its drift diagnostics.
 */
import { INVENTORY } from './inventory.generated.js';
import type { ParsedOperations } from './nap-types-parser.js';

export { INVENTORY };

/** One domain's operations from both sources. */
export interface DomainInventory {
  /** Id of the owning {@link AuthorityRef}. */
  readonly authority: string;
  /** From the installed `@napplet/nap/<domain>/types.d.ts`. */
  readonly package: ParsedOperations;
  /** From the wire table of the pinned NAP document. */
  readonly spec: ParsedOperations;
}

/** A napplet -> runtime operation and where it is declared. */
export interface InventoryOperation {
  readonly type: string;
  readonly sources: readonly ('spec' | 'package')[];
}

/**
 * Napplet -> runtime operations of a domain, from either source.
 *
 * @param domain - Bare domain name.
 * @returns Sorted operations with their sources; empty when the domain has no inventory.
 */
export function outboundOperations(domain: string): readonly InventoryOperation[] {
  const entry = INVENTORY[domain];
  if (!entry) return [];
  const types = [...new Set([...entry.spec.outbound, ...entry.package.outbound])].sort();
  return types.map((type) => ({
    type,
    sources: [
      ...(entry.spec.outbound.includes(type) ? ['spec' as const] : []),
      ...(entry.package.outbound.includes(type) ? ['package' as const] : []),
    ],
  }));
}

/**
 * Differences between the pinned NAP wire table and the packaged types.
 *
 * @param domain - Bare domain name.
 * @returns One human sentence per difference.
 */
export function inventoryDrift(domain: string): string[] {
  const entry = INVENTORY[domain];
  if (!entry) return [`${domain} has no operation inventory`];
  const drift: string[] = [];
  for (const direction of ['outbound', 'inbound'] as const) {
    const label = direction === 'outbound' ? 'napplet -> runtime' : 'runtime -> napplet';
    for (const type of entry.spec[direction]) {
      if (!entry.package[direction].includes(type)) drift.push(`${type} (${label}) is in ${entry.authority} but missing from the packaged types`);
    }
    for (const type of entry.package[direction]) {
      if (!entry.spec[direction].includes(type)) drift.push(`${type} (${label}) is packaged but not in the ${entry.authority} wire table`);
    }
  }
  return drift;
}
