import { renderNappletCspMeta, type NappletCspOptions } from './napplet-csp.js';
import { insertNappletHead } from './napplet-head.js';
import { renderNappletNamespacePrelude, type NappletNamespacePreludeOptions } from './napplet-namespace.js';

/** Shell bootstrap availability and host CSP for a verified napplet document. */
export interface NappletSrcdocOptions extends NappletNamespacePreludeOptions {
  /** Validated host policy changes. Omission uses the NIP-5D baseline. */
  readonly csp?: NappletCspOptions;
}

/**
 * Prepare verified artifact HTML with CSP first, then the mandatory namespace.
 * There is no CSP opt-out. Resolve and verify the artifact before calling this;
 * bind its identity to the sandboxed iframe before assigning the returned srcdoc.
 * Keep the original verified bytes for hashing and caching.
 *
 * @param html - Already-verified napplet artifact HTML.
 * @param options - Exposed domains and validated host CSP changes.
 * @returns Srcdoc HTML with policy and bootstrap preceding authored content.
 * @example
 * ```ts
 * iframe.sandbox.value = 'allow-scripts';
 * iframe.srcdoc = prepareNappletSrcdoc(verifiedHtml, {
 *   domains: ['shell', 'theme'],
 *   csp: { directives: { 'media-src': ['blob:'] } },
 * });
 * ```
 */
export function prepareNappletSrcdoc(html: string, options: NappletSrcdocOptions): string {
  const meta = renderNappletCspMeta(options.csp);
  return insertNappletHead(html, meta + renderNappletNamespacePrelude(options));
}
