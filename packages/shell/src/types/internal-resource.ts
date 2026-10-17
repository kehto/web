/**
 * @file internal-resource.ts
 *
 * Kehto-internal shell-side resource wire types. Per PROJECT.md Decision #31,
 * this is NOT a staging-ground duplicate of upstream `@napplet/nap/resource`.
 * Canonical resource info, per-resource request, and result-item shapes are
 * imported from the published package. The remaining local envelopes retain
 * Kehto's legacy compatibility fields (`requestId`, `bodyBase64`, status, and
 * headers) alongside the current `id`, `blob`, and `mime` fields.
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

import type { ResourceInfo } from '@napplet/nap/resource/types';

export type { ResourceInfo } from '@napplet/nap/resource/types';

/**
 * Unique id for correlating a `resource.bytes` request to its later result /
 * error / cancel envelope.
 */
export type ResourceRequestId = string;

/** Inbound: napplet asks for advisory resource policy and scheme support. */
export interface ResourceInfoRequest {
  type: 'resource.info';
  id: ResourceRequestId;
}

/**
 * Inbound: napplet requests one resource by its exact original URL.
 */
export interface ResourceBytesRequest {
  type: 'resource.bytes';
  id: ResourceRequestId;
  url: string;
}

/**
 * Inbound: napplet cancels a previously-issued bytes request. Shell correlates
 * to the in-flight request. Cancellation has no terminal envelope.
 */
export interface ResourceCancelRequest {
  type: 'resource.cancel';
  id: ResourceRequestId;
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
  id: ResourceRequestId;
  /** Canonical padded RFC 4648 base64 bytes. */
  blob: string;
  mime: string;
}

/**
 * Canonical typed-error codes for RESOURCE-03 cancel correlation + H-03
 * ungranted-origin refusal.
 */
export type ResourceErrorCode = string;

/**
 * Outbound: error result — used for both grant-refusal (RESOURCE-01) and
 * cancel-correlation (RESOURCE-03) cases.
 */
export interface ResourceBytesError {
  type: 'resource.bytes.error';
  /** Current NAP-RESOURCE correlation ID. */
  id: ResourceRequestId;
  error: ResourceErrorCode;
  message?: string;
}

/**
 * Current NAP-RESOURCE bulk result item.
 */
export type ResourceBytesManyItem = {
  url: string; ok: true; blob: string; mime: string;
} | {
  url: string; ok: false; error: string; message?: string;
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
