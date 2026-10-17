import type { ApprovalOutcome, PermissionRequirement, ServiceRuntimeContext } from '@kehto/runtime';

/** Internal resource boundary; resolvers still authorize indirect destinations. */
export async function authorizeResource<T>(runtime: ServiceRuntimeContext | undefined,
  windowId: string, url: string, signal: AbortSignal, execute: (signal: AbortSignal) => Promise<T>,
  warnLegacy: () => void): Promise<ApprovalOutcome<T>> {
  if (signal.aborted) return { status: 'cancelled' };
  if (!runtime?.authorizeOperation) {
    warnLegacy();
    return { status: 'executed', value: await execute(signal) };
  }
  const requirements: PermissionRequirement[] = [{ category: 'resource', domain: 'resource',
    operation: 'resource.bytes', scope: { kind: 'exact', value: url } }];
  const parsed = new URL(url);
  if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
    requirements.push({ category: 'network', domain: 'resource', operation: 'resource.bytes',
      scope: { kind: 'origin', value: parsed.origin } });
  }
  return runtime.authorizeOperation(windowId, 'resource.bytes', requirements, async (approval) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    approval.addEventListener('abort', abort, { once: true });
    if (approval.aborted) abort();
    try { return await execute(controller.signal); }
    finally { approval.removeEventListener('abort', abort); }
  }, signal);
}
