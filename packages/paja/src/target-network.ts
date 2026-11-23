/**
 * How a target-URL development document reaches the network.
 *
 * NAP-RESOURCE (napplet/naps PR #80 at
 * ae5b9c64ab8a4d8909f288829a01e99d6bd713bc, with its web resource binding)
 * requires enforced direct-network denial, external subresource loads included,
 * before `window.napplet.resource` is exposed, and forbids applying the
 * direct-network exception to such a napplet. A live dev-server frame loads its
 * scripts, styles, images, and HMR socket from the dev origin, so it can never
 * carry `resource`. A target that requires `resource` is therefore loaded as a
 * network-isolated snapshot of its `index.html`: Paja fetches the bytes itself
 * and the frame gets the same closed CSP as a local single-file target.
 *
 * This module is pure so the Paja server, the CLI, and the browser host derive
 * the same decision from the same bytes.
 */

import { readDevelopmentDomains } from './local-target.js';
import { getPajaSetting } from './settings.js';

/** Whether the frame loads from the dev origin or runs a closed snapshot. */
export type PajaTargetNetworkMode = 'live' | 'isolated';

/** How the development document declares the `resource` interface. */
export type PajaTargetResourceDeclaration = 'required' | 'optional' | 'undeclared';

/** Network decision and developer-facing explanation for one target document. */
export interface PajaTargetNetworkPlan {
  /** `isolated` when `resource` is required; otherwise `live`. */
  readonly mode: PajaTargetNetworkMode;
  /** The document's own `resource` declaration. */
  readonly resource: PajaTargetResourceDeclaration;
  /** Up to eight references an isolated frame cannot load; empty in live mode. */
  readonly blockedReferences: readonly string[];
  /** Human-readable explanation, or `null` when there is nothing to report. */
  readonly detail: string | null;
  /** Actionable remedy, or `null` when none applies. */
  readonly hint: string | null;
}

const LOADING_LINK_RELS = new Set(['stylesheet', 'modulepreload', 'preload', 'icon', 'manifest']);

/** Remedy offered whenever `resource` and live dev-server loading collide. */
export const PAJA_TARGET_RESOURCE_HINT =
  'Serve a self-contained index.html (inline scripts and styles, data: assets) to use `resource`, '
  + 'or declare it under `napplet-optional` to keep live dev-server loading without `window.napplet.resource`.';

/**
 * List `src`/`href` references that a network-isolated frame cannot load.
 * Only `data:`, `blob:`, and fragment references survive the closed CSP.
 *
 * @param html - HTML document text.
 * @returns Up to eight distinct references, in document order.
 * @example
 * ```ts
 * findExternalAssetReferences('<script src="/main.js"></script>'); // ['/main.js']
 * ```
 */
export function findExternalAssetReferences(html: string): string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(/<(script|link|img|source|iframe|video|audio)\b([^>]*)>/gi)) {
    const tag = (match[1] ?? '').toLowerCase();
    const source = match[2] ?? '';
    if (tag === 'link') {
      const rel = /\brel\s*=\s*["']?([^"'>]*)/i.exec(source)?.[1]?.toLowerCase().split(/\s+/) ?? [];
      if (!rel.some((token) => LOADING_LINK_RELS.has(token))) continue;
    }
    const reference = /\b(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i.exec(source);
    const value = (reference?.[1] ?? reference?.[2] ?? reference?.[3] ?? '').trim();
    if (!value || value.startsWith('#') || /^(?:data|blob):/i.test(value)) continue;
    found.add(value);
    if (found.size >= getPajaSetting('target.maxReportedReferences')) break;
  }
  return [...found];
}

/**
 * Decide how a target-URL document is loaded and explain it to the developer.
 *
 * @param html - The target's fetched `index.html`.
 * @returns The network mode, the `resource` declaration, and any diagnostics.
 * @example
 * ```ts
 * planTargetNetwork('<meta name="napplet-requires" content="resource">').mode; // 'isolated'
 * ```
 */
export function planTargetNetwork(html: string): PajaTargetNetworkPlan {
  const declarations = readDevelopmentDomains(html);
  if (declarations.required.includes('resource')) {
    const blockedReferences = Object.freeze(findExternalAssetReferences(html));
    return Object.freeze({
      mode: 'isolated' as const,
      resource: 'required' as const,
      blockedReferences,
      detail: 'Target requires `resource`, so Paja loads its index.html as a network-isolated snapshot: '
        + 'NAP-RESOURCE allows `resource` only in a frame with no direct network. The frame loads nothing from '
        + 'the dev server and does not hot-reload; reload Paja after a rebuild.',
      hint: blockedReferences.length
        ? `These references will not load: ${blockedReferences.join(', ')}. ${PAJA_TARGET_RESOURCE_HINT}`
        : null,
    });
  }
  if (declarations.optional.includes('resource')) {
    return Object.freeze({
      mode: 'live' as const,
      resource: 'optional' as const,
      blockedReferences: Object.freeze([]),
      detail: 'Target declares `resource` as optional, but a live dev-server frame has direct network access, '
        + 'so Paja leaves `window.napplet.resource` out (NAP-RESOURCE).',
      hint: PAJA_TARGET_RESOURCE_HINT,
    });
  }
  return Object.freeze({
    mode: 'live' as const, resource: 'undeclared' as const,
    blockedReferences: Object.freeze([]), detail: null, hint: null,
  });
}
