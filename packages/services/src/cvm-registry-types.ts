/**
 * NAP-CVM registry value types, re-exported from `@napplet/core` (>= 0.42.0).
 *
 * Checked against napplet/naps PR #31 at 28cf1bdb: selectors carry `family`
 * and/or an authoritative `schemaHash`, entries carry `schemaHashes` and
 * per-tool hashes. Core 0.42.0 / nap 0.41.0 (napplet/web#337) export that
 * contract, so Kehto no longer keeps a local copy (kehto/web#441). Only the
 * host-side family configuration below is Kehto's own.
 */
import type { CvmServerRef } from './cvm-types.js';

export type {
  CvmRegistryCallOptions,
  CvmRegistryEntry,
  CvmRegistryOptions,
  CvmRegistryQuery,
  CvmRegistrySelector,
  CvmRegistryTool,
} from '@napplet/core';

/** Host-configured family membership, pinned to verified CEP-15 tool hashes. */
export interface CvmRegistryFamily {
  family: string;
  server: CvmServerRef;
  tools: readonly { name: string; schemaHash: string }[];
  description?: string;
  categories?: readonly string[];
}
