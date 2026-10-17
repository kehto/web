import { denyNappletControllerAccess, originRegistry } from '@kehto/shell';
import { resolvePajaSharedLinkHandler } from './browser-intent-link-target.js';
import type { PajaIntentLinkProgress } from './browser-intent-links.js';
import type { ParsedPajaIntentLink } from './intent-link.js';
import { postPajaIntentLauncherMessage, resolvePajaIntentLauncher } from './intent-launcher.js';
import type { PajaBrowserState, PajaBrowserStateContext } from './browser-host.js';

/** Open shared content through a short-lived verified launcher frame. */
export async function launchPajaSharedIntent(
  state: PajaBrowserState,
  context: PajaBrowserStateContext,
  intent: ParsedPajaIntentLink,
  progress: PajaIntentLinkProgress,
  setPointerStatus: (state: PajaBrowserState, message: string) => void,
): Promise<void> {
  const { runtime } = context;
  if (!progress.isActive()) return;
  const explicitHandler = await resolvePajaSharedLinkHandler(context, intent, progress);
  if (!progress.isActive()) return;
  const launcher = await resolvePajaIntentLauncher();
  if (!progress.isActive()) return;
  const frame = document.createElement('iframe');
  frame.hidden = true;
  denyNappletControllerAccess(frame);
  frame.sandbox.add('allow-scripts');
  frame.setAttribute('aria-hidden', 'true');
  context.stage.append(frame);
  const windowId = `${context.config.window.id}:intent-launcher:${crypto.randomUUID()}`;
  const admissionController = new AbortController();
  let readyResolve!: () => void;
  let readyReject!: (reason: Error) => void;
  const ready = new Promise<void>((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  const outcomes = new Map<string, (value: unknown) => void>();
  const source = frame.contentWindow;
  if (!source) throw new Error('Paja intent launcher frame is unavailable');
  runtime.intentSenderIds.set(windowId, launcher.manifest.catalogId);
  runtime.launcherFrames.set(source, {
    windowId,
    frame,
    progress,
    ready: readyResolve,
    result(correlation, value) {
      const settle = outcomes.get(correlation);
      if (!settle) return;
      outcomes.delete(correlation);
      settle(value);
    },
  });
  const teardown = () => {
    admissionController.abort();
    runtime.explicitIntentHandlers.delete(windowId);
    runtime.intentSenderIds.delete(windowId);
    runtime.launcherFrames.delete(source);
    context.bridge.runtime.destroyWindow(windowId);
    context.bridge.runtime.sessionRegistry.unregister(windowId);
    originRegistry.unregister(windowId);
    frame.remove();
  };
  try {
    const registered = await context.navigateFrame(frame, context.config, state.generation + 1,
      context.adapter, context.bridge.runtime, launcher, windowId,
      () => progress.isActive(), undefined, admissionController.signal);
    if (registered !== windowId) throw new Error('Paja intent launcher registration failed');
    const timeout = window.setTimeout(() => readyReject(new Error('Paja intent launcher did not become ready')), 10_000);
    try { await ready; } finally { window.clearTimeout(timeout); }
    if (!progress.isActive()) return;
    const correlation = crypto.randomUUID();
    let outcomeTimer: number | undefined;
    const outcome = new Promise<unknown>((resolve, reject) => {
      outcomes.set(correlation, resolve);
      outcomeTimer = window.setTimeout(() => {
        if (outcomes.delete(correlation)) reject(new Error('Paja intent launcher did not return an acceptance result'));
      }, 10_000);
    });
    const selectedHandler = explicitHandler ?? (intent.request.handler === 'choose' ? 'choose' : undefined);
    if (explicitHandler !== undefined) runtime.explicitIntentHandlers.set(windowId, explicitHandler);
    if (!progress.isActive()) return;
    postPajaIntentLauncherMessage(frame, {
      type: 'paja.intent.launch',
      correlation,
      uri: intent.uri,
      ...(Object.hasOwn(intent, 'payload') || selectedHandler !== undefined ? { options: {
        ...(Object.hasOwn(intent, 'payload') ? { payload: intent.payload } : {}),
        ...(selectedHandler === undefined ? {} : { handler: selectedHandler }),
      } } : {}),
    });
    const result = await outcome.finally(() => { if (outcomeTimer !== undefined) window.clearTimeout(outcomeTimer); });
    if (!progress.isActive()) return;
    if (!result || typeof result !== 'object' || (result as { ok?: unknown }).ok !== true) {
      const detail = (result as { error?: unknown })?.error;
      throw new Error(typeof detail === 'string' ? detail : 'Intent launch was rejected');
    }
    progress.accepted();
    setPointerStatus(state, 'intent accepted');
  } finally {
    teardown();
  }
}
