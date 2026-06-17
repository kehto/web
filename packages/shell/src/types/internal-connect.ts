/**
 * @file internal-connect.ts
 *
 * Kehto-internal shell-side connect-store + consent-flow types. Per
 * PROJECT.md Decision #31, this is NOT a staging-ground duplicate of upstream
 * `@napplet/nap/connect`: upstream exports a napplet-side accessor interface
 * (`NappletConnect = { granted, origins }`) plus the shared
 * `normalizeConnectOrigin` pure validator. Kehto's types here describe the
 * shell's grant-store records (`ConnectGrant`, `ConnectGrantKey`,
 * `ConsentResult`), used by the connect-store singleton and the Vite CSP
 * plugin's consent flow.
 *
 * The two surfaces are complementary: upstream's accessor type ships at the
 * napplet boundary; kehto's grant-store types live shell-side. No retirement
 * planned. For canonical origin validation (kehto has no local impl;
 * Decision #32), consume `@napplet/nap/connect`'s `normalizeConnectOrigin`
 * directly.
 *
 * Downstream consumers (Phase 39 `connect-store.ts`, Vite CSP middleware,
 * consent flow UI) import from this module.
 */

/**
 * Grant key composed from the napplet's dTag and build aggregateHash. A hash
 * upgrade invalidates prior grants (CONNECT-06).
 */
export interface ConnectGrantKey {
  dTag: string;
  aggregateHash: string;
}

/**
 * A persisted connect grant. Stored in the shell connect-store singleton,
 * surfaced as the CSP `connect-src` origin list for the corresponding napplet.
 */
export interface ConnectGrant {
  /** Composite key `"<dTag>:<aggregateHash>"` under which this grant is stored. */
  key: string;
  /** The set of origins (WebSocket and HTTPS) the napplet is granted to connect to. */
  origins: readonly string[];
  /** Epoch millis when the grant was approved by the user. */
  grantedAt: number;
}

/**
 * Consent flow outcome. `'dismiss'` resolves to deny (MUST NOT default to allow).
 * `'timeout'` also resolves to deny.
 */
export type ConsentResult = 'approve' | 'deny' | 'dismiss' | 'timeout';

/**
 * Inbound consent request from a napplet requesting connect access to one or
 * more origins.
 */
export interface ConnectConsentRequest {
  dTag: string;
  aggregateHash: string;
  /** Origins the napplet is asking to be granted access to. */
  requestedOrigins: readonly string[];
}
