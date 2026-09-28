/**
 * Collapsible Paja development console.
 *
 * The host page keeps its whole development surface in one left column. This
 * controller owns that column's visibility: expanded by default, collapsed to
 * the left by one directional toggle, restored by the same toggle, and
 * remembered per browser origin. The visible state lives on the document root
 * as a `data-paja-console` attribute so the host page collapses purely in CSS
 * and never has to touch, reload, or recreate the target iframe.
 */

/** Storage key holding the persisted console visibility for one browser origin. */
export const PAJA_CONSOLE_PANEL_STORAGE_KEY = 'kehto:paja:console:v1';

/** Id of the console column the toggle controls. */
export const PAJA_CONSOLE_PANEL_ID = 'paja-console';

/** Id of the host-page console toggle button. */
export const PAJA_CONSOLE_TOGGLE_ID = 'paja-console-toggle';

/** Document-root dataset key that drives the collapsed layout. */
export const PAJA_CONSOLE_PANEL_DATASET_KEY = 'pajaConsole';

/** Accessible name of the toggle while the console is expanded. */
export const PAJA_CONSOLE_COLLAPSE_LABEL = 'Collapse the Paja development console';

/** Accessible name of the toggle while the console is collapsed. */
export const PAJA_CONSOLE_EXPAND_LABEL = 'Expand the Paja development console';

/** Visibility of the Paja development console. */
export type PajaConsolePanelState = 'expanded' | 'collapsed';

/** Minimal element surface the console panel toggle needs. */
export interface PajaConsolePanelElement {
  /** Mutable data attributes; carries the collapsed layout on the document root. */
  readonly dataset: Record<string, string | undefined>;
  /** Update the toggle's accessible name and state. */
  setAttribute(name: string, value: string): void;
  /** Subscribe to the toggle press. */
  addEventListener(type: 'click', listener: () => void): void;
  /** Unsubscribe from the toggle press. */
  removeEventListener(type: 'click', listener: () => void): void;
}

/** Document surface the console panel controller needs. */
export interface PajaConsolePanelDocument {
  /** Element carrying the collapsed layout attribute. */
  readonly documentElement: PajaConsolePanelElement | null;
  /** Look up the host-page toggle button. */
  getElementById(id: string): PajaConsolePanelElement | null;
}

/** Options for creating the Paja console panel controller. */
export interface PajaConsolePanelOptions {
  /** Document that owns the toggle and root attribute; defaults to `document`. */
  readonly document?: PajaConsolePanelDocument | null;
  /** Element carrying the collapsed layout attribute; defaults to the document root. */
  readonly root?: PajaConsolePanelElement | null;
  /** Toggle button; defaults to `#paja-console-toggle` in the host page. */
  readonly button?: PajaConsolePanelElement | null;
  /** Preference storage; defaults to `localStorage`, and `null` disables persistence. */
  readonly storage?: Storage | null;
}

/** Host-owned console visibility controller for the Paja host page. */
export interface PajaConsolePanel {
  /** Current console visibility. */
  getState(): PajaConsolePanelState;
  /** Flip the console to the opposite visibility and persist the choice. */
  toggle(): PajaConsolePanelState;
  /** Detach the toggle listener. */
  dispose(): void;
}

/**
 * Read a persisted console visibility, defaulting to expanded.
 *
 * A missing, unreadable, or unrecognized value means the console is expanded,
 * so a fresh browser origin always starts with the full development surface.
 *
 * @param value - Raw stored preference.
 * @returns Console visibility to apply.
 */
export function parsePajaConsolePanelState(value: string | null | undefined): PajaConsolePanelState {
  return value === 'collapsed' ? 'collapsed' : 'expanded';
}

/**
 * Create the Paja host-page console visibility controller.
 *
 * Applying a state sets the `data-paja-console` attribute that the host page
 * layout keys off, keeps the toggle's accessible name in sync with the action
 * it performs, and persists the choice. Collapsing is presentation-only: it
 * never navigates the target iframe.
 *
 * @param options - Injectable document, elements, and preference storage.
 * @returns Controller that collapses, restores, and remembers the console.
 * @example
 * ```ts
 * const consolePanel = createPajaConsolePanel();
 * consolePanel.toggle(); // collapse to the left
 * consolePanel.getState(); // 'collapsed'
 * ```
 */
export function createPajaConsolePanel(options: PajaConsolePanelOptions = {}): PajaConsolePanel {
  const documentRef = options.document ?? readPajaDocument();
  const root = options.root ?? documentRef?.documentElement ?? null;
  const button = options.button ?? documentRef?.getElementById(PAJA_CONSOLE_TOGGLE_ID) ?? null;
  const storage = options.storage === undefined ? readPajaConsolePanelStorage() : options.storage;
  let state = parsePajaConsolePanelState(readPajaConsolePanelPreference(storage));

  const apply = (next: PajaConsolePanelState): void => {
    state = next;
    if (root) root.dataset[PAJA_CONSOLE_PANEL_DATASET_KEY] = next;
    if (button) {
      const label = next === 'collapsed' ? PAJA_CONSOLE_EXPAND_LABEL : PAJA_CONSOLE_COLLAPSE_LABEL;
      button.setAttribute('aria-expanded', next === 'expanded' ? 'true' : 'false');
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
    }
  };

  const toggle = (): PajaConsolePanelState => {
    apply(state === 'collapsed' ? 'expanded' : 'collapsed');
    writePajaConsolePanelPreference(storage, state);
    return state;
  };

  apply(state);
  button?.addEventListener('click', toggle);

  return {
    getState: () => state,
    toggle,
    dispose() {
      button?.removeEventListener('click', toggle);
    },
  };
}

function readPajaDocument(): PajaConsolePanelDocument | null {
  return typeof document === 'undefined' ? null : document;
}

function readPajaConsolePanelStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function readPajaConsolePanelPreference(storage: Storage | null): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(PAJA_CONSOLE_PANEL_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writePajaConsolePanelPreference(storage: Storage | null, state: PajaConsolePanelState): void {
  if (!storage) return;
  try {
    storage.setItem(PAJA_CONSOLE_PANEL_STORAGE_KEY, state);
  } catch {
    // Persistence is best-effort; the console must still collapse in-session.
  }
}
