import type { NostrEvent, NostrFilter } from '@napplet/core';
import type { Signer } from '@kehto/runtime';
import {
  createHttpUploader,
  type UploadInfo,
  type UploadRequest,
  type UploadResult,
  type Uploader,
} from '@kehto/services';

import type { PajaConfirmationRequest } from './browser-adapter.js';
import {
  normalizeUploadServers,
  type PajaSimulation,
} from './simulation.js';

const BLOSSOM_SERVER_LIST_KIND = 10_063;
const PUBLIC_UPLOAD_WARNING = 'This upload is public and durable.';

interface NappletIdentity {
  readonly dTag: string;
  readonly aggregateHash: string;
}

/** Host-owned dependencies for Paja's real Blossom upload mode. */
export interface PajaUploadRuntimeOptions {
  readonly getSimulation: () => PajaSimulation;
  readonly getSigner: () => Signer | null;
  readonly getProviderPubkey: () => string | null;
  readonly queryDiscovery: (relayUrls: string[], filters: NostrFilter[]) => Promise<NostrEvent[]>;
  readonly getRelayUrls: () => string[];
  readonly confirmRequest: (request: PajaConfirmationRequest) => boolean;
  readonly getNappletIdentity: (windowId: string) => NappletIdentity;
  readonly fetch?: typeof fetch;
  readonly subscribeSignerChange?: (listener: () => void) => () => void;
}

/** One cache-only upload runtime shared by Paja's service and capability hooks. */
export interface PajaUploadRuntime {
  readonly uploader: Uploader;
  readonly uploadInfo: () => UploadInfo;
  readonly getBackend: () => { rails: string[] } | null;
  refreshIdentity(): Promise<void>;
  dispose(): void;
}

interface IdentitySnapshot {
  readonly pubkey: string;
  readonly signer: Signer & Required<Pick<Signer, 'getPublicKey' | 'signEvent'>>;
}

/**
 * Create Paja's shell-owned Blossom policy and transport adapter.
 *
 * Upload and introspection read validated snapshots only. Signer identity and
 * BUD-03 discovery are warmed separately through {@link refreshIdentity}.
 */
export function createPajaUploadRuntime(options: PajaUploadRuntimeOptions): PajaUploadRuntime {
  let generation = 0;
  let identity: IdentitySnapshot | null = null;
  let discovered: { pubkey: string; servers: string[] } | null = null;
  const activeUploads = new Map<string, Uploader>();

  async function refreshIdentity(): Promise<void> {
    const currentGeneration = ++generation;
    identity = null;
    discovered = null;
    const simulation = options.getSimulation();
    if (simulation.upload.mode !== 'blossom') return;

    const configuredPubkey = simulation.identity.pubkey.trim();
    const providerPubkey = options.getProviderPubkey()?.trim() ?? '';
    if (configuredPubkey && providerPubkey && configuredPubkey !== providerPubkey) return;

    const signer = options.getSigner();
    if (!hasWritableIdentity(signer)) return;
    let signerPubkey: string;
    try {
      signerPubkey = (await signer.getPublicKey()).trim();
    } catch {
      return;
    }
    if (!isHexPubkey(signerPubkey)) return;
    const candidates = [configuredPubkey, providerPubkey, signerPubkey].filter(Boolean);
    if (candidates.some((candidate) => candidate !== signerPubkey)) return;
    if (currentGeneration !== generation) return;

    identity = { pubkey: signerPubkey, signer };
    if (simulation.upload.servers.length > 0 || !simulation.upload.discoverServers) return;
    const relayUrls = options.getRelayUrls();
    if (relayUrls.length === 0) return;

    let events: NostrEvent[];
    try {
      events = await options.queryDiscovery(relayUrls, [{
        kinds: [BLOSSOM_SERVER_LIST_KIND],
        authors: [signerPubkey],
        limit: 1,
      }]);
    } catch {
      return;
    }
    if (currentGeneration !== generation || identity?.pubkey !== signerPubkey) return;
    const newest = events
      .filter((event) => event.kind === BLOSSOM_SERVER_LIST_KIND && event.pubkey === signerPubkey)
      .sort((left, right) => right.created_at - left.created_at)[0];
    discovered = {
      pubkey: signerPubkey,
      servers: newest ? normalizeDiscoveredServers(newest.tags) : [],
    };
  }

  const uploader: Uploader = {
    async upload(request, ctx) {
      const simulation = options.getSimulation();
      if (simulation.upload.mode !== 'blossom') {
        return failure(ctx.uploadId, 'upload simulation is not in blossom mode');
      }
      if (request.rail && request.rail !== 'blossom') {
        return failure(ctx.uploadId, 'unsupported rail');
      }
      const size = uploadSize(request);
      if (simulation.upload.maxBytes !== undefined && size > simulation.upload.maxBytes) {
        return failure(ctx.uploadId, 'file too large');
      }
      const mimeType = resolvedMimeType(request);
      if (simulation.upload.mimeTypes && (!mimeType || !simulation.upload.mimeTypes.includes(mimeType))) {
        return failure(ctx.uploadId, 'unsupported media type');
      }
      const snapshot = identity;
      if (!snapshot) return failure(ctx.uploadId, 'no signer available');
      const server = effectiveServers(simulation, snapshot.pubkey, discovered)[0];
      if (!server) return failure(ctx.uploadId, 'no server configured');
      if (!options.confirmRequest({
        action: 'upload',
        windowId: ctx.windowId,
        napplet: options.getNappletIdentity(ctx.windowId),
        filename: request.filename,
        size,
        mimeType,
        server,
        warning: PUBLIC_UPLOAD_WARNING,
      })) {
        return cancelled(ctx.uploadId);
      }

      const delegate = createHttpUploader({
        rails: { blossom: { servers: [server] } },
        defaultRail: 'blossom',
        signEvent: async (template) => {
          const event = await snapshot.signer.signEvent(template);
          if (event.pubkey !== snapshot.pubkey) {
            throw new Error('signer identity mismatch');
          }
          return event;
        },
        ...(options.fetch ? { fetch: options.fetch } : {}),
      });
      activeUploads.set(ctx.uploadId, delegate);
      try {
        const result = await delegate.upload({ ...request, rail: 'blossom', ...(mimeType ? { mimeType } : {}) }, ctx);
        if (result.ok && result.url && !isPermittedUploadUrl(result.url)) {
          return failure(ctx.uploadId, 'server returned disallowed url');
        }
        return result;
      } finally {
        activeUploads.delete(ctx.uploadId);
      }
    },
    cancel(uploadId) {
      activeUploads.get(uploadId)?.cancel?.(uploadId);
    },
  };

  function uploadInfo(): UploadInfo {
    const simulation = options.getSimulation();
    const snapshot = identity;
    const server = snapshot ? effectiveServers(simulation, snapshot.pubkey, discovered)[0] : undefined;
    return {
      rails: [{
        rail: 'blossom',
        enabled: simulation.upload.mode === 'blossom' && Boolean(snapshot && server),
        ...(server ? { returns: [new URL(server).protocol.slice(0, -1)] } : {}),
      }],
      ...(simulation.upload.maxBytes !== undefined ? { maxBytes: simulation.upload.maxBytes } : {}),
      ...(simulation.upload.mimeTypes ? { mimeTypes: [...simulation.upload.mimeTypes] } : {}),
    };
  }

  function getBackend(): { rails: string[] } | null {
    return uploadInfo().rails[0]?.enabled ? { rails: ['blossom'] } : null;
  }

  const unsubscribe = options.subscribeSignerChange?.(() => {
    void refreshIdentity();
  });

  return {
    uploader,
    uploadInfo,
    getBackend,
    refreshIdentity,
    dispose: () => unsubscribe?.(),
  };
}

function effectiveServers(
  simulation: PajaSimulation,
  pubkey: string,
  discovered: { pubkey: string; servers: string[] } | null,
): readonly string[] {
  if (simulation.upload.servers.length > 0) return simulation.upload.servers;
  return discovered?.pubkey === pubkey ? discovered.servers : [];
}

function normalizeDiscoveredServers(tags: string[][]): string[] {
  const servers: string[] = [];
  for (const tag of tags) {
    if (tag[0] !== 'server' || typeof tag[1] !== 'string') continue;
    try {
      const [server] = normalizeUploadServers([tag[1]]);
      if (server && !servers.includes(server)) servers.push(server);
    } catch {
      // Ignore invalid URLs in an untrusted relay event.
    }
  }
  return servers;
}

function hasWritableIdentity(signer: Signer | null): signer is Signer & Required<Pick<Signer, 'getPublicKey' | 'signEvent'>> {
  return typeof signer?.getPublicKey === 'function' && typeof signer.signEvent === 'function';
}

function isHexPubkey(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value);
}

function uploadSize(request: UploadRequest): number {
  return request.data instanceof Blob ? request.data.size : request.data.byteLength;
}

function resolvedMimeType(request: UploadRequest): string | undefined {
  return request.mimeType || (request.data instanceof Blob ? request.data.type || undefined : undefined);
}

function isPermittedUploadUrl(value: string): boolean {
  try {
    normalizeUploadServers([value]);
    return true;
  } catch {
    return false;
  }
}

function failure(uploadId: string, error: string): UploadResult {
  return { ok: false, uploadId, status: 'failed', rail: 'blossom', error };
}

function cancelled(uploadId: string): UploadResult {
  return { ok: false, uploadId, status: 'cancelled', rail: 'blossom', error: 'user cancelled' };
}
