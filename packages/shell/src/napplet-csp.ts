import { insertNappletHead } from './napplet-head.js';

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
