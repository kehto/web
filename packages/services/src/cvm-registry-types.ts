import type { CvmRequestOptions, CvmServerRef } from './cvm-types.js';

/** Canonical NAP-CVM selector (draft #31@28cf1bd; upstream type drift: napplet/web#336). */
export interface CvmRegistrySelector {
  family?: string;
  schemaHash?: string;
}

/** Host-configured family membership, pinned to verified CEP-15 tool hashes. */
export interface CvmRegistryFamily {
  family: string;
  server: CvmServerRef;
  tools: readonly { name: string; schemaHash: string }[];
  description?: string;
  categories?: readonly string[];
}

/** Verified tool schema returned by the registry. */
export interface CvmRegistryTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  schemaHash: string;
}

/** A provider's verified tool set; family is a local label, never a portable identity. */
export interface CvmRegistryEntry {
  family?: string;
  description?: string;
  schemaHashes: string[];
  selected?: CvmServerRef;
  providers?: CvmServerRef[];
  tools: CvmRegistryTool[];
}

/** Options shared by registry selection and invocation. No result cache is used. */
export interface CvmRegistryCallOptions extends CvmRequestOptions {
  server?: CvmServerRef;
  cache?: 'default' | 'reload' | 'no-store';
}
