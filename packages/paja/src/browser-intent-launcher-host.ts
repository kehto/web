import { originRegistry } from '@kehto/shell';
import { naddrEncode } from 'nostr-tools/nip19';

import { pajaPointerResolverOptions } from './browser-intent-host.js';
import type { PajaIntentReview, PajaIntentReviewProgress } from './browser-intent-links.js';
import { postPajaIntentLauncherMessage, resolvePajaIntentLauncher } from './intent-launcher.js';
import { resolvePajaPointer, type PajaResolvedPointer } from './runtime-resolver.js';
import type { PajaBrowserState, PajaBrowserStateContext, PajaHostRuntimeState } from './browser-host.js';

/** Launch an accepted review through a short-lived verified launcher frame. */
export async function launchPajaReviewedIntent(
  state: PajaBrowserState,
  context: PajaBrowserStateContext,
  intent: PajaIntentReview,
  progress: PajaIntentReviewProgress,
  setPointerStatus: (state: PajaBrowserState, message: string) => void,
): Promise<void> {
  const { runtime } = context;
  let explicitHandler: string | undefined;
  if (!progress.isActive()) return;
  if (intent.pointer) {
    const target = await resolvePajaPointer(intent.pointer, pajaPointerResolverOptions(context));
    if (!progress.isActive()) return;
    const exact = target.manifest.archetypes.some((contract) =>
      contract.slug === intent.request.archetype && contract.convention === intent.request.convention);
    if (!exact) throw new Error('The explicitly named napplet does not advertise this exact intent convention');
    runtime.catalog.install(target);
    progress.selectedTarget(target.manifest.title ?? target.manifest.dTag);
    explicitHandler = target.manifest.catalogId;
  }
  if (intent.request.handlerHint && shouldResolveRecommendation(intent, runtime)) {
    const target = await resolveRecommendedIntentTarget(context, intent.request.handlerHint, intent.request.archetype, intent.request.convention);
    if (!progress.isActive()) return;
    if (target) {
      runtime.catalog.install(target);
      progress.selectedTarget(target.manifest.title ?? target.manifest.dTag);
    }
  }
  if (!progress.isActive()) return;
  const launcher = await resolvePajaIntentLauncher();
  if (!progress.isActive()) return;
  const frame = document.createElement('iframe');
  frame.hidden = true;
  frame.sandbox.add('allow-scripts');
  frame.setAttribute('aria-hidden', 'true');
  context.stage.append(frame);
  const windowId = `${context.config.window.id}:intent-launcher:${crypto.randomUUID()}`;
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
    runtime.explicitIntentHandlers.delete(windowId);
    runtime.intentSenderIds.delete(windowId);
    runtime.launcherFrames.delete(source);
    context.bridge.runtime.destroyWindow(windowId);
    context.bridge.runtime.sessionRegistry.unregister(windowId);
    originRegistry.unregister(windowId);
    frame.remove();
  };
  try {
    const registered = await context.navigateFrame(frame, context.config, state.generation + 1, context.adapter, launcher, windowId);
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

function shouldResolveRecommendation(intent: PajaIntentReview, runtime: PajaHostRuntimeState): boolean {
  if (intent.request.handler !== undefined) return false;
  const defaultId = runtime.intentDefaults.get(intent.request.archetype);
  if (!defaultId) return true;
  const record = runtime.catalog.get(defaultId);
  return !record || !record.archetypes.some((entry) =>
    entry.slug === intent.request.archetype && entry.convention === intent.request.convention);
}

async function resolveRecommendedIntentTarget(
  context: PajaBrowserStateContext,
  hint: { readonly address: string; readonly relays?: readonly string[] },
  archetype: string,
  convention: string,
): Promise<PajaResolvedPointer | null> {
  const match = /^35129:([a-f0-9]{64}):(.+)$/.exec(hint.address);
  if (!match) return null;
  const [, pubkey, identifier] = match;
  const existing = context.runtime.catalog.installed().find((record) =>
    record.id === `nip5d:${hint.address}`
    && record.archetypes.some((entry) => entry.slug === archetype && entry.convention === convention));
  if (existing) return null;
  const pointer = naddrEncode({ identifier, pubkey, kind: 35_129, relays: [...(hint.relays ?? [])] });
  let target: PajaResolvedPointer;
  try {
    target = await resolvePajaPointer(pointer, pajaPointerResolverOptions(context));
  } catch {
    return null;
  }
  const exactCoordinate = target.event.kind === 35_129
    && target.event.pubkey === pubkey
    && target.manifest.dTag === identifier;
  const exactContract = target.manifest.archetypes.some((entry) =>
    entry.slug === archetype && entry.convention === convention);
  if (!exactCoordinate || !exactContract) return null;
  if (!window.confirm(`Install and use recommended handler ${target.manifest.title ?? target.manifest.dTag}?`)) return null;
  return target;
}
