/**
 * theme-service.ts — NIP-5D theme NAP reference service.
 *
 * Handles the single napplet->shell request type from @napplet/nap/theme:
 *   - `theme.get`         -> `theme.get.result { theme }` (current theme)
 *
 * Exposes a host-facing `publishTheme(theme)` handle that replaces the
 * service's internal current theme, then sends exactly one `theme.changed`
 * delivery path. A host-provided `onBroadcast` owns delivery when supplied;
 * otherwise the registered runtime sends to its eligible napplets.
 *
 * The default theme values are centralized here and mirrored in the runtime's
 * fallback path (`packages/runtime/src/runtime.ts`) — runtime does NOT import
 * from @kehto/services because services depends on runtime (one-way only).
 *
 * Host apps replace this via `runtime.registerService('theme', realHandler)`
 * when real CSS injection / storage / dark-mode logic is needed.
 *
 * @example
 * ```ts
 * import { createThemeService } from '@kehto/services';
 *
 * const theme = createThemeService({
 *   onBroadcast: (envelope) => broadcastToAllNapplets(envelope),
 * });
 * runtime.registerService('theme', theme.handler);
 *
 * // Later, when the user flips dark/light mode:
 * theme.publishTheme(newTheme);
 * ```
 */

import type { NappletMessage } from '@napplet/core';
// DRIFT-CORE-06 — Phase 11-deviation: ServiceDescriptor dropped from
// @napplet/core v0.2.0+ (napplet phase-81). Re-exported from
// @kehto/runtime (canonical home after Phase 24 DRIFT-01).
import type { ServiceDescriptor, ServiceHandler, ServiceRuntimeContext } from '@kehto/runtime';
import type {
  Theme,
  ThemeChangedMessage,
  ThemeGetResultMessage,
} from '@napplet/nap/theme/types';

/** Theme service version — follows semver. */
const THEME_SERVICE_VERSION = '1.0.0';

/**
 * Canonical default theme values.
 *
 * Must stay synchronized with the runtime fallback constant at
 * `packages/runtime/src/runtime.ts` (THEME_FALLBACK_DEFAULT). The runtime
 * keeps a local copy instead of importing from @kehto/services to avoid a
 * runtime->services dependency (services depends on runtime; one-way).
 */
const DEFAULT_THEME: Theme = {
  colors: {
    background: '#0a0a0a',
    text: '#e0e0e0',
    primary: '#7aa2f7',
  },
  // fonts, background, title intentionally undefined — all optional per
  // @napplet/nap/theme Theme interface.
};

function isCompleteTheme(theme: Theme | undefined): theme is Theme {
  const colors = theme?.colors;
  return typeof colors?.background === 'string'
    && typeof colors.text === 'string'
    && typeof colors.primary === 'string';
}

function normalizeTheme(theme: Theme | undefined): Theme {
  return isCompleteTheme(theme) ? theme : DEFAULT_THEME;
}

/**
 * Configuration for `createThemeService`.
 *
 * @example
 * ```ts
 * const theme = createThemeService({
 *   initialTheme: { colors: { background: '#fff', text: '#000', primary: '#00f' } },
 *   onBroadcast: (envelope) => shellBridge.broadcastToAll(envelope),
 * });
 * ```
 */
export interface ThemeServiceOptions {
  /**
   * Override the default theme payload. If omitted, the service starts with
   * the canonical defaults (`#0a0a0a / #e0e0e0 / #7aa2f7`).
   */
  initialTheme?: Theme;

  /**
   * Called synchronously from `publishTheme(theme)` with a `theme.changed`
   * envelope. When supplied, it is the sole delivery owner, so shell adapters
   * can apply their live-session and ACL checks without duplicate runtime
   * fan-out.
   *
   * Keep this callback shape framework-agnostic — the service does NOT
   * import any shell / browser APIs.
   */
  onBroadcast?: (envelope: ThemeChangedMessage) => void;
}

/**
 * A theme service bundle — the ServiceHandler that handles `theme.*`
 * envelopes, the host-facing `publishTheme(theme)` handle for theme-change
 * broadcasts, and a `getCurrentTheme()` accessor for host-side reads.
 */
export interface ThemeService {
  /** Register this with the runtime via `runtime.registerService('theme', handler)`. */
  handler: ServiceHandler;

  /**
   * Publish a theme-change to the shell adapter. Updates the service's
   * internal current theme, routes one `theme.changed` envelope through the
   * configured delivery owner, and returns the envelope.
   *
   * @param theme - The new theme payload
   * @returns A `theme.changed` envelope (same one passed to onBroadcast)
   */
  publishTheme: (theme: Theme) => ThemeChangedMessage;

  /** Return the current theme. Equivalent to the payload a napplet's `theme.get` would receive. */
  getCurrentTheme: () => Theme;
}

/**
 * Create a theme service that handles the NIP-5D `theme.*` NAP.
 *
 * Answers `theme.get` with the current theme (default or
 * `options.initialTheme`). Exposes `publishTheme(theme)` for the host app to
 * broadcast theme changes to every registered napplet — the shell adapter
 * (Plan 13-02) wires `onBroadcast` to `runtime.sendToNapplet` fan-out.
 *
 * @param options - Optional service configuration (see ThemeServiceOptions)
 * @returns A ThemeService bundle ready for `runtime.registerService('theme', service.handler)`
 *
 * @example
 * ```ts
 * import { createThemeService } from '@kehto/services';
 *
 * const theme = createThemeService();
 * runtime.registerService('theme', theme.handler);
 * theme.publishTheme({ colors: { background: '#fff', text: '#000', primary: '#00f' } });
 * ```
 */
export function createThemeService(options: ThemeServiceOptions = {}): ThemeService {
  let currentTheme: Theme = normalizeTheme(options.initialTheme);
  let runtime: ServiceRuntimeContext | undefined;

  const descriptor: ServiceDescriptor = {
    name: 'theme',
    version: THEME_SERVICE_VERSION,
    description: 'NIP-5D theme NAP reference handler',
  };

  const handler: ServiceHandler = {
    descriptor,

    onRegistered(context): void { runtime = context; },
    onUnregistered(): void { runtime = undefined; },

    handleMessage(
      _windowId: string,
      message: NappletMessage,
      send: (msg: NappletMessage) => void,
    ): void {
      const id = (message as NappletMessage & { id?: string }).id ?? '';

      if (message.type === 'theme.get') {
        const reply = (): void => send({ type: 'theme.get.result', id, theme: currentTheme } as ThemeGetResultMessage as NappletMessage);
        if (!runtime?.authorizeOperation) { reply(); return; }
        void runtime.authorizeOperation(_windowId, 'theme.get', [{ category: 'interface', domain: 'theme', operation: 'access', scope: { kind: 'exact', value: 'theme' } }], async (signal) => {
          if (signal.aborted) throw new Error('user-denied');
          reply();
        });
        return;
      }

      return;
    },

    // Theme service has no per-window state to clean up.
    onWindowDestroyed(_windowId: string): void {
      /* no-op */
    },
  };

  function publishTheme(theme: Theme): ThemeChangedMessage {
    currentTheme = normalizeTheme(theme);
    const envelope: ThemeChangedMessage = { type: 'theme.changed', theme: currentTheme };
    if (options.onBroadcast) {
      options.onBroadcast(envelope);
      return envelope;
    }
    for (const windowId of runtime?.listWindowIds() ?? []) runtime?.sendToEligibleNapplet(windowId, envelope as NappletMessage);
    return envelope;
  }

  function getCurrentTheme(): Theme {
    return currentTheme;
  }

  return { handler, publishTheme, getCurrentTheme };
}
