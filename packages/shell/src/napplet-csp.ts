import { insertNappletHead } from './napplet-head.js';
import type { PermissionRequirement } from '@kehto/runtime';

/** Source-list directives supported by the shell's meta-delivered CSP. */
export type NappletCspDirective =
  | 'default-src' | 'script-src' | 'script-src-elem' | 'script-src-attr'
  | 'style-src' | 'style-src-elem' | 'style-src-attr' | 'img-src' | 'font-src'
  | 'connect-src' | 'worker-src' | 'child-src' | 'frame-src' | 'media-src'
  | 'object-src' | 'manifest-src' | 'base-uri' | 'form-action';

/** Host replacements for individual CSP source lists; omitted directives retain defaults. */
export type NappletCspDirectives = Readonly<Partial<Record<NappletCspDirective, readonly string[]>>>;

/** Host policy for a verified napplet's CSP, separate from its signed manifest. */
export interface NappletCspOptions {
  /** Explicit HTTP(S)/WS(S) origins granted direct connections; defaults to none. */
  readonly connectOrigins?: readonly string[];
  /** Source-list replacements. connect-src may only narrow the explicit grants. */
  readonly directives?: NappletCspDirectives;
}

/** Browser authority granted to exactly one reviewed CSP source directive. */
export interface BrowserRemoteSource {
  readonly directive: 'connect-src' | 'script-src' | 'style-src' | 'img-src' | 'font-src' | 'worker-src' | 'media-src';
  readonly origin: string;
}

/** A document has either mediated resources or direct remote browser traffic. */
export type BrowserLaunchMode = 'isolated' | 'mediated-resource' | 'direct-network';

const REMOTE_DIRECTIVES = new Set<BrowserRemoteSource['directive']>([
  'connect-src', 'script-src', 'style-src', 'img-src', 'font-src', 'worker-src', 'media-src',
]);

/**
 * Classify every allowed remote source as exact, directive-specific authority.
 *
 * @param sources - Proposed remote origins from trusted host configuration.
 * @returns Canonical network requirements and source entries in stable order.
 * @example classifyBrowserRemoteSources([{ directive: 'connect-src', origin: 'https://api.example' }]);
 */
export function classifyBrowserRemoteSources(sources: readonly BrowserRemoteSource[]): {
  readonly sources: readonly BrowserRemoteSource[];
  readonly requirements: readonly PermissionRequirement[];
} {
  if (!Array.isArray(sources) || sources.length > 128) throw new TypeError('Invalid browser source list');
  const byKey = new Map<string, BrowserRemoteSource>();
  for (const source of sources) {
    if (!source || typeof source !== 'object' || Array.isArray(source)
      || Object.keys(source).some((key) => key !== 'directive' && key !== 'origin')
      || !REMOTE_DIRECTIVES.has(source.directive)) throw new TypeError('Unsupported browser source directive');
    const origin = connectionOrigin(source.origin);
    if (source.directive !== 'connect-src' && !/^https?:\/\//.test(origin)) {
      throw new TypeError('Only connect-src may use WebSocket origins');
    }
    byKey.set(`${source.directive}:${origin}`, Object.freeze({ directive: source.directive, origin }));
  }
  const entries = [...byKey.values()].sort((a, b) => a.directive.localeCompare(b.directive) || a.origin.localeCompare(b.origin));
  return {
    sources: Object.freeze(entries),
    requirements: Object.freeze(entries.map(({ directive, origin }) => Object.freeze({
      category: 'network' as const, domain: 'network', operation: `network.${directive}`,
      scope: Object.freeze({ kind: 'origin' as const, value: origin }),
    }))),
  };
}

/**
 * Build the closed browser policy used after shared runtime admission.
 * The legacy host CSP overrides remain a separate compatibility surface.
 *
 * @param options - Mode and exact sources approved through launch admission.
 * @returns A default-deny CSP with no unclassified remote authority.
 * @example buildApprovedNappletCsp({ mode: 'isolated', remoteSources: [] });
 */
export function buildApprovedNappletCsp(options: {
  readonly mode: BrowserLaunchMode;
  readonly remoteSources: readonly BrowserRemoteSource[];
  /** Exact approved development origin used by a host-injected base URL. */
  readonly baseOrigin?: string;
}): string {
  if (!options || Object.keys(options).some((key) => key !== 'mode' && key !== 'remoteSources' && key !== 'baseOrigin')) {
    throw new TypeError('Unknown browser CSP option');
  }
  if (!['isolated', 'mediated-resource', 'direct-network'].includes(options.mode)) throw new TypeError('Invalid browser launch mode');
  const classified = classifyBrowserRemoteSources(options.remoteSources);
  if (options.mode !== 'direct-network' && classified.sources.length) throw new TypeError('Mediated documents cannot have direct browser origins');
  if (options.mode === 'direct-network' && !classified.sources.length) throw new TypeError('Direct network mode needs exact approved origins');
  if (options.baseOrigin !== undefined && (options.mode !== 'direct-network'
    || !/^https?:\/\//.test(options.baseOrigin)
    || connectionOrigin(options.baseOrigin) !== options.baseOrigin
    || !classified.sources.some((source) => source.origin === options.baseOrigin))) {
    throw new TypeError('Development base origin needs matching exact approved network authority');
  }

  const policy: Record<string, readonly string[]> = {
    ...DEFAULT_DIRECTIVES,
    'script-src-elem': ["'unsafe-inline'", "'wasm-unsafe-eval'"],
    'script-src-attr': ["'none'"],
    'style-src-elem': ["'unsafe-inline'"],
    'style-src-attr': ["'unsafe-inline'"],
  };
  if (options.baseOrigin) policy['base-uri'] = [options.baseOrigin];
  for (const directive of REMOTE_DIRECTIVES) {
    const origins = classified.sources.filter((source) => source.directive === directive).map((source) => source.origin);
    if (!origins.length) continue;
    policy[directive] = [...(policy[directive].length === 1 && policy[directive][0] === "'none'" ? [] : policy[directive]), ...origins];
    if (directive === 'script-src') policy['script-src-elem'] = [...policy['script-src-elem'], ...origins];
    if (directive === 'style-src') policy['style-src-elem'] = [...policy['style-src-elem'], ...origins];
  }
  return Object.entries(policy).map(([directive, sources]) => `${directive} ${sources.join(' ')}`).join('; ');
}

// NIP-5D 24711d9c47bbdd07908bf1d52bf677d9cbc530f0: the example is a
// default, not an immutable policy. Kehto enforces its CSP placement and
// exact-connect-origin SHOULDs, and rejects broad JavaScript string evaluation.
const DEFAULT_DIRECTIVES: Readonly<Record<string, readonly string[]>> = {
  'default-src': ["'none'"],
  'script-src': ["'unsafe-inline'", "'wasm-unsafe-eval'"],
  'style-src': ["'unsafe-inline'"],
  'img-src': ['data:', 'blob:'],
  'font-src': ['data:'],
  'connect-src': ["'none'"],
  'worker-src': ["'none'"],
  'child-src': ["'none'"],
  'frame-src': ["'none'"],
  'media-src': ["'none'"],
  'object-src': ["'none'"],
  'manifest-src': ["'none'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
};

const OPTIONAL_DIRECTIVES = new Set([
  'script-src-elem', 'script-src-attr', 'style-src-elem', 'style-src-attr',
]);
const KEYWORDS = new Set([
  "'none'", "'self'", "'unsafe-inline'", "'wasm-unsafe-eval'",
  "'unsafe-hashes'", "'strict-dynamic'", "'report-sample'",
]);

function connectionOrigin(source: string): string {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    throw new Error(`CSP connection grant must be an exact HTTP(S)/WS(S) origin: ${source}`);
  }
  if (!/^(https?|wss?):$/.test(url.protocol) || url.username || url.password
    || url.pathname !== '/' && url.pathname !== '' || url.search || url.hash
    || /[\s*\\;,"<>'`]/.test(source + url.origin) || !source.startsWith(`${url.protocol}//`)) {
    throw new Error(`CSP connection grant must be an exact HTTP(S)/WS(S) origin: ${source}`);
  }
  return url.origin;
}

function validateSources(directive: string, sources: readonly string[]): string[] {
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new Error(`CSP ${directive} needs a nonempty source list; use 'none' to deny it`);
  }
  const result = [...new Set(sources)];
  for (const source of result) {
    if (typeof source !== 'string' || !/^[\x21-\x7e]+$/.test(source)
      || /[;,"<>\\]/.test(source)) {
      throw new Error(`Invalid CSP source in ${directive}`);
    }
    if (source.toLowerCase() === "'unsafe-eval'") {
      throw new Error("NIP-5D CSP forbids 'unsafe-eval'; use 'wasm-unsafe-eval' for WebAssembly");
    }
    if (source.includes("'") && !KEYWORDS.has(source)
      && !/^'(?:nonce-|sha(?:256|384|512)-)[A-Za-z0-9+/_-]+=*'$/.test(source)) {
      throw new Error(`Invalid CSP keyword in ${directive}: ${source}`);
    }
  }
  if (result.includes("'none'") && result.length !== 1) {
    throw new Error(`CSP ${directive} cannot combine 'none' with other sources`);
  }
  return result;
}

function requireBootstrapScripts(directive: string, sources: readonly string[]): void {
  if (!sources.includes("'unsafe-inline'") || sources.some(
    (source) => /^'(?:nonce-|sha(?:256|384|512)-|strict-dynamic')/.test(source),
  )) {
    throw new Error(`CSP ${directive} must allow the shell's inline namespace bootstrap`);
  }
}

/**
 * Build the default NIP-5D CSP with validated host source-list replacements.
 * Meta-unsupported directives must be configured on the host HTTP response.
 *
 * @param options - Explicit connection grants and directive replacements.
 * @returns A serialized policy. Invalid or conflicting overrides throw.
 * @example
 * ```ts
 * const policy = buildNappletCsp({
 *   connectOrigins: ['https://api.example'],
 *   directives: { 'media-src': ['blob:'] },
 * });
 * ```
 */
export function buildNappletCsp(options: NappletCspOptions = {}): string {
  const grants = [...new Set((options.connectOrigins ?? []).map(connectionOrigin))].sort();
  const policy: Record<string, readonly string[]> = {
    ...DEFAULT_DIRECTIVES,
    'connect-src': grants.length ? grants : ["'none'"],
  };
  for (const [directive, sources] of Object.entries(options.directives ?? {})) {
    if (!Object.hasOwn(DEFAULT_DIRECTIVES, directive) && !OPTIONAL_DIRECTIVES.has(directive)) {
      throw new Error(`Unsupported meta CSP directive: ${directive}`);
    }
    policy[directive] = validateSources(directive, sources);
  }
  const connect = policy['connect-src'];
  if (!(connect.length === 1 && connect[0] === "'none'")) {
    policy['connect-src'] = [...new Set(connect.map((source) => {
      const origin = connectionOrigin(source);
      if (!grants.includes(origin)) throw new Error(`CSP connection origin was not granted: ${origin}`);
      return origin;
    }))].sort();
  }
  requireBootstrapScripts('script-src', policy['script-src']);
  if (policy['script-src-elem']) requireBootstrapScripts('script-src-elem', policy['script-src-elem']);
  return Object.entries(policy).map(([name, sources]) => `${name} ${sources.join(' ')}`).join('; ');
}

/**
 * Render the shell's validated CSP meta element.
 *
 * @param options - Explicit connection grants and directive replacements.
 * @returns An attribute-escaped CSP meta element for the first position in head.
 * @example
 * ```ts
 * const meta = renderNappletCspMeta({ directives: { 'img-src': ['data:'] } });
 * ```
 */
export function renderNappletCspMeta(options: NappletCspOptions = {}): string {
  const policy = buildNappletCsp(options).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
}

/**
 * Insert CSP before authored content. The caller must verify the artifact first.
 * Existing authored CSP remains in place and can only further restrict execution.
 *
 * @param html - Already-verified artifact HTML; never use the result for its hash.
 * @param options - Explicit connection grants and directive replacements.
 * @returns A srcdoc copy with the CSP first in head.
 * @example
 * ```ts
 * const protectedHtml = injectNappletCsp(verifiedHtml);
 * ```
 */
export function injectNappletCsp(html: string, options: NappletCspOptions = {}): string {
  return insertNappletHead(html, renderNappletCspMeta(options));
}
