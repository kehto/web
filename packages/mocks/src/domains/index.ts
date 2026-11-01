/**
 * domains/index.ts — Barrel of every domain mock and the registry entries.
 *
 * Each domain module exports `createMock<Domain>Service`, its state type, its
 * `<DOMAIN>_SPEC_REF`, and a `<DOMAIN>_MOCK_ENTRY`. Add new domains here and
 * to `DOMAIN_ENTRIES`.
 */
import type { MockDomainEntry } from '../core/types.js';

/** Unsorted registry rows; `registry.ts` sorts them by domain. */
export const DOMAIN_ENTRIES: readonly MockDomainEntry[] = Object.freeze([]);
