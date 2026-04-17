/**
 * keys-service.ts — NIP-5D keys NUB reference service (stub-level).
 *
 * Handles the 3 napplet -> shell request types from @napplet/nub-keys:
 *   - keys.forward          -> invokes options.onForward (hotkey passthrough, fire-and-forget)
 *   - keys.registerAction   -> echoes { actionId, binding: action.defaultKey? } as .result
 *   - keys.unregisterAction -> fire-and-forget (no envelope)
 *
 * Stub-level: no real keyboard listener, no binding persistence. Host apps
 * wire a real backend via runtime.registerService('keys', realHandler).
 *
 * Field-name translation: @napplet/nub-keys uses the compact
 * { ctrl, alt, shift, meta } form on the wire; the shell's HotkeyHooks
 * (packages/shell/src/types.ts) expects the DOM-compatible
 * { ctrlKey, altKey, shiftKey, metaKey } form. This service performs the
 * translation so callers of `onForward` see the DOM shape.
 *
 * Shell -> napplet push envelopes (`keys.bindings`, `keys.action`) are
 * NOT emitted by this service — they are the shell-side keys forwarder's
 * responsibility (DRIFT-SHELL-06, tracked under Plan 12-11 / future phase).
 */

import type { NappletMessage } from '@napplet/core';
import type { ServiceDescriptor, ServiceHandler } from '@kehto/runtime';
import type {
  KeysForwardMessage,
  KeysRegisterActionMessage,
  KeysRegisterActionResultMessage,
} from '@napplet/nub-keys';

/** Keys service version — follows semver. */
const KEYS_SERVICE_VERSION = '1.0.0';

/**
 * Options for creating a keys service via createKeysService().
 *
 * @example
 * ```ts
 * const keys = createKeysService({
 *   onForward: (event) => {
 *     // event has DOM-compatible field names: ctrlKey, altKey, etc.
 *     hotkeyDispatcher.dispatch(event);
 *   },
 * });
 * ```
 */
export interface KeysServiceOptions {
  /**
   * Called on keys.forward. Receives the DOM-style field names
   * (ctrlKey/altKey/shiftKey/metaKey) to match the shell's HotkeyHooks
   * contract. The service translates from the wire shape
   * ({ ctrl, alt, shift, meta }) before invoking this callback.
   */
  onForward?: (event: {
    key: string;
    code: string;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    metaKey: boolean;
  }) => void;
}

/**
 * Create a keys service handler.
 *
 * The service is stub-level: it dispatches the 3 napplet -> shell keys
 * request types from @napplet/nub-keys, responds with spec-correct
 * envelopes, and defers real keyboard behavior to an optional
 * onForward callback. No binding persistence, no real keyboard listener.
 *
 * @param options - Optional configuration (onForward callback)
 * @returns A ServiceHandler to register with the runtime
 *
 * @example
 * ```ts
 * import { createKeysService } from '@kehto/services';
 *
 * const keys = createKeysService({
 *   onForward: (event) => shellHotkeyDispatcher.execute(event),
 * });
 *
 * runtime.registerService('keys', keys);
 * ```
 */
export function createKeysService(options: KeysServiceOptions = {}): ServiceHandler {
  const descriptor: ServiceDescriptor = {
    name: 'keys',
    version: KEYS_SERVICE_VERSION,
    description: 'NIP-5D keys NUB reference handler (stub)',
  };

  return {
    descriptor,

    handleMessage(_windowId: string, message: NappletMessage, send: (msg: NappletMessage) => void): void {
      switch (message.type) {
        case 'keys.forward': {
          const m = message as KeysForwardMessage;
          options.onForward?.({
            key: m.key,
            code: m.code,
            ctrlKey: m.ctrl,
            altKey: m.alt,
            shiftKey: m.shift,
            metaKey: m.meta,
          });
          return;
        }

        case 'keys.registerAction': {
          const m = message as KeysRegisterActionMessage;
          const result: KeysRegisterActionResultMessage = {
            type: 'keys.registerAction.result',
            id: m.id,
            actionId: m.action.id,
            ...(m.action.defaultKey ? { binding: m.action.defaultKey } : {}),
          };
          send(result as NappletMessage);
          return;
        }

        case 'keys.unregisterAction': {
          // fire-and-forget — no envelope per @napplet/nub-keys spec
          return;
        }

        default: {
          const id = (message as NappletMessage & { id?: string }).id ?? '';
          send({
            type: `${message.type}.error`,
            id,
            error: `Unknown keys method: ${message.type}`,
          } as NappletMessage);
          return;
        }
      }
    },

    onWindowDestroyed(_windowId: string): void {
      /* no per-window state */
    },
  };
}
