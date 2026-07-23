import type { NappletMessage } from '@napplet/core';

/**
 * Fixed non-sensitive theme used when a runtime-owned response cannot obtain
 * a registered theme service. Keep synchronized with the reference service
 * default without importing @kehto/services (which depends on runtime).
 */
export const RUNTIME_THEME_FALLBACK = {
  colors: { background: '#0a0a0a', text: '#e0e0e0', primary: '#7aa2f7' },
} as const;

const IDENTITY_SAFE_DEFAULTS = {
  'identity.getPublicKey': { pubkey: '' },
  'identity.getRelays': { relays: {} },
  'identity.getProfile': { profile: null },
  'identity.getFollows': { pubkeys: [] },
  'identity.getList': { entries: [] },
  'identity.getZaps': { zaps: [] },
  'identity.getMutes': { pubkeys: [] },
  'identity.getBlocked': { pubkeys: [] },
  'identity.getBadges': { badges: [] },
} as const;

type RuntimeOwnedIdentityOrThemeRequest = keyof typeof IDENTITY_SAFE_DEFAULTS | 'theme.get';

function isRuntimeOwnedIdentityOrThemeRequest(type: string): type is RuntimeOwnedIdentityOrThemeRequest {
  return type === 'theme.get' || type in IDENTITY_SAFE_DEFAULTS;
}

/** Return whether a message belongs to a runtime-owned identity/theme domain. */
export function isIdentityOrThemeMessage(message: NappletMessage): boolean {
  return message.type.startsWith('identity.') || message.type.startsWith('theme.');
}

/**
 * Shape an allowlisted runtime-owned response with the ordinary request id.
 *
 * Unsupported identity/theme messages deliberately return undefined so the
 * dispatch boundary can ignore them rather than synthesize a generic error.
 */
export function createCanonicalDomainResult(message: NappletMessage): NappletMessage | undefined {
  if (!isRuntimeOwnedIdentityOrThemeRequest(message.type)) return undefined;

  const id = (message as NappletMessage & { id?: string }).id ?? '';
  if (message.type === 'theme.get') {
    return { type: 'theme.get.result', id, theme: RUNTIME_THEME_FALLBACK } as NappletMessage;
  }

  return {
    type: `${message.type}.result`,
    id,
    ...IDENTITY_SAFE_DEFAULTS[message.type],
  } as unknown as NappletMessage;
}
