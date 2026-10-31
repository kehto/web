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

function createRuntimeOwnedResultEnvelope(type: string, id: string): NappletMessage {
  return Object.assign({ type } as NappletMessage, { id });
}

function intentRequestDetails(message: NappletMessage): { archetype: string; action: string } {
  const request = (message as NappletMessage & {
    request?: { archetype?: unknown; action?: unknown };
  }).request;
  return {
    archetype: typeof request?.archetype === 'string' ? request.archetype : '',
    action: typeof request?.action === 'string' && request.action.length > 0
      ? request.action
      : 'open',
  };
}

function createIntentInvokeRejection(message: NappletMessage, error: string): NappletMessage {
  const id = (message as NappletMessage & { id?: string }).id ?? '';
  const { archetype, action } = intentRequestDetails(message);
  return {
    type: 'intent.invoke.result',
    id,
    result: { ok: false, archetype, action, handled: false, error },
  } as NappletMessage;
}

const LLM_REQUEST_TYPES = new Set(['llm.select', 'llm.describe', 'llm.generate', 'llm.cancel']);

/**
 * Shape a NAP-LLM failure on the request's sanctioned result wire.
 *
 * NAP-LLM (napplet/naps PR #134) answers every routable request with exactly one
 * `llm.<op>.result` carrying either its success field or an `error` record of
 * `{ code, message }`. Only the four napplet-originated request types receive
 * a shaped failure; pushes, results, and unknown actions return `undefined` so a
 * forged envelope cannot manufacture a second terminal result.
 *
 * @param message - Incoming llm request envelope.
 * @param code - Stable NAP-LLM failure category.
 * @param text - Safe human-readable diagnostic; never provider or credential detail.
 * @returns The terminal error result for a sanctioned request, or `undefined`.
 * @example
 * createLlmErrorResult({ type: 'llm.generate', id: 'g1' }, 'unsupported', 'No language model service is registered.');
 * // => { type: 'llm.generate.result', id: 'g1', error: { code: 'unsupported', message: '...' } }
 */
export function createLlmErrorResult(
  message: NappletMessage,
  code: string,
  text: string,
): NappletMessage | undefined {
  if (!LLM_REQUEST_TYPES.has(message.type)) return undefined;
  const rawId = (message as NappletMessage & { id?: unknown }).id;
  const id = typeof rawId === 'string' ? rawId : '';
  return { type: `${message.type}.result`, id, error: { code, message: text } } as NappletMessage;
}

/** Return whether a message belongs to a runtime-owned identity/theme domain. */
export function isIdentityOrThemeMessage(message: NappletMessage): boolean {
  return message.type.startsWith('identity.') || message.type.startsWith('theme.');
}

/**
 * Shape a non-sensitive NAP-INTENT policy denial on its sanctioned result wire.
 *
 * Only napplet-originated intent requests have denial responses. Runtime push,
 * result, obsolete error, and unknown actions return `undefined` so a forged
 * source envelope cannot manufacture another response.
 *
 * @param message - Incoming intent request envelope.
 * @returns A fixed denial result for a sanctioned request, or `undefined`.
 */
export function createIntentPolicyDenial(
  message: NappletMessage,
): NappletMessage | undefined {
  const id = (message as NappletMessage & { id?: string }).id ?? '';
  if (message.type === 'intent.invoke') {
    return createIntentInvokeRejection(message, 'invoke rejected');
  }
  if (message.type === 'intent.available' || message.type === 'intent.handlers') {
    return {
      type: `${message.type}.result`,
      id,
      error: 'intent request denied',
    } as NappletMessage;
  }
  return undefined;
}

/** Shape canonical replies when no NAP-INTENT service is registered. */
export function createIntentServiceUnavailableResult(
  message: NappletMessage,
): NappletMessage | undefined {
  const id = (message as NappletMessage & { id?: string }).id ?? '';
  if (message.type === 'intent.invoke') {
    return createIntentInvokeRejection(message, 'no handler');
  }
  if (message.type === 'intent.available') {
    const archetype = (message as NappletMessage & { archetype?: unknown }).archetype;
    return {
      type: 'intent.available.result',
      id,
      availability: {
        archetype: typeof archetype === 'string' ? archetype : '',
        available: false,
        candidates: [],
        hasDefault: false,
      },
    } as NappletMessage;
  }
  if (message.type === 'intent.handlers') {
    return { type: 'intent.handlers.result', id, handlers: [] } as NappletMessage;
  }
  return undefined;
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
    return Object.assign(
      createRuntimeOwnedResultEnvelope('theme.get.result', id),
      { theme: RUNTIME_THEME_FALLBACK },
    );
  }

  return Object.assign(
    createRuntimeOwnedResultEnvelope(`${message.type}.result`, id),
    IDENTITY_SAFE_DEFAULTS[message.type],
  );
}
