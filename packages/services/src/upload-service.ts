/**
 * upload-service.ts — NAP-UPLOAD (shell-mediated file/blob upload) reference service.
 *
 * Shell-side handler for the NAP-UPLOAD wire protocol. It is a pure envelope
 * router: it validates `upload.*` envelopes, delegates the actual byte transfer
 * (server selection, rail authorization signing, the HTTP upload) to an injected
 * {@link Uploader}, and posts the correlated result / status messages back to the
 * napplet.
 *
 * The uploader is injected (options-as-bridge) so this service has no transport
 * or Nostr dependency and is fully unit-testable. NAP-UPLOAD is deliberately
 * abstract over the backend — the runtime decides *how* it uploads (NIP-96,
 * Blossom, …). A concrete HTTP-backed uploader ships alongside as
 * {@link createHttpUploader}.
 *
 * ──────────────────────────── Responsibilities ────────────────────────────
 *   Inbound:  upload.upload, upload.status
 *   Outbound: upload.upload.result, upload.status.result, upload.status.changed
 *
 * The service owns the `uploadId` (generated per request, scoped to the
 * requesting napplet), tracks the latest {@link UploadStatus} per upload for
 * `upload.status` queries, and cleans up on window teardown. The shell owns
 * consent, policy, server selection, signing, and the HTTP upload — all behind
 * the {@link Uploader}.
 *
 * @example
 * ```ts
 * import { createUploadService, createHttpUploader } from '@kehto/services';
 *
 * const uploader = createHttpUploader({ rails: { nip96: { servers } }, signEvent });
 * runtime.registerService('upload', createUploadService({ uploader }));
 * ```
 *
 * @packageDocumentation
 */

import type { NappletMessage } from '@napplet/core';
import type { ServiceDescriptor, ServiceHandler } from '@kehto/runtime';

/** Upload service version — follows semver. */
const UPLOAD_SERVICE_VERSION = '1.0.0';

/**
 * Storage rail. `nip96` (NIP-96 HTTP file storage) and `blossom` (Blossom blob
 * storage) are the first concrete backends; the open string keeps the API
 * stable as shells add rails (torrents, usenet, …).
 */
export type UploadRail = 'nip96' | 'blossom' | (string & {});

/** Lifecycle state of an upload. */
export type UploadState = 'pending' | 'uploading' | 'complete' | 'failed' | 'cancelled';

/** Pixel dimensions of an uploaded image/video. */
export interface UploadDimensions {
  width: number;
  height: number;
}

/**
 * A napplet's upload request. `data` crosses the postMessage boundary by
 * structured clone — shells never require base64 encoding.
 */
export interface UploadRequest {
  /** Storage rail; omit to let the shell pick a configured default. */
  rail?: UploadRail;
  /** The bytes to upload. */
  data: ArrayBuffer | Blob;
  /** MIME type; inferred from `data` when omitted. */
  mimeType?: string;
  /** Suggested filename. */
  filename?: string;
  /** Alt text / description for the file event. */
  caption?: string;
  /** Request the server not re-encode the file (NIP-96 `no_transform`). */
  noTransform?: boolean;
  /** Rail-specific or shell-specific extra metadata. */
  metadata?: Record<string, unknown>;
}

/** A single Nostr tag (NIP-94 / imeta entries are arrays of strings). */
export type NostrTag = string[];

/** The result of an upload. */
export interface UploadResult {
  /** Whether the upload succeeded (or is progressing) vs failed/cancelled. */
  ok: boolean;
  /** Shell-generated id, scoped to the requesting napplet. */
  uploadId: string;
  /** Current lifecycle state. */
  status: UploadState;
  /** The rail the shell used. */
  rail: UploadRail;
  /** Primary download URL. */
  url?: string;
  /** Mirrors / alternative server URLs. */
  fallbackUrls?: string[];
  /** Hash of the stored blob (NIP-94 `x`). */
  sha256?: string;
  /** Hash before server transforms (NIP-94 `ox`). */
  originalSha256?: string;
  /** Size in bytes. */
  size?: number;
  /** Stored MIME type. */
  mimeType?: string;
  /** Image/video dimensions when known. */
  dimensions?: UploadDimensions;
  /** Blurhash placeholder when known. */
  blurhash?: string;
  /** Ready-to-attach NIP-94 / imeta tags. */
  nip94?: NostrTag[];
  /** Error reason when the upload failed or was cancelled. */
  error?: string;
}

/** A status snapshot for an upload, including progress counters. */
export interface UploadStatus extends UploadResult {
  /** Bytes sent so far (while uploading). */
  bytesSent?: number;
  /** Total bytes to send. */
  bytesTotal?: number;
  /** Unix ms timestamp of this status. */
  updatedAt: number;
}

/**
 * Context handed to an {@link Uploader} for a single upload. Carries the
 * service-owned `uploadId` and a sink for streaming progress / state changes.
 */
export interface UploaderContext {
  /** The service-generated upload id (authoritative; scoped to the napplet). */
  uploadId: string;
  /** The napplet window that requested the upload. */
  windowId: string;
  /**
   * Push a status update (progress, or a transition to complete/failed). The
   * service stamps `uploadId` and `updatedAt` before forwarding to the napplet
   * as `upload.status.changed`, and records it as the latest tracked status.
   */
  onStatus(status: UploadStatus): void;
}

/**
 * Abstract upload backend. Implementors own server selection, rail
 * authorization signing (NIP-98 for NIP-96, kind 24242 for Blossom), the HTTP
 * upload, and integrity-hash reporting. The service translates wire envelopes
 * into these calls and back. A concrete reference implementation ships as
 * {@link createHttpUploader}.
 */
export interface Uploader {
  /** Upload `request.data`, streaming progress through `ctx.onStatus`. */
  upload(request: UploadRequest, ctx: UploaderContext): Promise<UploadResult>;
  /** Optional: resolve the latest status for an upload the service is not tracking. */
  status?(uploadId: string): Promise<UploadStatus | undefined>;
  /** Optional: abort an in-flight upload (called on window teardown). */
  cancel?(uploadId: string): void;
}

/** Options for {@link createUploadService}. */
export interface UploadServiceOptions {
  /** The upload backend the shell uses. Required. */
  uploader: Uploader;
  /** Generate an upload id; defaults to `crypto.randomUUID()`. */
  generateId?: () => string;
  /** Current time in unix ms; defaults to `Date.now()`. */
  now?: () => number;
}

type Send = (msg: NappletMessage) => void;

const UPLOAD_DESCRIPTOR: ServiceDescriptor = {
  name: 'upload',
  version: UPLOAD_SERVICE_VERSION,
  description: 'NAP-UPLOAD shell-mediated file/blob upload — upload/status with progress pushes',
};

/** Per-upload tracking entry, keyed by `windowId:uploadId`. */
interface UploadEntry {
  uploadId: string;
  status?: UploadStatus;
}

declare const crypto: { randomUUID(): string };

/**
 * Create the NAP-UPLOAD service handler.
 *
 * @param options - Must provide an {@link Uploader}.
 * @returns A `ServiceHandler` ready for `runtime.registerService('upload', handler)`.
 * @throws If `options.uploader` is missing.
 */
export function createUploadService(options: UploadServiceOptions): ServiceHandler {
  if (!options || typeof options.uploader !== 'object' || options.uploader === null) {
    throw new Error('createUploadService: options.uploader is required');
  }
  const { uploader } = options;
  const generateId = options.generateId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => Date.now());

  // Tracked uploads keyed by `windowId:uploadId` for status lookup + cleanup.
  const entries = new Map<string, UploadEntry>();

  function handleUpload(windowId: string, msg: NappletMessage, send: Send): void {
    const m = msg as NappletMessage & { id?: string; request?: UploadRequest };
    const id = m.id ?? '';
    const request = m.request;
    if (!request || typeof request !== 'object' || request.data == null) {
      send({ type: 'upload.upload.result', id, error: 'invalid request' } as NappletMessage);
      return;
    }

    const uploadId = generateId();
    const key = `${windowId}:${uploadId}`;
    entries.set(key, { uploadId });

    const ctx: UploaderContext = {
      uploadId,
      windowId,
      onStatus: (status) => {
        const stamped: UploadStatus = { ...status, uploadId, updatedAt: status.updatedAt || now() };
        const entry = entries.get(key);
        if (entry) entry.status = stamped;
        send({ type: 'upload.status.changed', status: stamped } as NappletMessage);
      },
    };

    void uploader
      .upload(request, ctx)
      .then((result) => {
        const stamped: UploadResult = { ...result, uploadId };
        const entry = entries.get(key);
        if (entry) entry.status = { ...stamped, updatedAt: now() };
        send({ type: 'upload.upload.result', id, result: stamped } as NappletMessage);
      })
      .catch((err) => {
        entries.delete(key);
        send({ type: 'upload.upload.result', id, error: toErrorMessage(err) } as NappletMessage);
      });
  }

  function handleStatus(windowId: string, msg: NappletMessage, send: Send): void {
    const m = msg as NappletMessage & { id?: string; uploadId?: string };
    const id = m.id ?? '';
    const uploadId = m.uploadId;
    if (typeof uploadId !== 'string' || uploadId.length === 0) {
      send({ type: 'upload.status.result', id, error: 'invalid uploadId' } as NappletMessage);
      return;
    }

    const tracked = entries.get(`${windowId}:${uploadId}`)?.status;
    if (tracked) {
      send({ type: 'upload.status.result', id, status: tracked } as NappletMessage);
      return;
    }

    if (uploader.status) {
      void uploader
        .status(uploadId)
        .then((status) =>
          send(
            status
              ? ({ type: 'upload.status.result', id, status } as NappletMessage)
              : ({ type: 'upload.status.result', id, error: 'unknown upload' } as NappletMessage),
          ),
        )
        .catch((err) =>
          send({ type: 'upload.status.result', id, error: toErrorMessage(err) } as NappletMessage),
        );
      return;
    }

    send({ type: 'upload.status.result', id, error: 'unknown upload' } as NappletMessage);
  }

  return {
    descriptor: UPLOAD_DESCRIPTOR,
    handleMessage(windowId: string, message: NappletMessage, send: Send): void {
      switch (message.type) {
        case 'upload.upload':
          handleUpload(windowId, message, send);
          return;
        case 'upload.status':
          handleStatus(windowId, message, send);
          return;
        default:
          // Unknown upload.* action — silently ignored (forward-compatible).
          return;
      }
    },
    onWindowDestroyed(windowId: string): void {
      const prefix = `${windowId}:`;
      for (const [key, entry] of entries) {
        if (key.startsWith(prefix)) {
          uploader.cancel?.(entry.uploadId);
          entries.delete(key);
        }
      }
    },
  };
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'upload request failed';
}
