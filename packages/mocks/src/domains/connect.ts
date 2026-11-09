/**
 * domains/connect.ts — Mock NAP-CONNECT shell gate and loopback network.
 *
 * Spec: naps/NAP-CONNECT.md @ napplet/naps PR #19 head ec81a3a4a1fc (draft)
 * Routes: none — NAP-CONNECT has no postMessage wire protocol by design.
 * Spec gaps / decisions:
 * - The NAP states there are no `connect.*` envelopes: grants travel through
 *   the served CSP `connect-src` directive and a shell-injected
 *   `<meta name="napplet-connect-granted">` tag. This module therefore does
 *   not build a routed `MockService`; it models the shell side (origin
 *   validation, the `connect:origins` fold, `(dTag, aggregateHash)` grant
 *   persistence, consent via `approveNext`) and an in-memory loopback
 *   network that enforces the resulting allowlist the way the browser CSP
 *   would, with echo semantics for send/receive.
 * - `aggregateHash` is mock-defined as the SHA-256 of the sorted x-tag
 *   hashes plus the `connect:origins` fold, joined by LF. NIP-5A owns the
 *   real fold; the mock only needs the key to change when origins change.
 * - IDN → Punycode conversion uses the WHATWG `URL` host parser, which both
 *   build tools and shells are expected to agree with.
 */
import type { MockDomainEntry, NapSpecRef } from '../core/types.js';

/**
 * Spec document the mock was written against.
 *
 * @example
 * ```ts
 * CONNECT_SPEC_REF.pr === 19;
 * ```
 */
export const CONNECT_SPEC_REF: NapSpecRef = {
  nap: 'NAP-CONNECT',
  status: 'draft',
  source: 'pr',
  pr: 19,
  sha: 'ec81a3a4a1fc',
  path: 'naps/NAP-CONNECT.md',
};

/**
 * Capability strings a NAP-CONNECT shell advertises through `shell.supports`.
 *
 * @example
 * ```ts
 * const capability: ConnectCapability = 'nap:connect';
 * ```
 */
export type ConnectCapability = 'nap:connect' | 'connect:scheme:http' | 'connect:scheme:ws';

/**
 * Outcome of normalizing or validating one origin.
 *
 * @example
 * ```ts
 * const result: ConnectOriginResult = { ok: true, origin: 'https://api.example.org' };
 * ```
 */
export type ConnectOriginResult = { ok: true; origin: string } | { ok: false; reason: string };

const SCHEMES = new Set(['https:', 'wss:', 'http:', 'ws:']);
const DEFAULT_PORTS: Record<string, string> = { 'https:': '443', 'wss:': '443', 'http:': '80', 'ws:': '80' };

/**
 * Build-tool normalization of a `connect` origin per the NAP's conformance
 * vectors: lowercases scheme and host, converts IDN to Punycode, and rejects
 * default ports, wildcards, paths, queries, fragments, and trailing slashes.
 *
 * @param input - Author-supplied origin.
 * @returns The normalized origin or a rejection reason.
 * @example
 * ```ts
 * normalizeConnectOrigin('HTTPS://api.example.com'); // { ok: true, origin: 'https://api.example.com' }
 * normalizeConnectOrigin('https://foo.com/');        // { ok: false, reason: 'trailing slash' }
 * ```
 */
export function normalizeConnectOrigin(input: string): ConnectOriginResult {
  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(.*)$/.exec(input);
  if (!schemeMatch) return { ok: false, reason: 'not an absolute origin' };
  const scheme = `${schemeMatch[1]!.toLowerCase()}:`;
  const rest = schemeMatch[2]!;
  if (!SCHEMES.has(scheme)) return { ok: false, reason: 'scheme not in whitelist' };
  if (rest.endsWith('/')) return { ok: false, reason: 'trailing slash' };
  if (rest.includes('/')) return { ok: false, reason: 'path not permitted' };
  if (rest.includes('?')) return { ok: false, reason: 'query not permitted' };
  if (rest.includes('#')) return { ok: false, reason: 'fragment not permitted' };
  if (rest.includes('*')) return { ok: false, reason: 'wildcard host' };
  if (rest.includes('@')) return { ok: false, reason: 'userinfo not permitted' };
  if (/[^\u0000-\u007f]/.test(rest) && rest !== rest.toLowerCase()) return { ok: false, reason: 'uppercase non-ASCII host' };
  const portMatch = /:(\d+)$/.exec(rest);
  if (portMatch && portMatch[1] === DEFAULT_PORTS[scheme]) return { ok: false, reason: 'default port must be omitted' };
  let url: URL;
  try {
    url = new URL(`${scheme}//${rest}`);
  } catch {
    return { ok: false, reason: 'invalid host' };
  }
  if (!url.hostname) return { ok: false, reason: 'invalid host' };
  return { ok: true, origin: `${scheme}//${url.hostname}${url.port ? `:${url.port}` : ''}` };
}

/**
 * Shell-side check: an origin is canonical only when normalization accepts
 * it and returns the byte-identical string.
 *
 * @param origin - Origin as found in a `["connect", origin]` tag.
 * @returns Validation outcome.
 * @example
 * ```ts
 * isCanonicalConnectOrigin('https://API.example.com').ok === false;
 * ```
 */
export function isCanonicalConnectOrigin(origin: string): ConnectOriginResult {
  const result = normalizeConnectOrigin(origin);
  if (!result.ok) return result;
  return result.origin === origin ? result : { ok: false, reason: 'origin is not canonical' };
}

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const H0 = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

/**
 * SHA-256 of a UTF-8 string as lowercase hex. Pure TypeScript so the mock
 * can evaluate the NAP's normative fold fixture without a crypto dependency.
 *
 * @param input - Text to hash.
 * @returns 64-character lowercase hex digest.
 * @example
 * ```ts
 * sha256Hex('') === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
 * ```
 */
export function sha256Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor((bytes.length * 8) / 0x100000000));
  view.setUint32(padded.length - 4, (bytes.length * 8) >>> 0);
  const h = Uint32Array.from(H0);
  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!];
    for (let i = 0; i < 64; i += 1) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i]! + w[i]!) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    const round = [a, b, c, d, e, f, g, hh];
    for (let i = 0; i < 8; i += 1) h[i] = (h[i]! + round[i]!) >>> 0;
  }
  return Array.from(h, (word) => word.toString(16).padStart(8, '0')).join('');
}

/**
 * The NAP's canonical `connect:origins` fold: lowercase, ASCII sort, join with
 * LF (no trailing newline), SHA-256, lowercase hex.
 *
 * @param origins - Normalized origins.
 * @returns 64-hex digest.
 * @example
 * ```ts
 * connectOriginsFold(['wss://events.example.com', 'https://api.example.com', 'https://xn--caf-dma.example.com'])
 *   === 'cc7c1b1903fb23ecb909d2427e1dccd7d398a5c63dd65160edb0bb8b231aa742';
 * ```
 */
export function connectOriginsFold(origins: readonly string[]): string {
  return sha256Hex([...origins].map((origin) => origin.toLowerCase()).sort().join('\n'));
}

/**
 * Manifest view the gate needs: the napplet's d-tag, name, x-tag hashes, and
 * its `["connect", origin]` tag values.
 *
 * @example
 * ```ts
 * const manifest: ConnectManifest = { dTag: 'distro-browser', name: 'Distro Browser', xTagHashes: [], connectOrigins: ['https://api.example.org'] };
 * ```
 */
export interface ConnectManifest {
  dTag: string;
  name?: string;
  /** Hashes from `["x", hash, path]` tags; used for the mock `aggregateHash`. */
  xTagHashes?: readonly string[];
  /** Values of `["connect", origin]` tags. */
  connectOrigins: readonly string[];
}

/**
 * What the shell emits when serving the napplet's HTML.
 *
 * @example
 * ```ts
 * const served = createMockConnectGate().serve({ dTag: 'a', connectOrigins: ['https://api.example.org'] });
 * served.granted && served.csp === "connect-src https://api.example.org";
 * ```
 */
export interface ConnectServeResult {
  /** `true` when every declared origin is granted for `(dTag, aggregateHash)`. */
  granted: boolean;
  /** Approved origins; empty on denial, refusal, or no `connect` tags. */
  origins: string[];
  /** Runtime `connect-src` directive the shell emits. */
  csp: string;
  /** Discovery meta tag injected into the served HTML. */
  meta: string;
  /** Grant key. */
  dTag: string;
  aggregateHash: string;
  /** Whether a consent prompt was presented during this call. */
  prompted: boolean;
  /** Set when the shell refuses to serve the napplet (invalid origin or cleartext policy). */
  refused?: string;
}

/**
 * Factory options for the connect gate.
 *
 * @example
 * ```ts
 * const gate = createMockConnectGate({ allowCleartext: true, autoApprove: false });
 * ```
 */
export interface MockConnectGateOptions {
  /** Consent decision when `approveNext` has nothing queued. Default `true`. */
  autoApprove?: boolean;
  /** Advertise `connect:scheme:http` / `connect:scheme:ws` and serve cleartext origins. Default `false`. */
  allowCleartext?: boolean;
}

/**
 * Shell-side NAP-CONNECT gate: validates manifest origins, persists grants on
 * `(dTag, aggregateHash)`, models the consent prompt, and emits CSP + meta.
 *
 * @example
 * ```ts
 * const gate = createMockConnectGate();
 * gate.approveNext(false);
 * gate.serve({ dTag: 'news', connectOrigins: ['wss://events.example.org'] }).granted === false;
 * ```
 */
export interface MockConnectGate {
  /** Queue the next consent decision. */
  approveNext(approved: boolean): void;
  /** Serve a napplet: validate, consult or create the grant, and emit CSP/meta. */
  serve(manifest: ConnectManifest): ConnectServeResult;
  /** Revoke a persisted grant; takes effect at next `serve`. Returns whether one existed. */
  revoke(dTag: string, aggregateHash: string): boolean;
  /** `shell.supports` answer for the three NAP-CONNECT capability strings. */
  supports(capability: ConnectCapability | string): boolean;
  /** Persisted decisions keyed `${dTag}:${aggregateHash}`. */
  grants(): ReadonlyMap<string, boolean>;
  /** Forget every grant and queued decision. */
  reset(): void;
}

function metaTag(origins: readonly string[]): string {
  return `<meta name="napplet-connect-granted" content="${origins.join(' ')}">`;
}

/**
 * Create the shell-side NAP-CONNECT gate.
 *
 * @param options - Consent default and cleartext policy.
 * @returns A gate with grant persistence and consent controls.
 * @example
 * ```ts
 * const gate = createMockConnectGate();
 * const served = gate.serve({ dTag: 'mirror', connectOrigins: ['https://mirror-a.example.org'] });
 * ```
 */
export function createMockConnectGate(options: MockConnectGateOptions = {}): MockConnectGate {
  const grants = new Map<string, boolean>();
  const queue: boolean[] = [];
  const allowCleartext = options.allowCleartext ?? false;

  const denied = (dTag: string, aggregateHash: string, prompted: boolean, refused?: string): ConnectServeResult => ({
    granted: false, origins: [], csp: "connect-src 'none'", meta: metaTag([]), dTag, aggregateHash, prompted,
    ...(refused ? { refused } : {}),
  });

  return {
    approveNext(approved) { queue.push(approved); },
    serve(manifest) {
      const origins: string[] = [];
      for (const raw of manifest.connectOrigins) {
        const check = isCanonicalConnectOrigin(raw);
        if (!check.ok) return denied(manifest.dTag, '', false, `invalid connect origin ${JSON.stringify(raw)}: ${check.reason}`);
        if (!allowCleartext && (check.origin.startsWith('http:') || check.origin.startsWith('ws:'))) {
          return denied(manifest.dTag, '', false, `cleartext origin ${check.origin} refused by operator policy`);
        }
        origins.push(check.origin);
      }
      const fold = connectOriginsFold(origins);
      const aggregateHash = sha256Hex([...(manifest.xTagHashes ?? []), fold].sort().join('\n'));
      if (origins.length === 0) return denied(manifest.dTag, aggregateHash, false);
      const key = `${manifest.dTag}:${aggregateHash}`;
      let prompted = false;
      if (!grants.has(key)) {
        prompted = true;
        grants.set(key, queue.length > 0 ? queue.shift()! : (options.autoApprove ?? true));
      }
      if (!grants.get(key)) return denied(manifest.dTag, aggregateHash, prompted);
      return { granted: true, origins, csp: `connect-src ${origins.join(' ')}`, meta: metaTag(origins), dTag: manifest.dTag, aggregateHash, prompted };
    },
    revoke(dTag, aggregateHash) { return grants.delete(`${dTag}:${aggregateHash}`); },
    supports(capability) {
      if (capability === 'nap:connect') return true;
      if (capability === 'connect:scheme:http' || capability === 'connect:scheme:ws') return allowCleartext;
      return false;
    },
    grants: () => grants,
    reset() { grants.clear(); queue.length = 0; },
  };
}

/**
 * One in-memory loopback connection. Every `send` is echoed back and can be
 * drained with `receive`.
 *
 * @example
 * ```ts
 * const opened = createMockLoopbackNetwork(['wss://events.example.org']).open('wss://events.example.org/feed');
 * if (opened.ok) { opened.socket.send('ping'); opened.socket.receive() === 'ping'; }
 * ```
 */
export interface LoopbackSocket {
  /** Target URL as opened. */
  readonly url: string;
  /** Whether the socket is still open. */
  readonly isOpen: boolean;
  /** Everything sent so far. */
  readonly sent: readonly string[];
  /** Send a frame; it is echoed into the receive queue. Returns `false` once closed. */
  send(data: string): boolean;
  /** Dequeue the next echoed frame, or `undefined` when empty. */
  receive(): string | undefined;
  /** Close the socket; idempotent. */
  close(): void;
}

/**
 * Result of `open`: a socket or a CSP denial.
 *
 * @example
 * ```ts
 * const denied: LoopbackOpenResult = { ok: false, error: 'blocked-by-csp', origin: 'https://evil.example.net' };
 * ```
 */
export type LoopbackOpenResult = { ok: true; socket: LoopbackSocket } | { ok: false; error: 'blocked-by-csp' | 'invalid-url'; origin?: string };

/**
 * In-memory stand-in for the browser network under a NAP-CONNECT CSP: only
 * granted origins can be opened; everything else is blocked.
 *
 * @example
 * ```ts
 * const net = createMockLoopbackNetwork(['https://api.example.org']);
 * net.open('https://evil.example.net').ok === false;
 * ```
 */
export interface MockLoopbackNetwork {
  /** Granted origins the network accepts. */
  readonly origins: readonly string[];
  /** Open a connection to `url` if its origin is granted. */
  open(url: string): LoopbackOpenResult;
  /** Sockets opened so far, including closed ones. */
  readonly sockets: readonly LoopbackSocket[];
}

/**
 * Create a loopback echo network bound to a granted origin list.
 *
 * @param origins - Granted origins (e.g. `ConnectServeResult.origins`).
 * @returns The network double.
 * @example
 * ```ts
 * const served = createMockConnectGate().serve({ dTag: 'a', connectOrigins: ['https://api.example.org'] });
 * const net = createMockLoopbackNetwork(served.origins);
 * ```
 */
export function createMockLoopbackNetwork(origins: readonly string[]): MockLoopbackNetwork {
  const granted = new Set(origins);
  const sockets: LoopbackSocket[] = [];
  return {
    origins: [...origins],
    sockets,
    open(url) {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return { ok: false, error: 'invalid-url' };
      }
      const origin = `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`;
      if (!granted.has(origin)) return { ok: false, error: 'blocked-by-csp', origin };
      const queue: string[] = [];
      const sent: string[] = [];
      let isOpen = true;
      const socket: LoopbackSocket = {
        url,
        get isOpen() { return isOpen; },
        sent,
        send(data) {
          if (!isOpen) return false;
          sent.push(data);
          queue.push(data);
          return true;
        },
        receive: () => queue.shift(),
        close() { isOpen = false; queue.length = 0; },
      };
      sockets.push(socket);
      return { ok: true, socket };
    },
  };
}

/**
 * Registry row for NAP-CONNECT (no wire messages; shell/CSP-owned).
 *
 * @example
 * ```ts
 * CONNECT_MOCK_ENTRY.kind === 'runtime-owned';
 * ```
 */
export const CONNECT_MOCK_ENTRY: MockDomainEntry = {
  domain: 'connect',
  kind: 'runtime-owned',
  spec: CONNECT_SPEC_REF,
  note: 'NAP-CONNECT defines no connect.* envelopes; grants are served as CSP connect-src plus a discovery meta tag. Use createMockConnectGate() and createMockLoopbackNetwork().',
};
