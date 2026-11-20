/**
 * kehto-target.ts — The deterministic first-party Kehto target.
 *
 * Boots the real `@kehto/runtime` + `@kehto/shell` bridge with in-memory
 * backends inside the current document. Browser-only: it creates iframes.
 *
 * @module
 */
import type { ConformanceTarget } from './target.js';
import { bootKehtoSession } from './kehto/session.js';
import type { KehtoTamper } from './kehto/tamper.js';
import { KEHTO_PACKAGE_VERSIONS } from './kehto/versions.js';

export type { KehtoTamper } from './kehto/tamper.js';

/**
 * Options for {@link createKehtoTarget}.
 *
 * @example
 * ```ts
 * const options: KehtoTargetOptions = { host: document.body };
 * ```
 */
export interface KehtoTargetOptions {
  /** Element the hidden probe stage is appended to. Default `document.body`. */
  readonly host?: HTMLElement;
  /** Interposition points used only by the mutation self-tests. */
  readonly tamper?: KehtoTamper;
  /** Display name. Default `kehto`. */
  readonly name?: string;
}

/**
 * Create the first-party target.
 *
 * @param options - Stage element and optional tampering.
 * @returns A target that boots one fresh Kehto runtime per variant.
 * @example
 * ```ts
 * const run = await runConformance(createKehtoTarget(), { profile: 'minimal' });
 * ```
 */
export function createKehtoTarget(options: KehtoTargetOptions = {}): ConformanceTarget {
  return {
    name: options.name ?? 'kehto',
    packages: KEHTO_PACKAGE_VERSIONS,
    requiredDomainPolicy: 'strict',
    boot: (variant) => bootKehtoSession(variant, options.host ?? document.body, options.tamper ?? {}),
  };
}
