/**
 * domains/git-fixtures.ts — In-memory Git object model with real SHA-1 ids,
 * plus the seeded `distro-notes` repository used by the git mock.
 *
 * Objects are encoded exactly as Git does (`<type> <size>\0<body>`), so every
 * id here matches what `git hash-object` / `git commit` produce for the same
 * bytes. Blobs hold notes about the Linux distribution catalog.
 */
import { LINUX_DISTROS } from '../fixtures/linux-distros.js';
import { bytesToHex, hexToBytes, linuxDistroSums, utf8Bytes, utf8Text } from './file-bytes.js';

/** Author/committer header the fixture repository and the NAP example use. */
export const DEFAULT_GIT_IDENTITY = 'Example <example@example.org> 0 +0000';

/** Git object kinds. */
export type GitObjectKind = 'blob' | 'tree' | 'commit' | 'tag';

/** Tree entry modes accepted by NAP-GIT. */
export type GitTreeMode = '040000' | '100644' | '100755' | '120000' | '160000';

/**
 * One stored object: kind and uncompressed body (without the Git header).
 *
 * @example
 * ```ts
 * const object: GitStoredObject = { kind: 'blob', body: new Uint8Array([72, 105, 10]) };
 * ```
 */
export interface GitStoredObject { kind: GitObjectKind; body: Uint8Array }

/**
 * A decoded tree entry: raw name bytes, mode, and child id.
 *
 * @example
 * ```ts
 * const entry: GitTreeEntryRaw = { name: utf8Bytes('README.md'), mode: '100644', oid: 'e965047ad7c57865823c7d992b1d046ea66edf78' };
 * ```
 */
export interface GitTreeEntryRaw { name: Uint8Array; mode: GitTreeMode; oid: string }

/**
 * A decoded commit.
 *
 * @example
 * ```ts
 * const commit: GitCommitRaw = { tree: '…', parents: [], author: 'Example <example@example.org> 0 +0000', committer: 'Example <example@example.org> 0 +0000', message: 'Initial\n' };
 * ```
 */
export interface GitCommitRaw { tree: string; parents: string[]; author: string; committer: string; message: string }

function rotl(value: number, bits: number): number {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0;
}

/**
 * SHA-1 digest (used only for Git object ids; not a security primitive).
 *
 * @param bytes - Input bytes.
 * @returns 40-hex digest.
 * @example
 * ```ts
 * sha1(new Uint8Array(0)) === 'da39a3ee5e6b4b0d3255bfef95601890afd80709';
 * ```
 */
export function sha1(bytes: Uint8Array): string {
  const length = bytes.length;
  const padded = new Uint8Array(Math.ceil((length + 9) / 64) * 64);
  padded.set(bytes);
  padded[length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, (length * 8) >>> 0);
  view.setUint32(padded.length - 8, Math.floor((length * 8) / 0x100000000));
  let [h0, h1, h2, h3, h4] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const words = new Uint32Array(80);
  for (let chunk = 0; chunk < padded.length; chunk += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(chunk + index * 4);
    for (let index = 16; index < 80; index += 1) words[index] = rotl(words[index - 3]! ^ words[index - 8]! ^ words[index - 14]! ^ words[index - 16]!, 1);
    let [a, b, c, d, e] = [h0, h1, h2, h3, h4];
    for (let index = 0; index < 80; index += 1) {
      const [f, k] = index < 20 ? [(b & c) | (~b & d), 0x5a827999]
        : index < 40 ? [b ^ c ^ d, 0x6ed9eba1]
          : index < 60 ? [(b & c) | (b & d) | (c & d), 0x8f1bbcdc]
            : [b ^ c ^ d, 0xca62c1d6];
      const temp = (rotl(a, 5) + f + e + k + words[index]!) >>> 0;
      [e, d, c, b, a] = [d, c, rotl(b, 30), a, temp];
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  return [h0, h1, h2, h3, h4].map((word) => word.toString(16).padStart(8, '0')).join('');
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

/**
 * Git object id of `kind` + `body` (hashes the `<kind> <size>\0` header too).
 *
 * @param kind - Object kind.
 * @param body - Uncompressed body.
 * @returns 40-hex id.
 * @example
 * ```ts
 * gitObjectId('blob', utf8Bytes('Hello\n')) === 'e965047ad7c57865823c7d992b1d046ea66edf78';
 * ```
 */
export function gitObjectId(kind: GitObjectKind, body: Uint8Array): string {
  return sha1(concat([utf8Bytes(`${kind} ${body.length}\0`), body]));
}

function compareBytes(left: Uint8Array, right: Uint8Array): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) if (left[index] !== right[index]) return left[index]! - right[index]!;
  return left.length - right.length;
}

function treeSortKey(entry: GitTreeEntryRaw): Uint8Array {
  return entry.mode === '040000' ? concat([entry.name, utf8Bytes('/')]) : entry.name;
}

/**
 * Encode tree entries as a Git tree body (sorted the way Git sorts them).
 *
 * @param entries - Entries in any order.
 * @returns Tree body bytes.
 * @example
 * ```ts
 * gitObjectId('tree', encodeTree([{ name: utf8Bytes('README.md'), mode: '100644', oid: 'e965047ad7c57865823c7d992b1d046ea66edf78' }])) === 'dc0a29da1d9b3f68dcd56af0e34f8df4fbf8b24f';
 * ```
 */
export function encodeTree(entries: readonly GitTreeEntryRaw[]): Uint8Array {
  const sorted = [...entries].sort((left, right) => compareBytes(treeSortKey(left), treeSortKey(right)));
  return concat(sorted.flatMap((entry) => [utf8Bytes(`${entry.mode === '040000' ? '40000' : entry.mode} `), entry.name, new Uint8Array([0]), hexToBytes(entry.oid)]));
}

/**
 * Decode a Git tree body.
 *
 * @param body - Tree body bytes.
 * @returns Entries in stored order.
 * @example
 * ```ts
 * decodeTree(encodeTree(entries)).length === entries.length;
 * ```
 */
export function decodeTree(body: Uint8Array): GitTreeEntryRaw[] {
  const entries: GitTreeEntryRaw[] = [];
  let index = 0;
  while (index < body.length) {
    const space = body.indexOf(0x20, index);
    const nul = body.indexOf(0, space);
    const mode = utf8Text(body.subarray(index, space));
    entries.push({ mode: (mode === '40000' ? '040000' : mode) as GitTreeMode, name: body.slice(space + 1, nul), oid: bytesToHex(body.subarray(nul + 1, nul + 21)) });
    index = nul + 21;
  }
  return entries;
}

/**
 * Encode a commit body.
 *
 * @param commit - Commit fields.
 * @returns Commit body bytes.
 * @example
 * ```ts
 * encodeCommit({ tree, parents: [], author: DEFAULT_GIT_IDENTITY, committer: DEFAULT_GIT_IDENTITY, message: 'Initial\n' });
 * ```
 */
export function encodeCommit(commit: GitCommitRaw): Uint8Array {
  const lines = [`tree ${commit.tree}`, ...commit.parents.map((parent) => `parent ${parent}`), `author ${commit.author}`, `committer ${commit.committer}`, ''];
  return concat([utf8Bytes(`${lines.join('\n')}\n`), utf8Bytes(commit.message)]);
}

/**
 * Decode a commit body.
 *
 * @param body - Commit body bytes.
 * @returns Commit fields.
 * @example
 * ```ts
 * decodeCommit(encodeCommit(commit)).message === commit.message;
 * ```
 */
export function decodeCommit(body: Uint8Array): GitCommitRaw {
  const text = utf8Text(body);
  const split = text.indexOf('\n\n');
  const headers = text.slice(0, split).split('\n');
  const value = (name: string): string => headers.find((line) => line.startsWith(`${name} `))?.slice(name.length + 1) ?? '';
  return {
    tree: value('tree'),
    parents: headers.filter((line) => line.startsWith('parent ')).map((line) => line.slice(7)),
    author: value('author'),
    committer: value('committer'),
    message: text.slice(split + 2),
  };
}

/**
 * Encode an annotated tag body.
 *
 * @param tag - Target id, target kind, tag name, tagger header, message.
 * @returns Tag body bytes.
 * @example
 * ```ts
 * encodeTag({ object: commitId, type: 'commit', tag: 'v0.1', tagger: DEFAULT_GIT_IDENTITY, message: 'First notes\n' });
 * ```
 */
export function encodeTag(tag: { object: string; type: GitObjectKind; tag: string; tagger: string; message: string }): Uint8Array {
  return utf8Bytes(`object ${tag.object}\ntype ${tag.type}\ntag ${tag.tag}\ntagger ${tag.tagger}\n\n${tag.message}`);
}

/**
 * Target object id of an annotated tag body.
 *
 * @param body - Tag body bytes.
 * @returns The `object` header value.
 * @example
 * ```ts
 * tagTarget(encodeTag(tag)) === tag.object;
 * ```
 */
export function tagTarget(body: Uint8Array): string {
  return /^object ([0-9a-f]{40})/.exec(utf8Text(body))?.[1] ?? '';
}

/**
 * Content-addressed object store.
 *
 * @example
 * ```ts
 * const store = new GitObjectStore();
 * const oid = store.put('blob', utf8Bytes('Hi\n'));
 * store.get(oid)?.kind === 'blob';
 * ```
 */
export class GitObjectStore {
  private readonly objects = new Map<string, GitStoredObject>();

  /**
   * Store an object and return its id (idempotent).
   *
   * @param kind - Object kind.
   * @param body - Uncompressed body.
   * @returns 40-hex id.
   */
  put(kind: GitObjectKind, body: Uint8Array): string {
    const oid = gitObjectId(kind, body);
    this.objects.set(oid, { kind, body });
    return oid;
  }

  /**
   * Fetch an object.
   *
   * @param oid - 40-hex id.
   * @returns The object or `undefined`.
   */
  get(oid: string): GitStoredObject | undefined {
    return this.objects.get(oid);
  }

  /** Number of stored objects. */
  get size(): number {
    return this.objects.size;
  }

  /**
   * Whether `ancestor` is reachable from `descendant` (inclusive).
   *
   * @param ancestor - Candidate ancestor commit id.
   * @param descendant - Starting commit id.
   * @returns `true` when reachable.
   */
  isAncestor(ancestor: string, descendant: string): boolean {
    const seen = new Set<string>();
    const queue = [descendant];
    while (queue.length > 0) {
      const oid = queue.pop()!;
      if (oid === ancestor) return true;
      if (seen.has(oid)) continue;
      seen.add(oid);
      const object = this.objects.get(oid);
      if (object?.kind === 'commit') queue.push(...decodeCommit(object.body).parents);
    }
    return false;
  }
}

/**
 * A seeded repository: objects, local refs, and the ids tests assert.
 *
 * @example
 * ```ts
 * const repo = seedDistroNotesRepo();
 * repo.refs.get('refs/heads/main') === repo.commits[1];
 * ```
 */
export interface SeededGitRepo {
  /** Object store. */
  store: GitObjectStore;
  /** Local references (`refs/heads/main`, `refs/tags/v0.1`). */
  refs: Map<string, string>;
  /** Root commit then second commit. */
  commits: [string, string];
}

/**
 * Build the `distro-notes` repository: a root commit with `README.md` and
 * `notes/debian.md`, a second commit adding `notes/arch.md` and `SHA256SUMS`,
 * `refs/heads/main` at the second commit, and annotated tag `refs/tags/v0.1`
 * at the root commit.
 *
 * @param identity - Author/committer/tagger header. Default `DEFAULT_GIT_IDENTITY`.
 * @returns Store, refs, and commit ids.
 * @example
 * ```ts
 * seedDistroNotesRepo().commits[0] === '06502b95ecc3bafcddf5ae6bced91ded3382f688';
 * ```
 */
export function seedDistroNotesRepo(identity = DEFAULT_GIT_IDENTITY): SeededGitRepo {
  const store = new GitObjectStore();
  const blob = (text: string): string => store.put('blob', utf8Bytes(text));
  const tree = (entries: Array<[string, GitTreeMode, string]>): string =>
    store.put('tree', encodeTree(entries.map(([name, mode, oid]) => ({ name: utf8Bytes(name), mode, oid }))));
  const commit = (treeId: string, parents: string[], message: string): string =>
    store.put('commit', encodeCommit({ tree: treeId, parents, author: identity, committer: identity, message }));

  const readme = blob('# distro-notes\n\nNotes on Linux distribution images.\n');
  const debian = blob('# Debian 12.7.0\n\nFile: debian-12.7.0-amd64-netinst.iso\n');
  const notes1 = tree([['debian.md', '100644', debian]]);
  const root1 = tree([['README.md', '100644', readme], ['notes', '040000', notes1]]);
  const first = commit(root1, [], 'Add distro notes\n');

  const arch = blob('# Arch Linux 2024.11.01\n\nFile: archlinux-2024.11.01-x86_64.iso\n');
  const sums = blob(linuxDistroSums(LINUX_DISTROS));
  const notes2 = tree([['debian.md', '100644', debian], ['arch.md', '100644', arch]]);
  const root2 = tree([['README.md', '100644', readme], ['SHA256SUMS', '100644', sums], ['notes', '040000', notes2]]);
  const second = commit(root2, [first], 'Add SHA256SUMS\n');
  const tag = store.put('tag', encodeTag({ object: first, type: 'commit', tag: 'v0.1', tagger: identity, message: 'First notes\n' }));

  return { store, refs: new Map([['refs/heads/main', second], ['refs/tags/v0.1', tag]]), commits: [first, second] };
}
