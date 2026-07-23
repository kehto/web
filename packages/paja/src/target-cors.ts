/**
 * Target dev-server CORS diagnostics.
 *
 * Paja loads the napplet target into a `srcdoc` iframe sandboxed without
 * `allow-same-origin`, so the napplet document has an opaque origin and sends
 * `Origin: null` on every subresource fetch. `<script type="module">` is always
 * fetched in CORS mode, so a dev server that does not allow the `null` origin
 * blocks the napplet's entry module and the iframe renders blank.
 *
 * These helpers probe the target with an explicit `Origin: null` request so
 * Paja can report the cause instead of leaving an empty frame behind.
 */

/** Whether the target dev server will serve the sandboxed frame's subresources. */
export type PajaTargetCorsStatus = 'allowed' | 'blocked' | 'unreachable';

/** Result of probing a target dev server for opaque-origin CORS support. */
export interface PajaTargetCorsDiagnostic {
  /** Classification of the probe result. */
  readonly status: PajaTargetCorsStatus;
  /** Target URL that was probed. */
  readonly targetUrl: string;
  /** `access-control-allow-origin` value the target returned, when any. */
  readonly allowOrigin: string | null;
  /** Human-readable explanation of the classification. */
  readonly detail: string;
  /** Actionable remedy, present only when `status` is not `allowed`. */
  readonly hint: string | null;
}

/** Remedy shown whenever the target rejects the sandboxed frame's `null` origin. */
export const PAJA_TARGET_CORS_HINT =
  "Paja sandboxes the napplet frame without allow-same-origin, so its assets are requested with `Origin: null`. "
  + "Allow that origin in the napplet dev server, e.g. Vite `server: { cors: { origin: '*' } }`.";

/**
 * Classify an `access-control-allow-origin` response value for an opaque origin.
 *
 * @param targetUrl - Target URL the header came from.
 * @param allowOrigin - Raw `access-control-allow-origin` header value, or `null` when absent.
 * @returns Diagnostic describing whether the sandboxed frame can load assets.
 * @example
 * ```ts
 * classifyTargetCors('http://127.0.0.1:5173/', '*').status; // 'allowed'
 * classifyTargetCors('http://127.0.0.1:5173/', null).status; // 'blocked'
 * ```
 */
export function classifyTargetCors(
  targetUrl: string,
  allowOrigin: string | null,
): PajaTargetCorsDiagnostic {
  const value = allowOrigin?.trim() ?? null;
  if (value === '*' || value === 'null') {
    return {
      status: 'allowed',
      targetUrl,
      allowOrigin: value,
      detail: `Target allows the sandboxed frame's null origin (access-control-allow-origin: ${value}).`,
      hint: null,
    };
  }
  if (value === null || value === '') {
    return {
      status: 'blocked',
      targetUrl,
      allowOrigin: null,
      detail: 'Target sent no access-control-allow-origin for an Origin: null request.',
      hint: PAJA_TARGET_CORS_HINT,
    };
  }
  return {
    status: 'blocked',
    targetUrl,
    allowOrigin: value,
    detail: `Target only allows origin "${value}", not the sandboxed frame's null origin.`,
    hint: PAJA_TARGET_CORS_HINT,
  };
}

/** Minimal fetch surface the probe depends on. */
export type PajaTargetCorsFetch = (
  input: string,
  init: { method: string; headers: Record<string, string> },
) => Promise<{ headers: { get(name: string): string | null } }>;

const defaultTargetCorsFetch: PajaTargetCorsFetch = (input, init) => fetch(input, init);

/**
 * Probe a target dev server for opaque-origin CORS support.
 *
 * Sends `Origin: null` explicitly — a browser cannot forge that header, but the
 * Paja server can, which is why the probe runs server-side.
 *
 * @param targetUrl - Absolute target URL served by the napplet dev server.
 * @param fetchImpl - Fetch implementation; defaults to the global `fetch`.
 * @returns Diagnostic describing whether the sandboxed frame can load assets.
 * @example
 * ```ts
 * const diagnostic = await probeTargetCors('http://127.0.0.1:5173/');
 * if (diagnostic.status === 'blocked') console.warn(diagnostic.hint);
 * ```
 */
export async function probeTargetCors(
  targetUrl: string,
  fetchImpl: PajaTargetCorsFetch = defaultTargetCorsFetch,
): Promise<PajaTargetCorsDiagnostic> {
  try {
    const response = await fetchImpl(targetUrl, {
      method: 'GET',
      headers: {
        origin: 'null',
        accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.8',
      },
    });
    return classifyTargetCors(targetUrl, response.headers.get('access-control-allow-origin'));
  } catch (error) {
    return {
      status: 'unreachable',
      targetUrl,
      allowOrigin: null,
      detail: `Target CORS probe failed: ${error instanceof Error ? error.message : String(error)}`,
      hint: 'Confirm the napplet dev server is running and --target-url points at it.',
    };
  }
}
