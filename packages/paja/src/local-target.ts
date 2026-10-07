import { computeAggregateHash } from '@kehto/nip/5a';

import type { PajaResolvedPointer } from './runtime-resolver.js';

/**
 * A napplet opened from a local `index.html` file in Paja runtime-pointer mode.
 *
 * Spec-gap decision: NIP-5D's Identity section resolves a signed manifest,
 * fetches the artifact from Blossom, and verifies its hash before it creates
 * the iframe. A local file has no manifest or signature, so it never takes that
 * path. Paja treats local files as an unsigned development target. Identity is
 * still computed from the file's own bytes (never taken from the host), the
 * file loads through the same sandboxed `srcdoc` + CSP + `window.napplet`
 * prelude path as verified pointers, and it never enters the installed
 * napplet catalog. See `docs/policies/NIP-5D-CONFORMANCE.md`.
 */
export interface PajaLocalTarget {
  /** Discriminant separating local files from relay/Blossom-resolved pointers. */
  readonly source: 'local';
  /** File name as reported by the browser file picker or drop event. */
  readonly fileName: string;
  /** `<meta name="napplet-id">` value, or `local-<file stem>` when absent. */
  readonly dTag: string;
  /** NIP-5A aggregate hash over the single `/index.html` path entry. */
  readonly aggregateHash: string;
  /** sha256 of the exact file bytes, lowercase hex. */
  readonly sha256: string;
  /** Decoded file content assigned to `srcdoc` after CSP and prelude injection. */
  readonly indexHtml: string;
  /** Always empty: a local file carries no relay hints. */
  readonly relays: readonly string[];
  /** Always empty: a local file carries no Blossom hints. */
  readonly blossomServers: readonly string[];
  /** Relative `src`/`href` references that cannot load from `srcdoc`. */
  readonly relativeAssets: readonly string[];
}

/** Either a verified pointer target or a local development file target. */
export type PajaRuntimeTarget = PajaResolvedPointer | PajaLocalTarget;

/**
 * File input accepted by {@link createPajaLocalTarget}. A browser `File`
 * satisfies the first shape; tests and tools may pass text directly.
 */
export type PajaLocalFileInput =
  | { readonly name: string; readonly type?: string; arrayBuffer(): Promise<ArrayBuffer> }
  | { readonly name: string; readonly type?: string; readonly text: string };

/** Hint appended to local-file errors and relative-asset warnings. */
export const PAJA_LOCAL_SINGLE_FILE_HINT =
  'Paja opens self-contained single-file index.html only; relative scripts, styles, and images do not load.';

const MAX_DTAG_LENGTH = 128;
const MAX_REPORTED_RELATIVE_ASSETS = 8;

/**
 * Return whether a runtime target was opened from a local file.
 *
 * @param target - Runtime target, or any object carrying a `source` field.
 * @returns `true` for {@link PajaLocalTarget} values.
 *
 * @example
 * ```ts
 * if (isPajaLocalTarget(tab.resolvedTarget)) console.log(tab.resolvedTarget.fileName);
 * ```
 */
export function isPajaLocalTarget(target: object | null | undefined): target is PajaLocalTarget {
  return typeof target === 'object' && target !== null
    && (target as { readonly source?: unknown }).source === 'local';
}

/**
 * Return whether a file name or MIME type identifies an HTML document.
 *
 * @param file - File name and optional MIME type.
 * @returns `true` for `.html`/`.htm` names or a `text/html` type.
 *
 * @example
 * ```ts
 * isPajaLocalHtmlFile({ name: 'index.html' }); // true
 * ```
 */
export function isPajaLocalHtmlFile(file: { readonly name: string; readonly type?: string }): boolean {
  const type = (file.type ?? '').split(';')[0]?.trim().toLowerCase();
  return type === 'text/html' || /\.html?$/i.test(file.name.trim());
}

/**
 * Build a local runtime target from an `index.html` file.
 *
 * The identity is computed from the file bytes: `sha256` is the digest of the
 * exact bytes and `aggregateHash` is the NIP-5A aggregate over
 * `[{ path: '/index.html', sha256 }]`, the same derivation Paja's resolver
 * verifies for a published single-file napplet. Editing the file gives it a
 * new identity.
 *
 * @param file - Browser `File` or `{ name, text }`.
 * @returns The local target.
 * @throws Error when the file is not HTML or is empty.
 *
 * @example
 * ```ts
 * const target = await createPajaLocalTarget({ name: 'index.html', text: '<!doctype html>…' });
 * target.dTag; // 'local-index'
 * ```
 */
export async function createPajaLocalTarget(file: PajaLocalFileInput): Promise<PajaLocalTarget> {
  const fileName = file.name.trim() || 'index.html';
  if (!isPajaLocalHtmlFile(file)) {
    throw new Error(`"${fileName}" is not an HTML file. ${PAJA_LOCAL_SINGLE_FILE_HINT}`);
  }
  const bytes = 'arrayBuffer' in file
    ? new Uint8Array(await file.arrayBuffer())
    : new TextEncoder().encode(file.text);
  const indexHtml = new TextDecoder().decode(bytes);
  if (indexHtml.trim().length === 0) {
    throw new Error(`"${fileName}" is empty.`);
  }
  const sha256 = await sha256Hex(bytes);
  return Object.freeze({
    source: 'local',
    fileName,
    dTag: readNappletIdMeta(indexHtml) ?? localDTag(fileName),
    aggregateHash: computeAggregateHash([{ path: '/index.html', sha256 }]),
    sha256,
    indexHtml,
    relays: Object.freeze([]),
    blossomServers: Object.freeze([]),
    relativeAssets: Object.freeze(findRelativeAssetReferences(indexHtml)),
  });
}

/**
 * Read the NIP-5D publishing metadata `<meta name="napplet-id" content="…">`.
 *
 * @param html - HTML document text.
 * @returns The trimmed id, or `undefined` when absent or blank.
 *
 * @example
 * ```ts
 * readNappletIdMeta('<meta name="napplet-id" content="feed">'); // 'feed'
 * ```
 */
export function readNappletIdMeta(html: string): string | undefined {
  for (const match of html.matchAll(/<meta\b([^>]*)>/gi)) {
    const attributes = parseAttributes(match[1] ?? '');
    if (attributes.get('name')?.toLowerCase() !== 'napplet-id') continue;
    const value = attributes.get('content')?.trim();
    if (value) return value.slice(0, MAX_DTAG_LENGTH);
  }
  return undefined;
}

/**
 * List relative `src`/`href` references that a `srcdoc` document cannot load.
 *
 * @param html - HTML document text.
 * @returns Up to eight distinct relative references, in document order.
 *
 * @example
 * ```ts
 * findRelativeAssetReferences('<script src="./main.js"></script>'); // ['./main.js']
 * ```
 */
export function findRelativeAssetReferences(html: string): string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(/<(?:script|link|img|source|iframe)\b([^>]*)>/gi)) {
    const attributes = parseAttributes(match[1] ?? '');
    const reference = attributes.get('src') ?? attributes.get('href');
    if (reference && isRelativeReference(reference)) found.add(reference.trim());
    if (found.size >= MAX_REPORTED_RELATIVE_ASSETS) break;
  }
  return [...found];
}

function isRelativeReference(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.startsWith('#')) return false;
  return !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(trimmed);
}

function parseAttributes(source: string): Map<string, string> {
  const attributes = new Map<string, string>();
  const pattern = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of source.matchAll(pattern)) {
    const name = match[1]?.toLowerCase();
    if (!name || attributes.has(name)) continue;
    attributes.set(name, match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attributes;
}

function localDTag(fileName: string): string {
  const stem = fileName.replace(/\.[^.]*$/, '');
  const slug = stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `local-${slug || 'napplet'}`.slice(0, MAX_DTAG_LENGTH);
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
