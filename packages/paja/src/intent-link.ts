import { normalizeIntentUri, type NormalizedIntentUri } from '@kehto/shell';

/** Maximum UTF-8 encoded size of a shareable Paja intent URL. */
export const PAJA_INTENT_LINK_MAX_BYTES = 16 * 1024;

/** Input used to create a Paja intent deep link. */
export interface PajaIntentLinkDescriptor {
  /** Complete convention URI, including its own query or recommendation fragment. */
  readonly uri: string;
  /** Optional Paja target pointer. */
  readonly pointer?: string;
  /** Explicit JSON payload kept outside the convention URI. */
  readonly payload?: unknown;
}

/** A validated Paja intent deep link. */
export interface ParsedPajaIntentLink extends PajaIntentLinkDescriptor {
  /** Canonical request produced from the URI and optional explicit payload. */
  readonly request: NormalizedIntentUri;
}

type OuterFields = Record<string, string>;

function fail(message: string): never {
  throw new TypeError(message);
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function strictDecode(value: string, label: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return fail(`Paja intent link has malformed percent-encoding in ${label}`);
  }
}

function parseOuterQuery(search: string): OuterFields {
  const fields = Object.create(null) as OuterFields;
  if (!search) return fields;
  for (const part of search.slice(1).split('&')) {
    const equal = part.indexOf('=');
    if (equal <= 0) fail('Paja intent link fields must be name=value');
    const name = strictDecode(part.slice(0, equal), 'a field name');
    const value = strictDecode(part.slice(equal + 1), `the ${name || 'unnamed'} field`);
    if (!name || hasOwn(fields, name)) fail('Paja intent link field names must be unique after decoding');
    Object.defineProperty(fields, name, { value, enumerable: true, configurable: true });
  }
  return fields;
}

function rawOuterValue(search: string, expectedName: string): string | undefined {
  if (!search) return undefined;
  for (const part of search.slice(1).split('&')) {
    const equal = part.indexOf('=');
    if (equal <= 0) continue;
    try {
      if (decodeURIComponent(part.slice(0, equal)) === expectedName) return part.slice(equal + 1);
    } catch {
      // A malformed unrelated key remains irrelevant until intent validation.
    }
  }
  return undefined;
}

function assertJsonValue(value: unknown): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return;
    fail('Paja intent payload must be JSON');
  }
  if (Array.isArray(value)) {
    value.forEach(assertJsonValue);
    return;
  }
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    fail('Paja intent payload must be JSON');
  }
  for (const [, nested] of Object.entries(value as Record<string, unknown>)) {
    assertJsonValue(nested);
  }
}

function parseJsonPayload(value: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return fail('Paja intent payload must be valid JSON');
  }
  assertJsonValue(parsed);
  return parsed;
}

function encodeJsonPayload(value: unknown): string {
  assertJsonValue(value);
  const encoded = JSON.stringify(value);
  if (encoded === undefined) fail('Paja intent payload must be JSON');
  return encoded;
}

function pointerParameter(pointer: string): 'naddr' | 'nevent' | 'pointer' {
  if (pointer.startsWith('naddr')) return 'naddr';
  if (pointer.startsWith('nevent')) return 'nevent';
  return 'pointer';
}

function assertLinkSize(url: URL): void {
  if (new TextEncoder().encode(url.href).length > PAJA_INTENT_LINK_MAX_BYTES) {
    fail(`Paja intent links must not exceed ${PAJA_INTENT_LINK_MAX_BYTES} UTF-8 bytes`);
  }
}

/**
 * Parse a Paja intent deep link without invoking it.
 *
 * Pointer-only links intentionally return `null` so existing runtime-pointer
 * startup remains unchanged.
 *
 * @param href - Browser location to inspect.
 * @returns A validated descriptor, or `null` when no intent parameter exists.
 * @example
 * ```ts
 * parsePajaIntentLink('https://paja.example/?intent=napplet%3Anote%2Fopen');
 * ```
 */
export function parsePajaIntentLink(href: string): ParsedPajaIntentLink | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return fail('Paja intent link must be an absolute URL');
  }
  const rawIntent = rawOuterValue(url.search, 'intent');
  if (rawIntent === undefined) {
    if (rawOuterValue(url.search, 'payload') !== undefined) fail('Paja intent payload requires an intent URI');
    return null;
  }
  if (url.hash) fail('Paja intent links do not support an outer fragment');
  assertLinkSize(url);
  const fields = parseOuterQuery(url.search);
  if (Object.keys(fields).some((field) => !['intent', 'payload', 'pointer', 'naddr', 'nevent'].includes(field))) {
    fail('Paja intent link contains unsupported fields');
  }
  const pointers = ['pointer', 'naddr', 'nevent'].filter((name) => hasOwn(fields, name));
  if (pointers.length > 1) fail('Paja intent link must not contain multiple pointer aliases');
  if (!hasOwn(fields, 'intent') || !rawIntent || /[:/?#&=]/u.test(rawIntent) || !/%[0-9a-f]{2}/iu.test(rawIntent)) {
    fail('Paja intent URI must be completely percent-encoded');
  }
  const uri = fields.intent;
  const payload = hasOwn(fields, 'payload') ? parseJsonPayload(fields.payload) : undefined;
  const request = normalizeIntentUri(uri, payload === undefined ? undefined : { payload });
  const pointer = pointers.length === 1 ? fields[pointers[0]] : undefined;
  if (pointer !== undefined && pointer.length === 0) fail('Paja intent pointer must be non-empty text');
  if (pointer !== undefined && request.handlerHint !== undefined) {
    fail('Paja intent link cannot combine a target pointer with a URI recommendation');
  }
  return {
    uri,
    ...(pointer === undefined ? {} : { pointer }),
    ...(payload === undefined ? {} : { payload }),
    request,
  };
}

/**
 * Create a canonical Paja intent deep link without invoking it.
 *
 * @param descriptor - Convention URI, optional pointer, and optional JSON payload.
 * @param href - Absolute Paja URL to use as the link base.
 * @returns A canonical intent URL.
 * @example
 * ```ts
 * createPajaIntentLink({ uri: 'napplet:note/open' }, 'https://paja.example/');
 * ```
 */
export function createPajaIntentLink(descriptor: PajaIntentLinkDescriptor, href: string): string {
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) fail('Paja intent link descriptor must be an object');
  if (typeof descriptor.uri !== 'string') fail('Paja intent URI must be text');
  if (descriptor.pointer !== undefined && (typeof descriptor.pointer !== 'string' || descriptor.pointer.length === 0)) {
    fail('Paja intent pointer must be non-empty text');
  }
  const request = normalizeIntentUri(
    descriptor.uri,
    hasOwn(descriptor, 'payload') ? { payload: descriptor.payload } : undefined,
  );
  if (descriptor.pointer !== undefined && request.handlerHint !== undefined) {
    fail('Paja intent link cannot combine a target pointer with a URI recommendation');
  }
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return fail('Paja intent link must use an absolute base URL');
  }
  url.search = '';
  url.hash = '';
  const pairs = [`intent=${encodeURIComponent(descriptor.uri)}`];
  if (descriptor.pointer !== undefined) pairs.push(`${pointerParameter(descriptor.pointer)}=${encodeURIComponent(descriptor.pointer)}`);
  if (hasOwn(descriptor, 'payload')) pairs.push(`payload=${encodeURIComponent(encodeJsonPayload(descriptor.payload))}`);
  url.search = `?${pairs.join('&')}`;
  assertLinkSize(url);
  return url.href;
}
