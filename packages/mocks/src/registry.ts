/**
 * registry.ts — Inventory of every NAP domain with its mock and spec ref.
 *
 * `MOCK_NAP_REGISTRY` is the single list the maintainer skill audits against
 * `napplet/naps`. Each entry records the exact document head that was read
 * when the mock was written; `scripts/audit-naps.mjs` compares those refs to
 * the live repository.
 */
import type { MockDomainEntry } from './core/types.js';
import { DOMAIN_ENTRIES } from './domains/index.js';

/**
 * Every NAP domain known to `@kehto/mocks`, in wire-domain order.
 *
 * @example
 * ```ts
 * const draft = MOCK_NAP_REGISTRY.filter((entry) => entry.spec.status === 'draft');
 * ```
 */
export const MOCK_NAP_REGISTRY: readonly MockDomainEntry[] = Object.freeze(
  [...DOMAIN_ENTRIES].sort((left, right) => left.domain.localeCompare(right.domain)),
);

/**
 * Find a registry entry by wire domain.
 *
 * @param domain - Wire domain such as `relay`.
 * @returns The entry or `undefined`.
 * @example
 * ```ts
 * findMockDomain('relay')?.spec.pr === 2;
 * ```
 */
export function findMockDomain(domain: string): MockDomainEntry | undefined {
  return MOCK_NAP_REGISTRY.find((entry) => entry.domain === domain);
}
