import type { ApprovalOutcome, PermissionRequirement, ServiceRuntimeContext } from '@kehto/runtime';

/** Authorize one actual resolver destination while retaining the request lifetime. */
export type AuthorizeNetwork = <T>(destination: string, execute: (signal: AbortSignal) => Promise<T>) => Promise<T>;

/** A denied runtime approval projected onto NAP-RESOURCE's stable error set. */
export class ResourceAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResourceAuthorizationError';
  }
}

/** Internal resource boundary; resolvers still authorize indirect destinations. */
export async function authorizeResource<T>(runtime: ServiceRuntimeContext | undefined,
  windowId: string, url: string, signal: AbortSignal,
  execute: (signal: AbortSignal, authorizeNetwork: AuthorizeNetwork) => Promise<T>,
  warnLegacy: () => void): Promise<ApprovalOutcome<T>> {
  if (signal.aborted) return { status: 'cancelled' };
  if (!runtime?.authorizeOperation) {
    warnLegacy();
    return { status: 'executed', value: await execute(signal, async (_destination, run) => run(signal)) };
  }
  const requirements: PermissionRequirement[] = [{ category: 'resource', domain: 'resource',
    operation: 'resource.bytes', scope: { kind: 'exact', value: url } }];
  return runtime.authorizeOperation(windowId, 'resource.bytes', requirements, async (approval) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    approval.addEventListener('abort', abort, { once: true });
    if (approval.aborted) abort();
    const pendingNetworkOperations = new Set<() => void>();
    const activeNetworkOrigins = new Map<string, Promise<AbortSignal>>();
    const authorizeNetwork: AuthorizeNetwork = async <U>(destination: string, run: (signal: AbortSignal) => Promise<U>): Promise<U> => {
      let origin: string;
      try {
        const parsed = new URL(destination);
        if (!['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol)) {
          throw new ResourceAuthorizationError('resource network destination scheme is not supported');
        }
        if (parsed.username || parsed.password) {
          throw new ResourceAuthorizationError('resource network destination credentials are not allowed');
        }
        origin = parsed.origin;
      } catch (error) {
        if (error instanceof ResourceAuthorizationError) throw error;
        throw new Error('invalid network destination');
      }
      // Reuse a live approval for a second hop to the same origin within this
      // one resource operation. The approval coordinator serializes equal
      // requests, so opening another held operation here would deadlock a
      // same-origin redirect before it reaches its transport callback.
      const activeSignal = activeNetworkOrigins.get(origin);
      if (activeSignal) {
        const signal = await activeSignal;
        if (signal.aborted) throw new ResourceAuthorizationError('resource network permission unavailable or denied');
        return run(signal);
      }
      const networkController = new AbortController();
      const abortNetwork = () => {
        networkController.abort();
        // A revoked network grant invalidates the resource operation even when
        // the resolver returned response headers before its body was consumed.
        // This also prevents a resolver that ignores AbortSignal from producing
        // a late resource terminal.
        controller.abort();
      };
      controller.signal.addEventListener('abort', abortNetwork, { once: true });
      let release: (() => void) | undefined;
      let resolveActiveSignal: ((signal: AbortSignal) => void) | undefined;
      let rejectActiveSignal: ((reason: unknown) => void) | undefined;
      const activeSignalReady = new Promise<AbortSignal>((resolve, reject) => {
        resolveActiveSignal = resolve;
        rejectActiveSignal = reject;
      });
      // The first caller may be the only waiter; keep a rejection from a
      // denied prompt observable to later callers without making it unhandled.
      void activeSignalReady.catch(() => {});
      activeNetworkOrigins.set(origin, activeSignalReady);
      const outcome = runtime.authorizeOperation!(windowId, 'resource.network', [{
        category: 'network', domain: 'resource', operation: 'resource.network',
        scope: { kind: 'origin', value: origin },
      }], async (approved): Promise<void> => {
        approved.addEventListener('abort', abortNetwork, { once: true });
        if (approved.aborted) abortNetwork();
        try {
          if (networkController.signal.aborted) {
            throw new ResourceAuthorizationError('resource network permission unavailable or denied');
          }
          resolveActiveSignal!(networkController.signal);
          // Keep the approval alive independently from any one transport
          // callback: same-origin redirects and parallel resolver work share
          // this lease until the enclosing resource operation completes.
          await new Promise<void>((resolve) => { release = resolve; });
        } finally {
          approved.removeEventListener('abort', abortNetwork);
        }
      }, controller.signal);
      const releaseNetwork = () => {
        pendingNetworkOperations.delete(releaseNetwork);
        activeNetworkOrigins.delete(origin);
        release?.();
      };
      pendingNetworkOperations.add(releaseNetwork);
      void outcome.then((value) => {
        if (value.status !== 'executed') {
          const error = new ResourceAuthorizationError('resource network permission unavailable or denied');
          rejectActiveSignal!(error);
        }
      }).catch((error: unknown) => {
        rejectActiveSignal!(error);
      }).finally(() => {
        // Coordinator cancellation settles its race before a resolver that
        // ignores AbortSignal returns. Release the held callback here as well
        // as at normal resource completion so it cannot linger indefinitely.
        releaseNetwork();
        controller.signal.removeEventListener('abort', abortNetwork);
      });
      const signal = await activeSignalReady;
      if (signal.aborted) throw new ResourceAuthorizationError('resource network permission unavailable or denied');
      return run(signal);
    };
    try { return await execute(controller.signal, authorizeNetwork); }
    finally {
      controller.abort();
      for (const releaseNetwork of pendingNetworkOperations) releaseNetwork();
      approval.removeEventListener('abort', abort);
    }
  }, signal);
}
