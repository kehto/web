/**
 * @file internal-resource.ts
 *
 * Kehto-internal shell-side resource wire types. Per PROJECT.md Decision #31,
 * this is NOT a staging-ground duplicate of upstream `@napplet/nap/resource`:
 * Phase 44 audit confirmed the two surfaces diverge substantively — different
 * field names (kehto's `requestId` vs upstream `id`; kehto's `bodyBase64` vs
 * upstream `blob` + `mime`), different message-type names
 * (`ResourceBytesRequest` vs `ResourceBytesMessage`), and disjoint error
 * vocabularies (kehto: 5 codes `{denied, canceled, network-error, invalid-url,
 * class-forbidden}`; upstream: 8 codes `{not-found, blocked-by-policy,
 * timeout, too-large, unsupported-scheme, decode-failed, network-error,
 * quota-exceeded}`).
 *
 * Future migration to upstream's surface is its own phase. For now this file
 * owns the wire shapes kehto's `resource-service.ts` and resource-demo napplet
 * already implement.
 *
 * Canonical 4-message protocol (RESOURCE-03):
 *   Inbound:  resource.bytes, resource.cancel
 *   Outbound: resource.bytes.result, resource.bytes.error
 */

/**
 * Unique id for correlating a `resource.bytes` request to its later result /
 * error / cancel envelope.
 */
export type ResourceRequestId = string;

/**
 * Inbound: napplet requests bytes from an origin. Shell consults
 * getConnectGrants(dTag, aggregateHash) before proxying; ungranted origins
 * receive a `denied` error (RESOURCE-01 H-03 prevention).
 */
export interface ResourceBytesRequest {
  type: 'resource.bytes';
  requestId: ResourceRequestId;
  url: string;
  /** Optional subset of fetch init (method, headers). Body bytes are shell-proxy-internal. */
  init?: {
    method?: string;
    headers?: Readonly<Record<string, string>>;
  };
}

/**
 * Inbound: napplet cancels a previously-issued bytes request. Shell correlates
 * to the in-flight request by requestId and emits a `resource.bytes.error`
 * with `code: 'canceled'`.
 */
export interface ResourceCancelRequest {
  type: 'resource.cancel';
  requestId: ResourceRequestId;
}

/**
 * Outbound: successful fetch result.
 */
export interface ResourceBytesResult {
  type: 'resource.bytes.result';
  requestId: ResourceRequestId;
  status: number;
  headers: Readonly<Record<string, string>>;
  /** Raw response bytes, base64-encoded for the postMessage wire. */
  bodyBase64: string;
}

/**
 * Canonical typed-error codes for RESOURCE-03 cancel correlation + H-03
 * ungranted-origin refusal.
 */
export type ResourceErrorCode =
  | 'denied'
  | 'canceled'
  | 'network-error'
  | 'invalid-url'
  | 'class-forbidden';

/**
 * Outbound: error result — used for both grant-refusal (RESOURCE-01) and
 * cancel-correlation (RESOURCE-03) cases.
 */
export interface ResourceBytesError {
  type: 'resource.bytes.error';
  requestId: ResourceRequestId;
  code: ResourceErrorCode;
  message: string;
}

/**
 * Union of all inbound resource wire messages (napplet -> shell).
 */
export type ResourceInbound = ResourceBytesRequest | ResourceCancelRequest;

/**
 * Union of all outbound resource wire messages (shell -> napplet).
 */
export type ResourceOutbound = ResourceBytesResult | ResourceBytesError;
