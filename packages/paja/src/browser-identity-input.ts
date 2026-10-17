/**
 * browser-identity-input.ts — Paja's view-only identity field.
 *
 * A view-only identity lets an author preview a napplet as an existing Nostr
 * account without handing Paja a key: the host reads the pubkey and refuses
 * every signing or encryption request. Parsing is deliberately strict and
 * separate from rendering so the accepted shapes (`npub1…`, `nprofile1…`, and
 * bare 64-character hex) are testable without a DOM.
 *
 * Rejection messages never echo the rejected text. A pasted `nsec` is a secret
 * key, and repeating it into host chrome, the message log, or a screenshot is
 * exactly the leak this field must avoid.
 */

import { decode, npubEncode } from 'nostr-tools/nip19';

const HEX_PUBKEY = /^[0-9a-f]{64}$/i;
const BECH32_SECRET = /^n(sec|ncryptsec)1/i;

/** Storage key holding the persisted view-only identity for one browser origin. */
export const PAJA_VIEW_ONLY_SIGNER_STORAGE_KEY = 'kehto:paja:signer:view-only:v1';

/** Minimal storage port so hosts and tests can supply their own preference store. */
export interface PajaPreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Parsed view-only identity field value. */
export type PajaIdentityInputResult =
  | {
      readonly ok: true;
      /** Lowercase hex pubkey of the view-only identity. */
      readonly pubkey: string;
      /** Relay hints carried by an `nprofile`, in input order. */
      readonly relays: readonly string[];
    }
  | {
      readonly ok: false;
      /** Human-readable rejection. Never contains the rejected input. */
      readonly error: string;
    };

const EMPTY_ERROR = 'paste a view-only npub1…, nprofile1…, or 64-character hex pubkey';
const SECRET_KEY_ERROR = 'that is a secret key, not a view-only identity — paste the npub instead';
const INVALID_ERROR = 'not an npub, nprofile, or 64-character hex pubkey';

function relayHints(values: readonly unknown[]): string[] {
  const urls = new Set<string>();
  for (const value of values) {
    if (typeof value !== 'string') continue;
    try {
      const url = new URL(value);
      if (url.protocol === 'wss:' || url.protocol === 'ws:') urls.add(url.href);
    } catch {
      // Invalid relay hints are ignored rather than failing the identity.
    }
  }
  return [...urls];
}

/**
 * Parse a view-only identity field value into a lowercase hex pubkey.
 *
 * @param value - Raw field text.
 * @returns The pubkey and any relay hints, or a rejection message.
 * @example
 * ```ts
 * const parsed = parsePajaIdentityInput('npub1…');
 * if (parsed.ok) console.log(parsed.pubkey);
 * ```
 */
export function parsePajaIdentityInput(value: string): PajaIdentityInputResult {
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: false, error: EMPTY_ERROR };
  if (HEX_PUBKEY.test(trimmed)) return { ok: true, pubkey: trimmed.toLowerCase(), relays: [] };
  if (BECH32_SECRET.test(trimmed)) return { ok: false, error: SECRET_KEY_ERROR };

  let decoded: ReturnType<typeof decode>;
  try {
    decoded = decode(trimmed);
  } catch {
    return { ok: false, error: INVALID_ERROR };
  }

  switch (decoded.type) {
    case 'npub':
      return { ok: true, pubkey: decoded.data.toLowerCase(), relays: [] };
    case 'nprofile':
      return {
        ok: true,
        pubkey: decoded.data.pubkey.toLowerCase(),
        relays: relayHints(decoded.data.relays ?? []),
      };
    case 'nsec':
      return { ok: false, error: SECRET_KEY_ERROR };
    default:
      return { ok: false, error: INVALID_ERROR };
  }
}

/**
 * Render a hex pubkey as `npub1…` for display.
 *
 * @param pubkey - 64-character hex pubkey.
 * @returns The encoded npub, or the input when it is not a hex pubkey.
 * @example
 * ```ts
 * formatPajaNpub('7'.repeat(64)); // 'npub1…'
 * ```
 */
export function formatPajaNpub(pubkey: string): string {
  if (!HEX_PUBKEY.test(pubkey)) return pubkey;
  try {
    return npubEncode(pubkey.toLowerCase());
  } catch {
    return pubkey;
  }
}

/**
 * Shorten an npub (or hex pubkey) for one-line host chrome.
 *
 * @param value - npub or hex pubkey.
 * @returns `npub1abc…wxyz`-style label, or the input when it is too short.
 * @example
 * ```ts
 * shortenPajaIdentity(formatPajaNpub(hex)); // 'npub1abcd…123456'
 * ```
 */
export function shortenPajaIdentity(value: string): string {
  if (value.length <= 20) return value;
  return `${value.slice(0, 13)}…${value.slice(-6)}`;
}

/**
 * Read the persisted view-only pubkey for this browser origin.
 *
 * @param storage - Preference store, or null when storage is unavailable.
 * @returns Stored hex pubkey, or null when absent, unreadable, or malformed.
 * @example
 * ```ts
 * readPajaViewOnlyPubkey(globalThis.localStorage);
 * ```
 */
export function readPajaViewOnlyPubkey(
  storage: PajaPreferenceStorage | null | undefined,
): string | null {
  if (!storage) return null;
  try {
    const stored = storage.getItem(PAJA_VIEW_ONLY_SIGNER_STORAGE_KEY);
    return stored && HEX_PUBKEY.test(stored) ? stored.toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Persist (or clear) the view-only pubkey for this browser origin.
 *
 * Persistence is best-effort: an unavailable or throwing store never prevents
 * switching identity in-session.
 *
 * @param storage - Preference store, or null when storage is unavailable.
 * @param pubkey - Hex pubkey to store, or null to clear.
 * @example
 * ```ts
 * writePajaViewOnlyPubkey(globalThis.localStorage, parsed.pubkey);
 * ```
 */
export function writePajaViewOnlyPubkey(
  storage: PajaPreferenceStorage | null | undefined,
  pubkey: string | null,
): void {
  if (!storage) return;
  try {
    if (pubkey) storage.setItem(PAJA_VIEW_ONLY_SIGNER_STORAGE_KEY, pubkey.toLowerCase());
    else storage.removeItem(PAJA_VIEW_ONLY_SIGNER_STORAGE_KEY);
  } catch {
    // Persistence must not block switching identity.
  }
}
