import type { PermissionAdmission, Runtime, SessionEntry } from '@kehto/runtime';
import { buildApprovedNappletCsp, classifyBrowserRemoteSources } from './napplet-csp.js';
import type { BrowserLaunchMode, BrowserRemoteSource } from './napplet-csp.js';
import { insertNappletHead } from './napplet-head.js';
import { renderNappletNamespacePrelude } from './napplet-namespace.js';

/** A required interface conflicts with direct browser authority. */
export interface BrowserAdmissionOmission {
  readonly domain: string;
  readonly reason: 'direct-network-excludes-resource';
}

/** Trusted inputs to one provisional-session and executable-byte transaction. */
export interface BrowserAdmissionRequest {
  /** Runtime that owns the source, approval coordinator, and grant store. */
  readonly runtime: Pick<Runtime, 'sessionRegistry' | 'permissions' | 'destroyWindow'>;
  /** Host-attested source identity; its principal must bind this artifact hash. */
  readonly entry: SessionEntry;
  /** Artifact HTML already verified by the host resolver, or explicit dev bytes. */
  readonly verifiedHtml: string;
  /** Complete host-supported and manifest-declared interface sets. */
  readonly available: readonly string[];
  readonly required: readonly string[];
  readonly optional: readonly string[];
  /** Exact remote browser sources proposed by trusted host configuration. */
  readonly remoteSources: readonly BrowserRemoteSource[];
  /** True only while this exact frame generation remains the active source. */
  readonly isCurrentSource: () => boolean;
  /** Navigation, closure, or replacement cancellation. */
  readonly signal?: AbortSignal;
  /** Synchronous assignment of the supplied prepared srcdoc to the frame. */
  readonly commit: (srcdoc: string, result: BrowserAdmissionCommit) => void;
  /** Remove an executing frame and host source binding after invalidation. */
  readonly onRetire: () => void;
}

/** Exact grants and CSP committed with the source in one synchronous step. */
export interface BrowserAdmissionCommit {
  readonly windowId: string;
  readonly domains: readonly string[];
  readonly mode: BrowserLaunchMode;
  readonly csp: string;
  readonly omittedOptional: readonly BrowserAdmissionOmission[];
}

/** Browser launch outcome, including a retirement handle for the live frame. */
export type BrowserAdmissionResult =
  | ({ readonly status: 'committed'; readonly retire: () => void } & BrowserAdmissionCommit)
  | { readonly status: Exclude<PermissionAdmission['status'], 'admitted'> | 'incompatible' | 'invalid';
      readonly deniedRequired: readonly string[];
      readonly omittedOptional: readonly BrowserAdmissionOmission[] };

function cspMeta(csp: string): string {
  return `<meta http-equiv="Content-Security-Policy" content="${csp.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">`;
}

/**
 * Admit a host-verified artifact before its executable bytes enter a frame.
 * The host must supply source-bound identity and assign `srcdoc` synchronously
 * inside `commit`; it must call `retire` on navigation or closure. Neither
 * development targets nor unsigned bytes may inherit signed-app grants.
 *
 * @param request - Trusted document, exact source lifecycle, and frame action.
 * @returns A committed source with a retirement handle, or a closed failure.
 * @example
 * ```ts
 * const result = await admitBrowserDocument({
 *   runtime, entry, verifiedHtml, available, required, optional,
 *   remoteSources: [], isCurrentSource: () => frame.isConnected,
 *   commit: (srcdoc) => { frame.srcdoc = srcdoc; },
 *   onRetire: () => { frame.removeAttribute('srcdoc'); },
 * });
 * ```
 */
export async function admitBrowserDocument(request: BrowserAdmissionRequest): Promise<BrowserAdmissionResult> {
  const omittedOptional: BrowserAdmissionOmission[] = [];
  const failed = (status: Exclude<BrowserAdmissionResult['status'], 'committed'>,
    deniedRequired: readonly string[] = []): BrowserAdmissionResult => ({ status, deniedRequired, omittedOptional });
  const { runtime, entry } = request;
  const permissions = runtime.permissions;
  if (!permissions) return failed('unavailable');
  if (!entry?.permissionPrincipal || !entry.windowId || typeof request.verifiedHtml !== 'string') return failed('invalid');
  if (entry.permissionPrincipal.artifactHash !== entry.aggregateHash) return failed('invalid');

  let remote: ReturnType<typeof classifyBrowserRemoteSources>;
  try { remote = classifyBrowserRemoteSources(request.remoteSources); }
  catch { return failed('invalid'); }
  const direct = remote.sources.length > 0;
  if (direct && request.required.includes('resource')) return failed('incompatible', ['resource']);
  const optional = direct ? request.optional.filter((domain) => {
    if (domain !== 'resource') return true;
    omittedOptional.push({ domain, reason: 'direct-network-excludes-resource' });
    return false;
  }) : request.optional;
  if (request.signal?.aborted || !request.isCurrentSource()) return failed('cancelled');

  runtime.sessionRegistry.register(entry.windowId, entry);
  const registered = runtime.sessionRegistry.getEntryByWindowId(entry.windowId);
  if (!registered) return failed('unavailable');
  let committed = false;
  let retired = false;
  let unsubscribe: (() => void) | undefined;
  const retire = (): void => {
    if (retired) return;
    retired = true;
    unsubscribe?.();
    request.signal?.removeEventListener('abort', retire);
    if (runtime.sessionRegistry.getEntryByWindowId(entry.windowId) === registered) {
      runtime.destroyWindow(entry.windowId);
      runtime.sessionRegistry.unregister(entry.windowId);
    }
    if (committed) {
      try { request.onRetire(); } catch { /* Host cleanup cannot restore authority. */ }
    }
  };
  request.signal?.addEventListener('abort', retire, { once: true });
  try {
    const admission = await permissions.admit(entry.windowId, {
      available: request.available, required: request.required, optional,
      launchRequirements: remote.requirements,
    });
    if (admission.status !== 'admitted') {
      retire();
      return failed(admission.status, admission.deniedRequired);
    }
    const mode: BrowserLaunchMode = direct ? 'direct-network'
      : admission.domains.includes('resource') ? 'mediated-resource' : 'isolated';
    const csp = buildApprovedNappletCsp({ mode, remoteSources: remote.sources });
    const srcdoc = insertNappletHead(request.verifiedHtml,
      cspMeta(csp) + renderNappletNamespacePrelude({ domains: admission.domains }));
    unsubscribe = permissions.subscribeInvalidation(() => {
      if (!permissions.isAdmissionCurrent(entry.windowId, admission) || !request.isCurrentSource()) retire();
    });
    if (retired || request.signal?.aborted || !request.isCurrentSource()
      || runtime.sessionRegistry.getEntryByWindowId(entry.windowId) !== registered
      || !permissions.isAdmissionCurrent(entry.windowId, admission)) {
      retire();
      return failed('cancelled');
    }
    const result: BrowserAdmissionCommit = {
      windowId: entry.windowId, domains: admission.domains, mode, csp, omittedOptional,
    };
    committed = true;
    const commitResult: unknown = request.commit(srcdoc, result);
    if (commitResult && typeof commitResult === 'object' && 'then' in commitResult) throw new TypeError('Frame commit must be synchronous');
    return { status: 'committed', ...result, retire };
  } catch {
    retire();
    return failed('invalid');
  }
}
