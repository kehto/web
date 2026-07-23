import type { NappletMessage } from '@napplet/core';

/**
 * Fixed non-sensitive theme used when a runtime-owned response cannot obtain
 * a registered theme service. Keep synchronized with the reference service
 * default without importing @kehto/services (which depends on runtime).
 */
export const RUNTIME_THEME_FALLBACK = {
  colors: { background: '#0a0a0a', text: '#e0e0e0', primary: '#7aa2f7' },
} as const;

/**
 * Shape the only runtime-owned theme fallback result.
 *
 * NAP-THEME has one request/result pair, so denials preserve the normal
 * correlation id and use a complete, non-sensitive result rather than a
 * policy-derived error envelope.
 */
export function createThemeFallbackResult(message: NappletMessage): NappletMessage | undefined {
  if (message.type !== 'theme.get') return undefined;

  return {
    type: 'theme.get.result',
    id: (message as NappletMessage & { id?: string }).id ?? '',
    theme: RUNTIME_THEME_FALLBACK,
  } as NappletMessage;
}
