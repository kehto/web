/** Durable storage key for Paja's versioned signer-consent records. */
export const PAJA_SIGNER_CONSENT_STORAGE_KEY = 'kehto:paja:signer-consent:v1';

const PAJA_SIGNER_CONSENT_VERSION = 1;
const MAX_CONSENT_SUBJECTS = 128;
const MAX_KINDS_PER_SUBJECT = 128;
const MAX_IDENTITY_FIELD_LENGTH = 512;
let warnedLegacyConsent = false;

/** Napplet source attached to a window-scoped signer request. */
export interface PajaSignerSource {
  /** Originating runtime window. */
  readonly windowId: string;
  /** Host-owned napplet identity. Runtime-pointer hashes identify verified artifacts. */
  readonly napplet: {
    readonly dTag: string;
    readonly aggregateHash: string;
  };
  /** Stable Paja target boundary: exact direct URL or verified artifact hash. */
  readonly runtimeScope: string;
  /** Host-owned lifecycle check; never persisted or supplied by a napplet. */
  readonly isCurrent?: () => boolean;
}

/** Source identity plus the signer account whose authority is being granted. */
export interface PajaSignerRequestContext extends PajaSignerSource {
  /** Active signer public key, or host-generated for document-scoped ephemeral transport events. */
  readonly signerPubkey: string;
}

/** Scope of a remembered signer decision that matched a request. */
export type PajaSignerConsentMatch = 'kind' | 'napplet';
/** Signing and relay publication are separate permissions. */
export type PajaConsentAction = 'sign' | 'publish';

export interface PajaSignerConsentStore {
  /** Return the remembered scope that authorizes this context and event kind. */
  match(context: PajaSignerRequestContext, kind: number, action?: PajaConsentAction): PajaSignerConsentMatch | null;
  /** Remember one event kind for the exact signer, napplet identity, and target. */
  rememberKind(context: PajaSignerRequestContext, kind: number, action?: PajaConsentAction): boolean;
  /** Trust all event kinds for the exact signer, napplet identity, and target. */
  trustNapplet(context: PajaSignerRequestContext, action?: PajaConsentAction): boolean;
  /** Explicitly allow signing and publishing for this exact version and account. */
  trustVersion(context: PajaSignerRequestContext): boolean;
  /** Remove every remembered signer decision, returning false if durable revocation fails. */
  clear(): boolean;
  /** Count remembered kind grants plus exact-napplet trust grants. */
  count(): number;
}

interface SignerConsentRecord {
  signerPubkey: string;
  dTag: string;
  aggregateHash: string;
  runtimeScope: string;
  trusted: boolean;
  kinds: number[];
  publishTrusted: boolean;
  publishKinds: number[];
}

interface SignerConsentDocument {
  version: typeof PAJA_SIGNER_CONSENT_VERSION;
  grants: SignerConsentRecord[];
}

/**
 * Create Paja's signer-consent store.
 *
 * Grants are bound to the signer pubkey, napplet d-tag, aggregate hash, and
 * Paja runtime target. Storage is best-effort: an unavailable browser store
 * retains choices only for the current page lifetime and never makes signing
 * less restrictive.
 *
 * @param storage - Durable browser storage, or null for memory-only behavior
 * @returns Exact-identity consent store
 */
export function createPajaSignerConsentStore(
  storage: Storage | null = readPajaSignerConsentStorage(),
): PajaSignerConsentStore {
  let grants = readConsentDocument(storage).grants;

  const persist = (): void => {
    if (!storage) return;
    const document: SignerConsentDocument = {
      version: PAJA_SIGNER_CONSENT_VERSION,
      grants,
    };
    try {
      storage.setItem(PAJA_SIGNER_CONSENT_STORAGE_KEY, JSON.stringify(document));
    } catch {
      // Keep the current page's in-memory decisions when persistence is denied.
    }
  };

  const recordFor = (context: PajaSignerRequestContext): SignerConsentRecord | null => {
    const subject = normalizeContext(context);
    if (!subject) return null;
    return grants.find((grant) => sameSubject(grant, subject)) ?? null;
  };

  const ensureRecord = (context: PajaSignerRequestContext): SignerConsentRecord | null => {
    const subject = normalizeContext(context);
    if (!subject) return null;
    const existing = grants.find((grant) => sameSubject(grant, subject));
    if (existing) return existing;
    if (grants.length >= MAX_CONSENT_SUBJECTS) return null;
    const created: SignerConsentRecord = { ...subject, trusted: false, kinds: [], publishTrusted: false, publishKinds: [] };
    grants = [...grants, created];
    return created;
  };

  return {
    match(context, kind, action = 'sign') {
      if (context.isCurrent && !context.isCurrent()) return null;
      const normalizedKind = normalizeKind(kind);
      if (normalizedKind === null) return null;
      const record = recordFor(context);
      if (!record) return null;
      const trusted = action === 'sign' ? record.trusted : record.publishTrusted;
      const kinds = action === 'sign' ? record.kinds : record.publishKinds;
      if (trusted) return 'napplet';
      return kinds.includes(normalizedKind) ? 'kind' : null;
    },
    rememberKind(context, kind, action = 'sign') {
      if (context.isCurrent && !context.isCurrent()) return false;
      const normalizedKind = normalizeKind(kind);
      if (normalizedKind === null) return false;
      const record = ensureRecord(context);
      if (!record) return false;
      const kinds = action === 'sign' ? record.kinds : record.publishKinds;
      if ((action === 'sign' ? record.trusted : record.publishTrusted) || kinds.includes(normalizedKind)) return true;
      if (kinds.length >= MAX_KINDS_PER_SUBJECT) return false;
      const next = [...kinds, normalizedKind].sort((left, right) => left - right);
      if (action === 'sign') record.kinds = next;
      else record.publishKinds = next;
      persist();
      return true;
    },
    trustNapplet(context, action = 'sign') {
      if (context.isCurrent && !context.isCurrent()) return false;
      const record = ensureRecord(context);
      if (!record) return false;
      if (action === 'sign') { record.trusted = true; record.kinds = []; }
      else { record.publishTrusted = true; record.publishKinds = []; }
      persist();
      return true;
    },
    trustVersion(context) {
      if (context.isCurrent && !context.isCurrent()) return false;
      const record = ensureRecord(context);
      if (!record) return false;
      record.trusted = true; record.kinds = [];
      record.publishTrusted = true; record.publishKinds = [];
      persist();
      return true;
    },
    clear() {
      const previous = grants;
      grants = [];
      if (!storage) return true;
      try {
        storage.removeItem(PAJA_SIGNER_CONSENT_STORAGE_KEY);
        return true;
      } catch {
        try {
          const empty: SignerConsentDocument = {
            version: PAJA_SIGNER_CONSENT_VERSION,
            grants: [],
          };
          storage.setItem(PAJA_SIGNER_CONSENT_STORAGE_KEY, JSON.stringify(empty));
          return true;
        } catch {
          grants = previous;
          return false;
        }
      }
    },
    count() {
      return grants.reduce((total, grant) => total + (grant.trusted ? 1 : grant.kinds.length)
        + (grant.publishTrusted ? 1 : grant.publishKinds.length), 0);
    },
  };
}

/** Return whether Paja can safely persist decisions for this signer context. */
export function isPajaSignerConsentContext(
  context: PajaSignerRequestContext,
): boolean {
  return normalizeContext(context) !== null;
}

function readPajaSignerConsentStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readConsentDocument(storage: Storage | null): SignerConsentDocument {
  const empty = (): SignerConsentDocument => ({ version: PAJA_SIGNER_CONSENT_VERSION, grants: [] });
  if (!storage) return empty();
  try {
    const raw = storage.getItem(PAJA_SIGNER_CONSENT_STORAGE_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as { version?: unknown; grants?: unknown };
    if (parsed.version !== PAJA_SIGNER_CONSENT_VERSION || !Array.isArray(parsed.grants)) return empty();
    const grants: SignerConsentRecord[] = [];
    for (const candidate of parsed.grants.slice(0, MAX_CONSENT_SUBJECTS)) {
      const record = normalizeRecord(candidate);
      if (!record || grants.some((existing) => sameSubject(existing, record))) continue;
      if (!warnedLegacyConsent && candidate && typeof candidate === 'object'
        && !('publishTrusted' in candidate) && !('publishKinds' in candidate)) {
        warnedLegacyConsent = true;
        console.warn('[KEHTO-PAJA-SIGNER-CONSENT-V1] Loaded older signing-only approvals. Publishing still requires approval; review the current napplet version to allow signing and publishing together. This warning appears once per host module lifetime.');
      }
      grants.push(record);
    }
    return { version: PAJA_SIGNER_CONSENT_VERSION, grants };
  } catch {
    return empty();
  }
}

function normalizeRecord(value: unknown): SignerConsentRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const subject = normalizeSubject(
    candidate.signerPubkey,
    candidate.dTag,
    candidate.aggregateHash,
    candidate.runtimeScope,
  );
  if (!subject || typeof candidate.trusted !== 'boolean' || !Array.isArray(candidate.kinds)) return null;
  const kinds = [...new Set(candidate.kinds
    .map((kind) => normalizeKind(kind))
    .filter((kind): kind is number => kind !== null))]
    .slice(0, MAX_KINDS_PER_SUBJECT)
    .sort((left, right) => left - right);
  return {
    ...subject,
    trusted: candidate.trusted,
    kinds: candidate.trusted ? [] : kinds,
    // Old records are signing-only; their omission never grants publication.
    publishTrusted: candidate.publishTrusted === true,
    publishKinds: candidate.publishTrusted === true ? [] : Array.isArray(candidate.publishKinds)
      ? [...new Set(candidate.publishKinds.map(normalizeKind).filter((kind): kind is number => kind !== null))].slice(0, MAX_KINDS_PER_SUBJECT)
      : [],
  };
}

function normalizeContext(context: PajaSignerRequestContext): Pick<SignerConsentRecord, 'signerPubkey' | 'dTag' | 'aggregateHash' | 'runtimeScope'> | null {
  return normalizeSubject(
    context.signerPubkey,
    context.napplet.dTag,
    context.napplet.aggregateHash,
    context.runtimeScope,
  );
}

function normalizeSubject(
  signerPubkey: unknown,
  dTag: unknown,
  aggregateHash: unknown,
  runtimeScope: unknown,
): Pick<SignerConsentRecord, 'signerPubkey' | 'dTag' | 'aggregateHash' | 'runtimeScope'> | null {
  const hostGenerated = signerPubkey === 'host-generated' && typeof runtimeScope === 'string'
    && /\|host-session:[a-f0-9]{32}$/.test(runtimeScope);
  if (typeof signerPubkey !== 'string' || (!/^[0-9a-f]{64}$/i.test(signerPubkey) && !hostGenerated)) return null;
  if (
    (typeof dTag !== 'string' || dTag.length > MAX_IDENTITY_FIELD_LENGTH)
    || !validIdentityField(aggregateHash)
    || !validIdentityField(runtimeScope)
  ) return null;
  return {
    signerPubkey: signerPubkey.toLowerCase(),
    dTag,
    aggregateHash,
    runtimeScope,
  };
}

function validIdentityField(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_IDENTITY_FIELD_LENGTH;
}

function normalizeKind(value: unknown): number | null {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    && value <= 65_535
    ? value
    : null;
}

function sameSubject(
  left: Pick<SignerConsentRecord, 'signerPubkey' | 'dTag' | 'aggregateHash' | 'runtimeScope'>,
  right: Pick<SignerConsentRecord, 'signerPubkey' | 'dTag' | 'aggregateHash' | 'runtimeScope'>,
): boolean {
  return left.signerPubkey === right.signerPubkey
    && left.dTag === right.dTag
    && left.aggregateHash === right.aggregateHash
    && left.runtimeScope === right.runtimeScope;
}
