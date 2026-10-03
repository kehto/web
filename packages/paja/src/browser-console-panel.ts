/** Storage key holding the console visibility for one browser origin. */
export const PAJA_CONSOLE_PANEL_STORAGE_KEY = 'kehto:paja:console:v1';
/** Id of the console column controlled by the toggle. */
export const PAJA_CONSOLE_PANEL_ID = 'paja-console';
/** Id of the host-page console toggle button. */
export const PAJA_CONSOLE_TOGGLE_ID = 'paja-console-toggle';
/** Accessible name while the console is expanded. */
export const PAJA_CONSOLE_COLLAPSE_LABEL = 'Collapse the Paja development console';
/** Accessible name while the console is collapsed. */
export const PAJA_CONSOLE_EXPAND_LABEL = 'Expand the Paja development console';

/**
 * Install the host-page console toggle without touching the target iframe.
 * Storage is best-effort; missing or invalid preferences start expanded.
 *
 * @returns Cleanup function that detaches the click listener.
 * @example
 * ```ts
 * const disposeConsolePanel = installPajaConsolePanel();
 * window.addEventListener('pagehide', disposeConsolePanel, { once: true });
 * ```
 */
export function installPajaConsolePanel(): () => void {
  const root = document.documentElement;
  const button = document.getElementById(PAJA_CONSOLE_TOGGLE_ID);
  let collapsed = false;
  try {
    collapsed = localStorage.getItem(PAJA_CONSOLE_PANEL_STORAGE_KEY) === 'collapsed';
  } catch {
    // Storage can be unavailable; keep the console usable in-session.
  }

  const apply = (): void => {
    root.dataset.pajaConsole = collapsed ? 'collapsed' : 'expanded';
    const label = collapsed ? PAJA_CONSOLE_EXPAND_LABEL : PAJA_CONSOLE_COLLAPSE_LABEL;
    button?.setAttribute('aria-expanded', String(!collapsed));
    button?.setAttribute('aria-label', label);
    button?.setAttribute('title', label);
  };
  const toggle = (): void => {
    collapsed = !collapsed;
    apply();
    try {
      localStorage.setItem(PAJA_CONSOLE_PANEL_STORAGE_KEY, root.dataset.pajaConsole!);
    } catch {
      // Persistence must not prevent collapsing or restoring the console.
    }
  };

  apply();
  button?.addEventListener('click', toggle);
  return () => button?.removeEventListener('click', toggle);
}
