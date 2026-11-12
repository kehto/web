/** Parse a WebSocket relay URL without accepting credentials or URL-parser rewrites. */
export function parseRelayUrl(value: string): URL | undefined {
  try {
    if (typeof value !== 'string' || /[\u0000-\u0020\\#]/u.test(value)) return undefined;
    const url = new URL(value);
    return ['ws:', 'wss:'].includes(url.protocol) && !url.username && !url.password && !url.hash ? url : undefined;
  } catch {
    return undefined;
  }
}

/** Default policy rejects local/private literals; the transport still owns DNS-time checks. */
export function defaultRelayAllowed(value: string, configuredRelays: readonly string[]): boolean {
  const url = parseRelayUrl(value);
  if (!url) return false;
  // A private development relay explicitly configured by the host is host policy,
  // not authority granted by a caller hint or a discovered NIP-65 list.
  if (configuredRelays.some((configured) => parseRelayUrl(configured)?.href === url.href)) return true;
  const hostname = url.hostname.replace(/^\[|\]$/gu, '').toLowerCase();
  if (hostname.includes(':')) {
    return !hostname.startsWith('::') && !/^(?:fc|fd|fe[89a-f]|ff)/iu.test(hostname);
  }
  if (!hostname.includes('.') || /(?:^|\.)(?:localhost|local|internal)\.?$/u.test(hostname)) return false;
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) return true;
  const [first, second] = octets as [number, number, number, number];
  return first !== 0 && first !== 10 && first !== 127 && first < 224
    && !(first === 100 && second >= 64 && second <= 127)
    && !(first === 169 && second === 254)
    && !(first === 172 && second >= 16 && second <= 31)
    && !(first === 192 && second === 168)
    && !(first === 198 && (second === 18 || second === 19));
}

/** Require the same valid relay URL when deriving the permission shown to the user. */
export function relayOrigin(value: string): string {
  const url = parseRelayUrl(value);
  if (!url) throw new Error('invalid relay destination');
  return url.origin;
}
