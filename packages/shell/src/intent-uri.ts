/** Canonical request fields produced from a NAP-INTENT convention URI. */
export interface NormalizedIntentUri {
  archetype: string;
  action: string;
  convention: string;
  payload?: unknown;
  handlerHint?: { address: string; relays?: string[] };
  handler?: string;
  behavior?: { focus?: boolean; reuse?: boolean };
}

/**
 * Create an isolated NAP-INTENT normalizer for host code or an injected prelude.
 *
 * @returns A canonical URI normalizer whose parsing helpers are self-contained.
 * @example
 * ```ts
 * const normalize = createIntentUriNormalizer();
 * normalize('napplet:profile/open');
 * ```
 */
export function createIntentUriNormalizer(): (uri: unknown, options?: unknown) => NormalizedIntentUri {
  type RecordValue = Record<string, unknown>;
  const hasOwn = (value: RecordValue, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);
  const fail = (message: string): never => { throw new TypeError(message); };
  const decode = (value: string, label: string): string => {
    try {
      return decodeURIComponent(value);
    } catch {
      return fail(`Intent URI has malformed percent-encoding in ${label}`);
    }
  };
  const decodeUtf8 = (bytes: number[]): string => {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
    } catch {
      return fail('Intent URI fragment contains invalid UTF-8');
    }
  };
  const decodeHint = (fragment: string): { address: string; relays?: string[] } => {
    if (!fragment.startsWith('naddr') || fragment !== fragment.toLowerCase()) {
      return fail('Intent URI fragment must be a bare lowercase naddr');
    }
    const separator = fragment.lastIndexOf('1');
    if (separator <= 0 || separator + 7 > fragment.length) fail('Intent URI fragment is not a valid naddr');
    const alphabet = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    const values: number[] = [];
    for (const character of fragment.slice(separator + 1)) {
      const value = alphabet.indexOf(character);
      if (value < 0) fail('Intent URI fragment is not a valid naddr');
      values.push(value);
    }
    const polymod = (input: number[]): number => {
      let checksum = 1;
      for (const value of input) {
        const top = checksum >>> 25;
        checksum = ((checksum & 0x1ffffff) << 5) ^ value;
        if (top & 1) checksum ^= 0x3b6a57b2;
        if (top & 2) checksum ^= 0x26508e6d;
        if (top & 4) checksum ^= 0x1ea119fa;
        if (top & 8) checksum ^= 0x3d4233dd;
        if (top & 16) checksum ^= 0x2a1462b3;
      }
      return checksum;
    };
    const hrp = fragment.slice(0, separator);
    const hrpValues = [...hrp].map((character) => character.charCodeAt(0) >>> 5)
      .concat([0], [...hrp].map((character) => character.charCodeAt(0) & 31));
    if (hrp !== 'naddr' || polymod(hrpValues.concat(values)) !== 1) fail('Intent URI fragment is not a valid naddr');
    const words = values.slice(0, -6);
    const bytes: number[] = [];
    let accumulator = 0;
    let bits = 0;
    for (const word of words) {
      accumulator = (accumulator << 5) | word;
      bits += 5;
      while (bits >= 8) {
        bits -= 8;
        bytes.push((accumulator >>> bits) & 0xff);
      }
    }
    if (bits >= 5 || ((accumulator << (8 - bits)) & 0xff) !== 0) fail('Intent URI fragment is not a valid naddr');

    let index = 0;
    let identifier: string | undefined;
    let pubkey: string | undefined;
    let kind: number | undefined;
    const relays: string[] = [];
    while (index < bytes.length) {
      if (index + 2 > bytes.length) fail('Intent URI fragment is not a valid naddr');
      const type = bytes[index++];
      const length = bytes[index++];
      if (index + length > bytes.length) fail('Intent URI fragment is not a valid naddr');
      const value = bytes.slice(index, index + length);
      index += length;
      if (type === 0) {
        if (identifier !== undefined) fail('Intent URI fragment repeats its identifier');
        identifier = decodeUtf8(value);
      } else if (type === 1) {
        const relay = decodeUtf8(value);
        if (!relay) fail('Intent URI fragment has an empty relay hint');
        relays.push(relay);
      } else if (type === 2) {
        if (pubkey !== undefined || value.length !== 32) fail('Intent URI fragment has an invalid pubkey');
        pubkey = value.map((part) => part.toString(16).padStart(2, '0')).join('');
      } else if (type === 3) {
        if (kind !== undefined || value.length !== 4) fail('Intent URI fragment has an invalid kind');
        kind = (((value[0] << 24) >>> 0) | (value[1] << 16) | (value[2] << 8) | value[3]) >>> 0;
      } else {
        fail('Intent URI fragment has unsupported naddr data');
      }
    }
    if (!identifier || !pubkey || kind !== 35129) fail('Intent URI fragment must recommend a named 35129 napplet');
    return { address: `${kind}:${pubkey}:${identifier}`, ...(relays.length > 0 ? { relays } : {}) };
  };
  const normalizeHint = (value: unknown): { address: string; relays?: string[] } => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Intent handlerHint must be an object');
    const hint = value as RecordValue;
    if (Object.keys(hint).some((key) => key !== 'address' && key !== 'relays')) fail('Intent handlerHint contains unsupported fields');
    const address = hint.address;
    if (typeof address !== 'string' || !/^35129:[0-9a-f]{64}:.+$/u.test(address)) {
      fail('Intent handlerHint address must be a named 35129 coordinate');
    }
    const relays = hint.relays;
    if (relays !== undefined && (!Array.isArray(relays) || relays.some((relay) => typeof relay !== 'string' || relay.length === 0))) {
      fail('Intent handlerHint relays must be non-empty text');
    }
    return { address: address as string, ...(relays === undefined ? {} : { relays: [...(relays as string[])] }) };
  };

  return function normalizeIntentUri(uri: unknown, options?: unknown): NormalizedIntentUri {
    if (typeof uri !== 'string') throw new TypeError('Intent URI must be text');
    const match = /^napplet:([^/?#\s]+)\/([^/?#\s]+)(?:\?([^#]*))?(?:#(.*))?$/u.exec(uri);
    if (match === null) return fail('Intent URI must be napplet:<archetype>/<action>');
    const archetype = match[1]!;
    const action = match[2]!;
    if (!/^[a-z0-9][a-z0-9-]*$/u.test(archetype) || !/^[a-z0-9][a-z0-9-]*$/u.test(action)) {
      fail('Intent URI archetype and action must be lowercase slugs');
    }
    const query = match[3];
    const fragment = match[4];
    const supplied = options === undefined ? {} : options;
    if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied)) fail('Intent options must be an object');
    const parsedOptions = supplied as RecordValue;
    if (Object.keys(parsedOptions).some((key) => key !== 'payload' && key !== 'handler' && key !== 'handlerHint' && key !== 'behavior')) {
      fail('Intent options contain unsupported fields');
    }
    const handler = parsedOptions.handler;
    if (handler !== undefined && (typeof handler !== 'string' || handler.length === 0)) {
      fail('Intent handler must be non-empty text');
    }
    let behavior: { focus?: boolean; reuse?: boolean } | undefined;
    if (parsedOptions.behavior !== undefined) {
      if (!parsedOptions.behavior || typeof parsedOptions.behavior !== 'object' || Array.isArray(parsedOptions.behavior)) fail('Intent behavior must be an object');
      const value = parsedOptions.behavior as RecordValue;
      if (Object.keys(value).some((key) => key !== 'focus' && key !== 'reuse')
        || (hasOwn(value, 'focus') && typeof value.focus !== 'boolean')
        || (hasOwn(value, 'reuse') && typeof value.reuse !== 'boolean')) fail('Intent behavior contains unsupported fields');
      behavior = {
        ...(hasOwn(value, 'focus') ? { focus: value.focus as boolean } : {}),
        ...(hasOwn(value, 'reuse') ? { reuse: value.reuse as boolean } : {}),
      };
    }
    let payload: unknown;
    if (query !== undefined) {
      if (hasOwn(parsedOptions, 'payload')) fail('Intent URI query cannot accompany options.payload');
      if (query.length > 0) {
        const fields = Object.create(null) as RecordValue;
        for (const field of query.split('&')) {
          const equal = field.indexOf('=');
          if (equal <= 0 || field.indexOf('=', equal + 1) >= 0) fail('Intent URI query fields must be name=value');
          const name = decode(field.slice(0, equal), 'a query name');
          const value = decode(field.slice(equal + 1), 'a query value');
          if (!name || hasOwn(fields, name)) fail('Intent URI query names must be unique after decoding');
          Object.defineProperty(fields, name, { value, enumerable: true, writable: true, configurable: true });
        }
        payload = fields;
      }
    } else if (hasOwn(parsedOptions, 'payload')) {
      payload = parsedOptions.payload;
    }
    if (fragment !== undefined) {
      if (!fragment) fail('Intent URI fragment must be a bare naddr');
      if (parsedOptions.handlerHint !== undefined) fail('Intent URI fragment cannot accompany options.handlerHint');
    }
    const handlerHint = fragment === undefined
      ? (parsedOptions.handlerHint === undefined ? undefined : normalizeHint(parsedOptions.handlerHint))
      : decodeHint(fragment);
    return {
      archetype,
      action,
      convention: `napplet:${archetype}/${action}`,
      ...(payload === undefined ? {} : { payload }),
      ...(handlerHint === undefined ? {} : { handlerHint }),
      ...(handler === undefined ? {} : { handler: handler as string }),
      ...(behavior === undefined ? {} : { behavior }),
    };
  };
}

/**
 * Normalize a NAP-INTENT convention URI.
 *
 * The host and injected NIP-5D binding use the same normalizer factory.
 *
 * @param uri - Complete NAP-INTENT convention URI.
 * @param options - Optional payload, handler, recommendation, and behavior hints.
 * @returns The canonical request fields for `intent.invoke`.
 * @example
 * ```ts
 * normalizeIntentUri('napplet:profile/open?pubkey=abc%2B123');
 * // { archetype: 'profile', action: 'open', convention: 'napplet:profile/open', payload: { pubkey: 'abc+123' } }
 * ```
 */
export const normalizeIntentUri = createIntentUriNormalizer();
