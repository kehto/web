/**
 * Paja's NIP-5D host integration (nostr-protocol/nips#2303).
 *
 * NIP-5D binds napplet identity to the `MessagePort` handed over in a single
 * window-level `napplet.hello`; every NAP envelope then travels over that
 * port. Paja therefore:
 *
 * - forwards window-level messages from its own frames to the bridge, which
 *   binds the hello and revokes on anything else;
 * - observes port traffic through `ShellAdapter.onNappletMessage` for the
 *   devtools log and readiness;
 * - removes or replaces frames the bridge revoked through
 *   `ShellAdapter.onNappletRevoked`.
 *
 * Paja's verified intent launcher is shell-authored, signed artifact code
 * that reports `paja.intent.launcher.ready` / `.result` at window level. Those
 * two host messages are handled here and never reach the bridge; they are
 * accepted only from a launcher whose port is bound (see
 * docs/policies/NIP-5D-CONFORMANCE.md, "Paja intent launcher").
 */

import { originRegistry, type NappletMessage, type NappletRevocation } from '@kehto/shell';

import { appendPajaMessageLog } from './browser-devtools.js';
import type { PajaBrowserState, PajaBrowserStateContext } from './browser-host.js';
import { markRuntimeTabReady } from './browser-intent-host.js';
import { replaceRevokedRuntimeTabFrame } from './browser-runtime-tabs.js';
import { ensureFreshNappletFrame } from './browser-target-frame.js';

/** Host effects Paja's NIP-5D integration needs from the browser host. */
export interface PajaNip5dHostEffects {
  setStatus(state: PajaBrowserState, status: PajaBrowserState['status']): void;
  /** Refresh devtools once a source reports ready, so they show its admitted interfaces. */
  renderDevtools(state: PajaBrowserState): void;
}

const LAUNCHER_MESSAGE_TYPES = new Set(['paja.intent.launcher.ready', 'paja.intent.launcher.result']);

function messageType(data: unknown): string | undefined {
  return typeof data === 'object' && data !== null && typeof (data as { type?: unknown }).type === 'string'
    ? (data as { type: string }).type
    : undefined;
}

function findLauncher(context: PajaBrowserStateContext, windowId: string) {
  return [...context.runtime.launcherFrames.values()].find((entry) => entry.windowId === windowId);
}

/**
 * Route one window-level message from a Paja-owned frame.
 *
 * @param state - Paja browser state.
 * @param context - Paja browser context.
 * @param event - The window-level message event.
 */
export function handlePajaWindowMessage(
  state: PajaBrowserState,
  context: PajaBrowserStateContext,
  event: MessageEvent,
): void {
  const source = event.source as Window | null;
  if (!source) return;
  const { runtime } = context;
  const sourceTab = state.tabs.find((tab) => tab.frame.contentWindow === source) ?? null;
  const launcher = runtime.launcherFrames.get(source);
  const isSingleFrameMessage = context.frame ? source === context.frame.contentWindow : false;
  if (!sourceTab && !isSingleFrameMessage && !launcher) return;

  const type = messageType(event.data);
  if (launcher && type && LAUNCHER_MESSAGE_TYPES.has(type)) {
    // Launcher host messages count only while its verified document holds the port.
    if (originRegistry.getWindowId(source) !== launcher.windowId || !originRegistry.getPort(launcher.windowId)) return;
    appendPajaMessageLog(state, 'napplet->shell', event.data, launcher.windowId);
    if (type === 'paja.intent.launcher.ready') {
      launcher.ready();
      return;
    }
    const data = event.data as { correlation?: unknown; result?: unknown };
    if (typeof data.correlation === 'string') launcher.result(data.correlation, data.result);
    return;
  }

  appendPajaMessageLog(state, 'napplet->shell', event.data, originRegistry.getWindowId(source) ?? undefined);
  context.bridge.handleMessage(event);
}

/**
 * Observe one NAP envelope received on a bound port.
 *
 * @param state - Paja browser state, or null before initialization.
 * @param context - Paja browser context, or null before initialization.
 * @param windowId - The napplet window.
 * @param message - The envelope.
 * @param effects - Host effects.
 */
export function observePajaNappletMessage(
  state: PajaBrowserState | null,
  context: PajaBrowserStateContext | null,
  windowId: string,
  message: NappletMessage,
  effects: PajaNip5dHostEffects,
): void {
  appendPajaMessageLog(state, 'napplet->shell', message, windowId);
  if (!state || !context || message.type !== 'shell.ready') return;
  // After the bridge has registered the session for this readiness message.
  queueMicrotask(() => context.adapter.mocked.onWindowReady(windowId));
  const launcher = findLauncher(context, windowId);
  if (launcher) {
    launcher.ready();
    return;
  }
  const tab = state.tabs.find((candidate) => candidate.windowId === windowId);
  if (tab) {
    const source = tab.frame.contentWindow;
    if (source) {
      markRuntimeTabReady(state, context, tab, source, originRegistry.getWindowId(source) ?? null, {
        setReadyStatus: (current) => effects.setStatus(current, 'ready'),
      });
    }
  } else if (windowId === context.runtime.currentWindowId) {
    context.runtime.readyWindowIds.add(windowId);
    effects.setStatus(state, 'ready');
  }
  effects.renderDevtools(state);
}

/**
 * Remove or replace the frame of a revoked napplet binding.
 *
 * @param state - Paja browser state, or null before initialization.
 * @param context - Paja browser context, or null before initialization.
 * @param revocation - What the shell revoked and why.
 * @param effects - Host effects.
 */
export function handlePajaNappletRevoked(
  state: PajaBrowserState | null,
  context: PajaBrowserStateContext | null,
  revocation: NappletRevocation,
  effects: PajaNip5dHostEffects,
): void {
  const { windowId, reason, detail } = revocation;
  appendPajaMessageLog(state, 'paja', { type: 'paja.napplet.revoked', reason, detail }, windowId);
  if (!state || !context) return;
  const { runtime } = context;
  for (const [source, launcher] of runtime.launcherFrames) {
    if (launcher.windowId !== windowId) continue;
    runtime.launcherFrames.delete(source);
    runtime.intentSenderIds.delete(windowId);
    runtime.explicitIntentHandlers.delete(windowId);
    launcher.frame.remove();
    return;
  }
  if (replaceRevokedRuntimeTabFrame(state, context, windowId)) return;
  if (context.frame && windowId === runtime.currentWindowId) {
    runtime.readyWindowIds.delete(windowId);
    runtime.currentWindowId = null;
    const fresh = ensureFreshNappletFrame(context.frame);
    if (fresh !== context.frame) {
      fresh.addEventListener('error', () => effects.setStatus(state, 'error'));
      context.frame = fresh;
    }
    effects.setStatus(state, 'error');
  }
}
