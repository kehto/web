// provisional — pending @napplet/nub/connect publish
/**
 * @file provisional-connect.ts
 *
 * TODO: swap import to @napplet/nub/connect when published at ^0.3.0
 *
 * NUB-CONNECT wire types. Canonical source does not yet exist in any published
 * form (neither npm @napplet/nub@0.2.1 nor napplet/napplet main branch contain
 * a connect subpath as of 2026-04-24). These shapes are derived from:
 *   - NIP-5D class-posture delegation paragraph (authorizes shell-controlled
 *     HTTP response headers)
 *   - kehto v1.7 Phase 39 requirements (CONNECT-01..CONNECT-07)
 *   - .planning/research/STACK.md Section 3 (CSP `connect-src` string join)
 *
 * Downstream consumers (Phase 39 `connect-store.ts`, Vite CSP middleware,
 * consent flow UI) import from this module. When upstream publishes
 * `@napplet/nub/connect` at ^0.3.0, this file is deleted and imports swap to
 * the canonical subpath (single atomic bump per v1.7 milestone close policy).
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
