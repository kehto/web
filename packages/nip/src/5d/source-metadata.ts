// NIP-5D §Source at dskvr/nips@6e24617cde507c0a87fa170af9ed6b2b46545b2d.
// Every field here is informational metadata. A malformed or repeated tag is
// ignored, never fatal: missing source metadata MUST NOT prevent playback.

const HASH = /^[a-f0-9]{64}$/;
const GIT_COMMIT = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const SCP_LOCATION = /^(?:[^@\s/:]+@)?[^:\s/]+:[^\s]+$/;
const WINDOWS_DRIVE = /^[a-z]:[\\/]/i;
const MIME_TYPE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;

/** Independently downloadable source archive from a `source-archive` tag. */
export interface SourceArchive {
  /** Absolute HTTPS URL without credentials or a fragment. */
  url: string;
  /** Lowercase-hex SHA-256 of the archive bytes before decompression. */
  sha256: string;
  /** Declared archive MIME type. */
  mimeType: string;
}

/** Source metadata accepted from a manifest after the spec's ignore rules. */
export interface SourceMetadata {
  /** Repository or archive location from the single well-formed `source` tag. */
  source?: string;
  /** Full Git commit ID pinned for `source`; absent without a repository source. */
  sourceCommit?: string;
  /** Verified-later archive declaration; clients MUST check its digest before use. */
  sourceArchive?: SourceArchive;
}

/**
 * Whether `value` is a NIP-5D source location: an absolute `http`, `https`,
 * `ssh`, `git` or `nostr` URL, or Git's scp-like `[user@]host:path` syntax.
 * Local paths and `file` URLs are rejected.
 *
 * @param value - Candidate `source` tag value
 * @returns `true` only for an accepted location format
 * @example
 * isSourceLocation('git@git.example.com:owner/napplet.git'); // true
 */
export function isSourceLocation(value: string | undefined): boolean {
  if (!value || /\s/.test(value) || WINDOWS_DRIVE.test(value)) return false;
  try {
    const { protocol } = new URL(value);
    if (['http:', 'https:', 'ssh:', 'git:'].includes(protocol)) return true;
    // NIP-34 Nostr clone URLs identify a kind-30617 repository announcement.
    if (protocol === 'nostr:') return value.startsWith('nostr://') && value.length > 'nostr://'.length;
  } catch {
    // scp-like clone locations are not necessarily parseable as URLs.
  }
  // `host:path` without a user parses as a URL scheme, so other schemes fall
  // through to the scp-like check, which rejects anything carrying `://`.
  return !value.includes('://') && SCP_LOCATION.test(value);
}

function isArchiveUrl(value: string | undefined): boolean {
  if (!value || value.includes('#')) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function sourceArchiveFromTags(tags: readonly (readonly string[])[]): SourceArchive | undefined {
  const archives = tags.filter((tag) => tag[0] === 'source-archive');
  if (archives.length !== 1) return undefined;
  const [, url, sha256, mimeType] = archives[0];
  if (archives[0].length !== 4 || !isArchiveUrl(url) || !HASH.test(sha256) || !MIME_TYPE.test(mimeType)) {
    return undefined;
  }
  return { url, sha256, mimeType };
}

/**
 * Parse `source`, `source-commit` and `source-archive` tags with the NIP-5D
 * ignore rules: each field must appear once and be well-formed, and a commit
 * pin is kept only alongside a usable repository `source`.
 *
 * Spec-gap decision: an HTTP(S) `source` may name a repository or an archive
 * and the two cannot be distinguished from the location alone, so any accepted
 * `source` location retains an otherwise valid `source-commit`.
 *
 * @param tags - Manifest event tags
 * @returns Accepted fields; omitted fields were absent or ignored
 * @example
 * const { source, sourceCommit } = parseSourceMetadata(event.tags);
 */
export function parseSourceMetadata(tags: readonly (readonly string[])[]): SourceMetadata {
  const metadata: SourceMetadata = {};
  const sources = tags.filter((tag) => tag[0] === 'source');
  if (sources.length === 1 && sources[0].length === 2 && isSourceLocation(sources[0][1])) {
    metadata.source = sources[0][1];
  }
  const commits = tags.filter((tag) => tag[0] === 'source-commit');
  if (metadata.source !== undefined && commits.length === 1 && commits[0].length === 2
    && GIT_COMMIT.test(commits[0][1])) {
    metadata.sourceCommit = commits[0][1];
  }
  const sourceArchive = sourceArchiveFromTags(tags);
  if (sourceArchive) metadata.sourceArchive = sourceArchive;
  return metadata;
}
