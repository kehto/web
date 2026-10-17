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
    const authorizeNetwork: AuthorizeNetwork = async (destination, run) => {
      let origin: string;
      try {
        const parsed = new URL(destination);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return run(controller.signal);
        origin = parsed.origin;
      } catch {
        throw new Error('invalid network destination');
      }
      const networkController = new AbortController();
      const abortNetwork = () => networkController.abort();
      controller.signal.addEventListener('abort', abortNetwork, { once: true });
      const outcome = await runtime.authorizeOperation!(windowId, 'resource.network', [{
        category: 'network', domain: 'resource', operation: 'resource.network',
        scope: { kind: 'origin', value: origin },
      }], async (approved) => {
        approved.addEventListener('abort', abortNetwork, { once: true });
        if (approved.aborted) abortNetwork();
        try { return await run(networkController.signal); }
        finally { approved.removeEventListener('abort', abortNetwork); }
      }, controller.signal);
      controller.signal.removeEventListener('abort', abortNetwork);
      if (outcome.status !== 'executed') {
        throw new ResourceAuthorizationError('resource network permission unavailable or denied');
      }
      return outcome.value;
    };
    try { return await execute(controller.signal, authorizeNetwork); }
    finally { approval.removeEventListener('abort', abort); }
  }, signal);
}
