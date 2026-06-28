/**
 * @file internal-resource.ts
 *
 * Kehto-internal shell-side resource wire types. Per PROJECT.md Decision #31,
 * this is NOT a staging-ground duplicate of upstream `@napplet/nap/resource`:
 * Phase 44 audit confirmed the two surfaces diverge substantively — different
 * field names (kehto's legacy `requestId` vs upstream `id`; kehto's legacy
 * `bodyBase64` vs upstream `blob` + `mime`), different message-type names
 * (`ResourceBytesRequest` vs `ResourceBytesMessage`), and disjoint error
 * vocabularies (kehto: 4 codes `{denied, canceled, network-error, invalid-url}`;
 * upstream: 8 codes `{not-found, blocked-by-policy,
 * timeout, too-large, unsupported-scheme, decode-failed, network-error,
 * quota-exceeded}`).
 *
 * `resource-service.ts` now emits both legacy single-fetch compatibility
 * fields and the current upstream-compatible fields.
 *
 * Resource protocol:
 *   Inbound:  resource.info, resource.bytes, resource.bytesMany, resource.cancel
 *   Outbound: resource.info.result, resource.info.error,
 *             resource.bytes.result, resource.bytes.error,
 *             resource.bytesMany.result, resource.bytesMany.error
 */

/**
 * Unique id for correlating a `resource.bytes` request to its later result /
 * error / cancel envelope.
 */
export type ResourceRequestId = string;

/** Advisory resource capability and policy limits disclosed by the runtime. */
export interface ResourceInfo {
  schemes: readonly {
    scheme: string;
    enabled: boolean;
  }[];
  maxBytes?: number;
  maxUrls?: number;
}

/** Inbound: napplet asks for advisory resource policy and scheme support. */
export interface ResourceInfoRequest {
  type: 'resource.info';
  id: ResourceRequestId;
}

/**
 * Inbound: napplet requests bytes from an origin. Shell consults
 * getConnectGrants(dTag, aggregateHash) before proxying; ungranted origins
 * receive a `denied` error (RESOURCE-01 H-03 prevention).
 */
export interface ResourceBytesRequest {
  type: 'resource.bytes';
  /** Current NAP-RESOURCE correlation ID. */
  id?: ResourceRequestId;
  /** Legacy Kehto correlation ID. */
  requestId?: ResourceRequestId;
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
  /** Current NAP-RESOURCE correlation ID. */
  id?: ResourceRequestId;
  /** Legacy Kehto correlation ID. */
  requestId?: ResourceRequestId;
}

/**
 * Inbound: napplet requests many resource URLs in one envelope.
 */
export interface ResourceBytesManyRequest {
  type: 'resource.bytesMany';
  id: ResourceRequestId;
  urls: readonly string[];
}

/**
 * Outbound: successful fetch result.
 */
export interface ResourceBytesResult {
  type: 'resource.bytes.result';
  /** Current NAP-RESOURCE correlation ID. */
  id: ResourceRequestId;
  /** Legacy Kehto correlation ID. */
  requestId: ResourceRequestId;
  /** Current NAP-RESOURCE Blob payload. */
  blob?: Blob;
  /** Current NAP-RESOURCE runtime-classified MIME. */
  mime?: string;
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
  | 'invalid-url';

/**
 * Outbound: error result — used for both grant-refusal (RESOURCE-01) and
 * cancel-correlation (RESOURCE-03) cases.
 */
export interface ResourceBytesError {
  type: 'resource.bytes.error';
  /** Current NAP-RESOURCE correlation ID. */
  id: ResourceRequestId;
  /** Legacy Kehto correlation ID. */
  requestId: ResourceRequestId;
  /** Current NAP-RESOURCE error field. */
  error?: string;
  code: ResourceErrorCode;
  message: string;
}

/**
 * Current NAP-RESOURCE bulk result item.
 */
export type ResourceBytesManyItem =
  | {
      url: string;
      ok: true;
      blob: Blob;
      mime: string;
    }
  | {
      url: string;
      ok: false;
      error: string;
      message?: string;
    };

/**
 * Outbound: ordered bulk fetch result.
 */
export interface ResourceBytesManyResult {
  type: 'resource.bytesMany.result';
  id: ResourceRequestId;
  items: readonly ResourceBytesManyItem[];
}

/**
 * Outbound: top-level bulk request failure.
 */
export interface ResourceBytesManyError {
  type: 'resource.bytesMany.error';
  id: ResourceRequestId;
  error: string;
  message?: string;
}

/** Outbound: advisory resource policy and scheme support. */
export interface ResourceInfoResult {
  type: 'resource.info.result';
  id: ResourceRequestId;
  info: ResourceInfo;
}

/** Outbound: resource info could not be resolved. */
export interface ResourceInfoError {
  type: 'resource.info.error';
  id: ResourceRequestId;
  error: string;
  message?: string;
}

/**
 * Union of all inbound resource wire messages (napplet -> shell).
 */
export type ResourceInbound =
  | ResourceInfoRequest
  | ResourceBytesRequest
  | ResourceBytesManyRequest
  | ResourceCancelRequest;

/**
 * Union of all outbound resource wire messages (shell -> napplet).
 */
export type ResourceOutbound =
  | ResourceInfoResult
  | ResourceInfoError
  | ResourceBytesResult
  | ResourceBytesError
  | ResourceBytesManyResult
  | ResourceBytesManyError;
