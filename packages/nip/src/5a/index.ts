import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

/**
 * `@kehto/nip/5a` — NIP-5A "Aggregate Hash" computation and verification.
 *
 * NIP-5A (`nostr-protocol/nips` PR #2287) defines a content address for a set
 * of published files. Each file is declared by a `path` tag
 * (`["path", "<abs-path>", "<sha256>"]`) and the set is summarized by a single
 * aggregate `x` tag (`["x", "<hex>", "aggregate"]`).
 *
 * The aggregate is computed by:
 * 1. taking every `path` entry as the line `"<sha256> <abs-path>\n"`,
 * 2. sorting the lines in ascending lexicographic order,
 * 3. concatenating them as UTF-8 bytes,
 * 4. hashing with SHA-256, encoded as lowercase hex.
 *
 * @module
 */

// TextEncoder is available in all JS runtimes but not in the ES2022 lib types.
declare class TextEncoder { encode(input: string): Uint8Array; }

/**
 * One published file: an absolute path and the lowercase-hex SHA-256 of its
 * bytes. Parsed from a NIP-5A `["path", "<abs-path>", "<sha256>"]` tag.
 *
 * @example
 * ```ts
 * const entry: PathEntry = { path: '/index.html', sha256: '186ea5…1c99' };
 * ```
 */
export interface PathEntry {
  /** Absolute path of the file (the `path` tag's second element). */
  path: string;
  /** Lowercase-hex SHA-256 of the file bytes (the `path` tag's third element). */
  sha256: string;
}

/**
 * Compute the NIP-5A aggregate hash over a set of {@link PathEntry} files.
 *
 * Lines (`"<sha256> <abs-path>\n"`) are sorted before hashing, so the result is
 * independent of the input order.
 *
 * @param entries - The file path entries (any order)
 * @returns The aggregate hash as lowercase hex
 *
 * @example
 * ```ts
 * import { computeAggregateHash } from '@kehto/nip/5a';
 * const hex = computeAggregateHash([{ path: '/index.html', sha256: 'aa…' }]);
 * ```
 */
export function computeAggregateHash(entries: readonly PathEntry[]): string {
  const lines = entries.map((entry) => `${entry.sha256} ${entry.path}\n`);
  lines.sort();
  return bytesToHex(sha256(new TextEncoder().encode(lines.join(''))));
}

/**
 * Extract {@link PathEntry} objects from an event's tags, keeping only
 * well-formed `["path", "<abs-path>", "<sha256>"]` tags in tag order.
 *
 * @param tags - The manifest event's tags
 * @returns Parsed path entries (malformed `path` tags are skipped)
 */
export function pathEntriesFromTags(tags: readonly (readonly string[])[]): PathEntry[] {
  const entries: PathEntry[] = [];
  for (const tag of tags) {
    if (tag[0] === 'path' && typeof tag[1] === 'string' && typeof tag[2] === 'string'
      && tag[1].length > 0 && tag[2].length > 0) {
      entries.push({ path: tag[1], sha256: tag[2] });
    }
  }
  return entries;
}

/**
 * Read the aggregate hash declared by an event's `["x", "<hex>", "aggregate"]`
 * tag.
 *
 * @param tags - The manifest event's tags
 * @returns The declared aggregate hex, or `undefined` if no aggregate `x` tag
 */
export function aggregateTagValue(tags: readonly (readonly string[])[]): string | undefined {
  for (const tag of tags) {
    if (tag[0] === 'x' && tag[2] === 'aggregate' && typeof tag[1] === 'string' && tag[1].length > 0) {
      return tag[1];
    }
  }
  return undefined;
}

/**
 * Verify that an event's declared aggregate `x` tag equals the aggregate
 * recomputed from its `path` tags.
 *
 * @param tags - The manifest event's tags
 * @returns `true` only when an aggregate `x` tag is present and matches the
 *   recomputed value; `false` otherwise (mismatch or missing aggregate tag)
 *
 * @example
 * ```ts
 * import { verifyAggregate } from '@kehto/nip/5a';
 * if (!verifyAggregate(manifestEvent.tags)) throw new Error('aggregate mismatch');
 * ```
 */
export function verifyAggregate(tags: readonly (readonly string[])[]): boolean {
  const declared = aggregateTagValue(tags);
  if (!declared) return false;
  return computeAggregateHash(pathEntriesFromTags(tags)) === declared;
}
