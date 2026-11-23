/**
 * authority.ts — The exact upstream sources this catalog was written against.
 *
 * Resolved on 2026-11-20. These are reproducible baselines, not floating
 * claims: a check cites one of these ids, and every run reports the refs. An
 * open pull request is working authority at its recorded head; being unmerged
 * is never treated as a spec gap.
 */
import type { AuthorityRef } from './model.js';

/** Head of nostr-protocol/nips#2303 (NIP-5D) when the catalog was written. */
export const NIP5D_REF = 'f60550c3409d6d81a875088ec83e660571e10504';

/** `napplet/naps` master when the catalog was written. */
export const NAPS_MASTER = '377bf939c6c906817084b43dd21d424de646dbc2';

/** `@napplet/nap` version whose type declarations the operation inventory was read from. */
export const NAP_PACKAGE_VERSION = '0.45.0';

/** `@napplet/core` version the envelope contract was read from. */
export const CORE_PACKAGE_VERSION = '0.45.0';

/**
 * Every pinned source, keyed by the id checks cite.
 *
 * @example
 * ```ts
 * AUTHORITY['nap-theme']?.status === 'merged';
 * ```
 */
export const AUTHORITY: Readonly<Record<string, AuthorityRef>> = Object.freeze({
  nip5d: { id: 'nip5d', title: 'NIP-5D', repo: 'dskvr/nips', ref: NIP5D_REF, path: '5D.md', status: 'draft', pr: 2303 },
  'web-projection': { id: 'web-projection', title: 'Web projection', repo: 'napplet/naps', ref: NAPS_MASTER, path: 'projections/web.md', status: 'merged' },
  'nap-package': { id: 'nap-package', title: `@napplet/nap@${NAP_PACKAGE_VERSION} types`, repo: 'napplet/web', ref: `@napplet/nap@${NAP_PACKAGE_VERSION}`, path: 'packages/nap', status: 'merged' },
  'nap-shell': { id: 'nap-shell', title: 'NAP-SHELL', repo: 'napplet/naps', ref: NAPS_MASTER, path: 'naps/NAP-SHELL.md', status: 'merged' },
  'nap-identity': { id: 'nap-identity', title: 'NAP-IDENTITY', repo: 'napplet/naps', ref: NAPS_MASTER, path: 'naps/NAP-IDENTITY.md', status: 'merged' },
  'nap-inc': { id: 'nap-inc', title: 'NAP-INC', repo: 'napplet/naps', ref: NAPS_MASTER, path: 'naps/NAP-INC.md', status: 'merged' },
  'nap-intent': { id: 'nap-intent', title: 'NAP-INTENT', repo: 'napplet/naps', ref: NAPS_MASTER, path: 'naps/NAP-INTENT.md', status: 'merged' },
  'nap-theme': { id: 'nap-theme', title: 'NAP-THEME', repo: 'napplet/naps', ref: NAPS_MASTER, path: 'naps/NAP-THEME.md', status: 'merged' },
  'nap-ble': { id: 'nap-ble', title: 'NAP-BLE', repo: 'napplet/naps', ref: 'b46b86913c23cd509d2ace14f1de55b0c451e0f9', path: 'naps/NAP-BLE.md', status: 'draft', pr: 62 },
  'nap-common': { id: 'nap-common', title: 'NAP-COMMON', repo: 'napplet/naps', ref: '8cd0eae8550575771bb616a384e2dfbcade31673', path: 'naps/NAP-COMMON.md', status: 'draft', pr: 67 },
  'nap-config': { id: 'nap-config', title: 'NAP-CONFIG', repo: 'napplet/naps', ref: 'bed9cb5b1e7c9b5babee8870aa18b12949af1d62', path: 'naps/NAP-CONFIG.md', status: 'draft', pr: 14 },
  'nap-count': { id: 'nap-count', title: 'NAP-COUNT', repo: 'napplet/naps', ref: '9353a0c6c02c595f7e65ebd6df3802a7a45fc6bf', path: 'naps/NAP-COUNT.md', status: 'draft', pr: 69 },
  'nap-cvm': { id: 'nap-cvm', title: 'NAP-CVM', repo: 'napplet/naps', ref: '28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f', path: 'naps/NAP-CVM.md', status: 'draft', pr: 31 },
  'nap-dm': { id: 'nap-dm', title: 'NAP-DM', repo: 'napplet/naps', ref: '2c4e4423f40e72675822225acacea2ee5889ade2', path: 'naps/NAP-DM.md', status: 'draft', pr: 74 },
  'nap-fs': { id: 'nap-fs', title: 'NAP-FS', repo: 'napplet/naps', ref: 'bd1b9e912f05203bf38f7a1b04f920744fe6d625', path: 'naps/NAP-FS.md', status: 'draft', pr: 88 },
  'nap-gamepad': { id: 'nap-gamepad', title: 'NAP-GAMEPAD', repo: 'napplet/naps', ref: '0b28f77e3dfa0f07dd7c0f9d61a7090ee99f3a5e', path: 'naps/NAP-GAMEPAD.md', status: 'draft', pr: 130 },
  'nap-keys': { id: 'nap-keys', title: 'NAP-KEYS', repo: 'napplet/naps', ref: '8869a4cf77b023f4b049f47c546910a0280dc1a6', path: 'naps/NAP-KEYS.md', status: 'draft', pr: 9 },
  'nap-link': { id: 'nap-link', title: 'NAP-LINK', repo: 'napplet/naps', ref: '100e5c939ae6b1ea82cc58587c6da45a1cf8a760', path: 'naps/NAP-LINK.md', status: 'draft', pr: 53 },
  'nap-lists': { id: 'nap-lists', title: 'NAP-LISTS', repo: 'napplet/naps', ref: '7cf00cdb7bca6bb59dc5ef082e9fe8ac9278fa46', path: 'naps/NAP-LISTS.md', status: 'draft', pr: 68 },
  'nap-llm': { id: 'nap-llm', title: 'NAP-LLM', repo: 'napplet/naps', ref: '5e93bdfce0e84c0de728234cb7b3feed498f8635', path: 'naps/NAP-LLM.md', status: 'draft', pr: 134 },
  'nap-media': { id: 'nap-media', title: 'NAP-MEDIA', repo: 'napplet/naps', ref: '7806f438530251fce5129f8e6239d6b642278759', path: 'naps/NAP-MEDIA.md', status: 'draft', pr: 10 },
  'nap-notify': { id: 'nap-notify', title: 'NAP-NOTIFY', repo: 'napplet/naps', ref: '67877ef6c31ec8acee3125c1d8b4c781010e37dc', path: 'naps/NAP-NOTIFY.md', status: 'draft', pr: 11 },
  'nap-outbox': { id: 'nap-outbox', title: 'NAP-OUTBOX', repo: 'napplet/naps', ref: '8865f73d52a4864afee145f28d26520476273927', path: 'naps/NAP-OUTBOX.md', status: 'draft', pr: 32 },
  'nap-relay': { id: 'nap-relay', title: 'NAP-RELAY', repo: 'napplet/naps', ref: '9f30b3505335a52c574ff570576687d6467021ff', path: 'naps/NAP-RELAY.md', status: 'draft', pr: 2 },
  'nap-resource': { id: 'nap-resource', title: 'NAP-RESOURCE', repo: 'napplet/naps', ref: 'ae5b9c64ab8a4d8909f288829a01e99d6bd713bc', path: 'naps/NAP-RESOURCE.md', status: 'draft', pr: 80 },
  'nap-serial': { id: 'nap-serial', title: 'NAP-SERIAL', repo: 'napplet/naps', ref: '0c6e88ab8003f5bf88c8ddee5b5e3cd382ab7e1c', path: 'naps/NAP-SERIAL.md', status: 'draft', pr: 61 },
  'nap-storage': { id: 'nap-storage', title: 'NAP-STORAGE', repo: 'napplet/naps', ref: '4f4cf0ca7ecbd24c284a5d63bcd85e3de6af37ca', path: 'naps/NAP-STORAGE.md', status: 'draft', pr: 3 },
  'nap-upload': { id: 'nap-upload', title: 'NAP-UPLOAD', repo: 'napplet/naps', ref: 'f5cc981e527e2cc1572793a7a6e5082e5271ac49', path: 'naps/NAP-UPLOAD.md', status: 'draft', pr: 33 },
  'nap-webrtc': { id: 'nap-webrtc', title: 'NAP-WEBRTC', repo: 'napplet/naps', ref: 'fb4dd6f0e6294e1837733d2af61931e3e114bd97', path: 'naps/NAP-WEBRTC.md', status: 'draft', pr: 59 },
});

/**
 * Link to a pinned document.
 *
 * @param ref - The source.
 * @returns A permalink at the recorded commit.
 * @example
 * ```ts
 * authorityUrl(AUTHORITY.nip5d!);
 * ```
 */
export function authorityUrl(ref: AuthorityRef): string {
  if (ref.id === 'nap-package') return `https://www.npmjs.com/package/@napplet/nap/v/${NAP_PACKAGE_VERSION}`;
  return `https://github.com/${ref.repo}/blob/${ref.ref}/${ref.path}`;
}
