const BLOSSOM_URI = /^blossom:(?:sha256:)?([0-9a-f]{64})(?:\.([0-9a-z]+))?(?:\?([^#]*))?$/i;
const HEX_64 = /^[0-9a-f]{64}$/i;
const MAX_HINTS = 8;

/** Internal read grammar; extensionless and mixed-case hashes are local compatibility. */
export interface PajaBlossomUri {
  readonly hash: string;
  readonly canonical: string;
  readonly extension?: string;
  readonly servers: string[];
  readonly authors: string[];
  readonly expectedSize?: number;
}

/** Parse untrusted URI syntax before any host discovery or transport. */
export function parsePajaBlossomUri(value: string): PajaBlossomUri | null {
  if (value.length > 8192 || /[\s\u0000-\u001f\u007f]/u.test(value)) return null;
  const match = BLOSSOM_URI.exec(value);
  if (!match?.[1]) return null;
  const query = match[3] ?? '';
  // URLSearchParams tolerates malformed escapes; this boundary must not.
  try {
    decodeURIComponent(query);
  } catch {
    return null;
  }
  const params = new URLSearchParams(query);
  const authors: string[] = [];
  for (const author of params.getAll('as')) {
    if (!HEX_64.test(author)) return null;
    appendHint(authors, author.toLowerCase());
  }
  const sizes = params.getAll('sz');
  if (sizes.length > 1) return null;
  let expectedSize: number | undefined;
  if (sizes.length === 1) {
    if (!/^[0-9]+$/u.test(sizes[0]!)) return null;
    expectedSize = Number(sizes[0]);
    if (!Number.isSafeInteger(expectedSize) || expectedSize <= 0) return null;
  }
  const servers: string[] = [];
  for (const server of params.getAll('xs')) appendHint(servers, server);
  const hash = match[1].toLowerCase();
  return { hash, canonical: `blossom:sha256:${hash}`, extension: match[2], servers, authors, expectedSize };
}

function appendHint(target: string[], value: string): void {
  if (target.length < MAX_HINTS && !target.includes(value)) target.push(value);
}
