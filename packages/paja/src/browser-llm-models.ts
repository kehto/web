/**
 * Model discovery for NAP-LLM connection presets that list their models.
 *
 * A preset may declare `modelsPath` (Routstr's `/models` does). The panel then
 * offers a dropdown instead of free-text entry, seeded from one `GET` against
 * that path. The request is browser-direct — the same transport the generation
 * itself uses — so a server that answers generation but omits CORS headers on
 * its listing route fails here, and the panel says so instead of showing an
 * empty dropdown. Nothing from this module is sent anywhere but the connection's
 * own base URL; the credential is placed on that one request only.
 *
 * @module
 */

/** Why a model listing failed. Providers never see these strings. */
export type PajaLlmModelsFailure = 'timeout' | 'aborted' | 'network' | 'http' | 'shape';

/** A listing failure with a message that is safe to show and never echoes a credential. */
export class PajaLlmModelsError extends Error {
  constructor(
    readonly failure: PajaLlmModelsFailure,
    message: string,
  ) {
    super(message);
    this.name = 'PajaLlmModelsError';
  }
}

/** Default listing deadline; a loopback server normally answers in milliseconds. */
export const PAJA_LLM_MODELS_TIMEOUT_MS = 8000;

/** Options for {@link fetchPajaLlmModels}. */
export interface PajaLlmModelsOptions {
  /** Absolute API root, already validated by `normalizePajaLlmBaseUrl`. */
  baseUrl: string;
  /** Listing path below the API root, e.g. `/models`. */
  modelsPath: string;
  /** Optional key; sent as `authorization: Bearer …` on this request only. */
  credential?: string;
  /** Fetch surface; defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** Aborts the listing (panel edits, preset changes, page unload). */
  signal?: AbortSignal;
  /** Deadline; defaults to {@link PAJA_LLM_MODELS_TIMEOUT_MS}. */
  timeoutMs?: number;
}

/**
 * Join an API root and a listing path into the request URL.
 *
 * @param baseUrl - Normalized API root, with or without a path (`…/v1`).
 * @param modelsPath - Listing path, with or without a leading slash.
 * @returns Absolute listing URL.
 * @example llmModelsUrl('http://127.0.0.1:8008/v1', '/models') // 'http://127.0.0.1:8008/v1/models'
 */
export function llmModelsUrl(baseUrl: string, modelsPath: string): string {
  return `${baseUrl.trim().replace(/\/+$/, '')}/${modelsPath.trim().replace(/^\/+/, '')}`;
}

/** Accept the OpenAI `{ data: [{ id }] }` shape plus the plain forms hosts echo back. */
function readModelIds(body: unknown): string[] {
  const rows = Array.isArray(body)
    ? body
    : body && typeof body === 'object'
      ? (body as { data?: unknown; models?: unknown }).data ?? (body as { models?: unknown }).models
      : undefined;
  if (!Array.isArray(rows)) throw new PajaLlmModelsError('shape', 'The server did not return a model list.');
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const id = typeof row === 'string'
      ? row
      : row && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'string'
        ? (row as { id: string }).id
        : undefined;
    const trimmed = id?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    ids.push(trimmed);
  }
  if (ids.length === 0) throw new PajaLlmModelsError('shape', 'The server reported no models.');
  return ids.sort((a, b) => a.localeCompare(b));
}

/**
 * List the models a connection's provider serves.
 *
 * @param options - API root, listing path, optional credential and cancellation.
 * @returns Sorted, de-duplicated model ids.
 * @throws {PajaLlmModelsError} Timeout, abort, transport failure, non-2xx or an unusable body.
 * @example await fetchPajaLlmModels({ baseUrl: 'http://127.0.0.1:8008/v1', modelsPath: '/models' })
 */
export async function fetchPajaLlmModels(options: PajaLlmModelsOptions): Promise<string[]> {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? PAJA_LLM_MODELS_TIMEOUT_MS;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const abortFromCaller = (): void => controller.abort();
  options.signal?.addEventListener('abort', abortFromCaller, { once: true });
  const reason = (): PajaLlmModelsFailure => (timedOut ? 'timeout' : options.signal?.aborted ? 'aborted' : 'network');
  try {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (options.credential) headers.authorization = `Bearer ${options.credential}`;
    const response = await fetchImpl(llmModelsUrl(options.baseUrl, options.modelsPath), {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new PajaLlmModelsError('http', `The server answered ${String(response.status)} for ${options.modelsPath}.`);
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new PajaLlmModelsError('shape', 'The server did not return JSON for the model list.');
    }
    return readModelIds(body);
  } catch (error) {
    if (error instanceof PajaLlmModelsError) throw error;
    if (timedOut || options.signal?.aborted) {
      throw new PajaLlmModelsError(reason(), timedOut
        ? `No answer from the server within ${String(Math.round(timeoutMs / 1000))}s.`
        : 'The model listing was cancelled.');
    }
    // A browser blocks a cross-origin read without CORS headers and reports only
    // "Failed to fetch"; name both causes rather than guessing one.
    throw new PajaLlmModelsError('network', 'Could not read the model list — the server is down, or it does not allow this page cross-origin (CORS).');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}
