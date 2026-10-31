/**
 * Paja's encrypted store for NAP-LLM provider credentials.
 *
 * API keys are optional to remember. When the user asks Paja to remember one,
 * it is encrypted with AES-GCM under a key derived from a user password with
 * PBKDF2-SHA-256 (600 000 iterations, random salt). Only the ciphertext,
 * salt, IV and KDF parameters touch `localStorage`. Plaintext keys live in
 * memory while the vault is unlocked and are handed only to the provider
 * request builder; they are never logged, never placed in the message log and
 * never cross the napplet wire. Session-only keys skip storage entirely.
 */

/** Durable storage key for the encrypted credential document. */
export const PAJA_LLM_VAULT_STORAGE_KEY = 'kehto:paja:llm-vault:v1';
/** Minimum vault password length. */
export const PAJA_LLM_VAULT_MIN_PASSWORD_LENGTH = 12;

const VAULT_VERSION = 1;
const KDF = 'PBKDF2-SHA-256';
const DEFAULT_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

interface VaultDocument {
  version: typeof VAULT_VERSION;
  kdf: typeof KDF;
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

/** Where a connection's credential lives. */
export type PajaLlmCredentialStorage = 'vault' | 'session' | 'none';

/** Encrypted-at-rest credential store with a session-only tier. */
export interface PajaLlmVault {
  /** True when an encrypted document exists in storage. */
  hasStoredSecrets(): boolean;
  /** True when the vault key is derived and stored secrets are readable. */
  isUnlocked(): boolean;
  /** Derive the key and decrypt stored secrets. Resolves false for a wrong password or corrupt document. */
  unlock(password: string): Promise<boolean>;
  /** Create an empty vault with a new password. Replaces any existing document. */
  create(password: string): Promise<void>;
  /** Drop the derived key and decrypted secrets; session-only secrets survive. */
  lock(): void;
  /** Read a credential from the unlocked vault or the session tier. */
  getCredential(connectionId: string): string | undefined;
  /** Store a credential. `vault` requires an unlocked vault and re-encrypts the document. */
  setCredential(connectionId: string, credential: string, storage: Exclude<PajaLlmCredentialStorage, 'none'>): Promise<void>;
  /** Remove a credential from both tiers; vault removal requires an unlocked vault. */
  removeCredential(connectionId: string): Promise<void>;
  /** Forget every secret and delete the encrypted document. */
  clear(): void;
  /** Observe lock, unlock, create and clear transitions. */
  subscribe(listener: () => void): () => void;
}

/** Web Crypto subset the vault needs. */
export interface PajaLlmVaultCrypto {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
  subtle: Pick<SubtleCrypto, 'importKey' | 'deriveKey' | 'encrypt' | 'decrypt'>;
}

/** Options for {@link createPajaLlmVault}. */
export interface PajaLlmVaultOptions {
  /** Durable storage; null keeps everything session-only. Defaults to localStorage when available. */
  storage?: Storage | null;
  /** Web Crypto implementation. Defaults to `globalThis.crypto`. */
  crypto?: PajaLlmVaultCrypto;
  /** PBKDF2 iteration count for new vaults. */
  iterations?: number;
}

/**
 * Validate a vault password before deriving a key from it.
 *
 * @param password - Candidate password.
 * @returns A user-facing problem, or null when acceptable.
 * @example
 * validatePajaLlmVaultPassword('short'); // 'Use at least 12 characters.'
 */
export function validatePajaLlmVaultPassword(password: string): string | null {
  if (password.length < PAJA_LLM_VAULT_MIN_PASSWORD_LENGTH) return `Use at least ${PAJA_LLM_VAULT_MIN_PASSWORD_LENGTH} characters.`;
  if (new Set(password).size < 4) return 'Use a password with more distinct characters.';
  return null;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function readDocument(storage: Storage | null): VaultDocument | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(PAJA_LLM_VAULT_STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const { version, kdf, iterations, salt, iv, ciphertext } = parsed as Record<string, unknown>;
    if (version !== VAULT_VERSION || kdf !== KDF) return null;
    if (typeof iterations !== 'number' || typeof salt !== 'string' || typeof iv !== 'string' || typeof ciphertext !== 'string') return null;
    return { version: VAULT_VERSION, kdf: KDF, iterations, salt, iv, ciphertext };
  } catch {
    return null;
  }
}

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Create Paja's credential vault.
 *
 * @param options - Storage, crypto and KDF overrides.
 * @returns A vault whose plaintext never leaves memory.
 * @example
 * const vault = createPajaLlmVault();
 * await vault.create(password);
 * await vault.setCredential(connection.id, apiKey, 'vault');
 */
export function createPajaLlmVault(options: PajaLlmVaultOptions = {}): PajaLlmVault {
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const crypto = options.crypto ?? (globalThis.crypto as PajaLlmVaultCrypto);
  const iterations = options.iterations ?? DEFAULT_ITERATIONS;
  const session = new Map<string, string>();
  const listeners = new Set<() => void>();
  let key: CryptoKey | null = null;
  let salt: Uint8Array | null = null;
  let secrets: Map<string, string> | null = null;

  const notify = (): void => { for (const listener of listeners) listener(); };

  async function deriveKey(password: string, saltBytes: Uint8Array, rounds: number): Promise<CryptoKey> {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: saltBytes as BufferSource, iterations: rounds, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  }

  async function persist(): Promise<void> {
    if (!key || !salt || !secrets) throw new Error('vault is locked');
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const plaintext = new TextEncoder().encode(JSON.stringify(Object.fromEntries(secrets)));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plaintext as BufferSource);
    const document: VaultDocument = { version: VAULT_VERSION, kdf: KDF, iterations, salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) };
    try {
      storage?.setItem(PAJA_LLM_VAULT_STORAGE_KEY, JSON.stringify(document));
    } catch {
      // Storage denial leaves the unlocked in-memory vault usable for this session.
    }
  }

  function lock(): void {
    key = null; salt = null; secrets = null;
    notify();
  }

  return {
    hasStoredSecrets: () => readDocument(storage) !== null,
    isUnlocked: () => key !== null && secrets !== null,
    async unlock(password) {
      const document = readDocument(storage);
      if (!document) return false;
      try {
        const saltBytes = fromBase64(document.salt);
        const candidate = await deriveKey(password, saltBytes, document.iterations);
        const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(document.iv) as BufferSource }, candidate, fromBase64(document.ciphertext) as BufferSource);
        const parsed: unknown = JSON.parse(new TextDecoder().decode(plaintext));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
        key = candidate; salt = saltBytes;
        secrets = new Map(Object.entries(parsed as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
        notify();
        return true;
      } catch {
        return false;
      }
    },
    async create(password) {
      const problem = validatePajaLlmVaultPassword(password);
      if (problem) throw new Error(problem);
      const saltBytes = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
      key = await deriveKey(password, saltBytes, iterations);
      salt = saltBytes;
      secrets = new Map();
      await persist();
      notify();
    },
    lock,
    getCredential: (connectionId) => secrets?.get(connectionId) ?? session.get(connectionId),
    async setCredential(connectionId, credential, tier) {
      if (tier === 'session') { session.set(connectionId, credential); secrets?.delete(connectionId); if (secrets) await persist(); return; }
      if (!secrets) throw new Error('Unlock the credential vault before remembering a key.');
      session.delete(connectionId);
      secrets.set(connectionId, credential);
      await persist();
    },
    async removeCredential(connectionId) {
      session.delete(connectionId);
      if (secrets?.has(connectionId)) { secrets.delete(connectionId); await persist(); }
    },
    clear() {
      session.clear();
      try { storage?.removeItem(PAJA_LLM_VAULT_STORAGE_KEY); } catch { /* best effort */ }
      lock();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
