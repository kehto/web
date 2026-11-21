/**
 * Which resource destinations are public, shared by Paja's server proxy and the
 * browser's direct fetch.
 *
 * NAP-RESOURCE (napplet/naps#80 @ `ae5b9c6`) makes the runtime an SSRF boundary
 * with DNS-time private-IP checks. The server proxy applies
 * {@link isPajaPublicResourceAddress} to every DNS answer it pins. A browser
 * can't see what a hostname resolves to, so without a proxy Paja applies
 * {@link isPajaPublicResourceHost} to the URL itself. That drops private IP
 * literals and private-looking names, but a public-looking name that resolves
 * to a private address still gets through. That is the recorded spec gap for
 * proxy-less static builds; configure a resource proxy to close it.
 *
 * @module
 */

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/u;

/** Names that only ever reach the local machine or network. */
const PRIVATE_SUFFIXES = ['localhost', 'local', 'internal', 'lan', 'home', 'corp', 'intranet', 'private', 'home.arpa'];

function canonicalIpv6(address: string): string | undefined {
  try {
    return new URL(`http://[${address}]/`).hostname.slice(1, -1);
  } catch {
    return undefined;
  }
}

/**
 * Return whether an IP address is publicly routable.
 *
 * IANA special-purpose registries, checked 2026-10-17. Deliberately stricter
 * than the NAP private-IP minimum: documentation, translation, benchmark,
 * protocol-assignment and reserved ranges are rejected too, including their
 * public exceptions.
 *
 * @param address - IPv4 dotted quad or IPv6 address (no brackets).
 * @returns `true` only for public unicast addresses.
 * @example
 * ```ts
 * isPajaPublicResourceAddress('93.184.215.14'); // true
 * isPajaPublicResourceAddress('192.168.1.1'); // false
 * ```
 */
export function isPajaPublicResourceAddress(address: string): boolean {
  if (IPV4.test(address)) {
    const [a, b, c] = address.split('.').map(Number);
    return a !== 0 && a !== 10 && a !== 127 && a < 224
      && !(a === 100 && b >= 64 && b <= 127)
      && !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31)
      && !(a === 192 && (b === 168 || b === 0 && (c === 0 || c === 2) || b === 88 && c === 99))
      && !(a === 198 && (b === 18 || b === 19 || b === 51 && c === 100))
      && !(a === 203 && b === 0 && c === 113);
  }
  const canonical = address.includes(':') ? canonicalIpv6(address) : undefined;
  if (canonical === undefined) return false;
  // Only global-unicast 2000::/3 is eligible. Canonicalization prevents expanded
  // mapped/loopback spellings from bypassing textual-prefix classification.
  const [first, second = '0'] = canonical.split(':');
  const high = Number.parseInt(first, 16);
  const next = Number.parseInt(second || '0', 16);
  return high >= 0x2000 && high <= 0x3fff
    && !(high === 0x2001 && (next < 0x0200 || next === 0x0db8))
    && high !== 0x2002 && !(high === 0x3fff && next < 0x1000);
}

/**
 * Return whether a URL hostname may be fetched without a resource proxy.
 *
 * IP literals must be public addresses. Names must have a dot and must not
 * end in a local-only suffix. This can't detect a public-looking name that
 * resolves to a private address. Only a resource proxy's DNS-time check can.
 *
 * @param hostname - `URL.hostname` (IPv6 literals keep their brackets).
 * @returns `true` when the name or literal looks public.
 * @example
 * ```ts
 * isPajaPublicResourceHost('image.nostr.build'); // true
 * isPajaPublicResourceHost('printer.local'); // false
 * ```
 */
export function isPajaPublicResourceHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/u, '');
  if (host.startsWith('[') && host.endsWith(']')) return isPajaPublicResourceAddress(host.slice(1, -1));
  if (IPV4.test(host)) return isPajaPublicResourceAddress(host);
  // Bare numbers, hex and short IPv4 forms are IP spellings, not names.
  if (/^[\d.]+$/u.test(host) || host.startsWith('0x')) return false;
  if (!host.includes('.')) return false;
  return !PRIVATE_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}
