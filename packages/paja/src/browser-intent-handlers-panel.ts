/**
 * Paja sidebar panel for installed NAP-INTENT handlers (kehto/web#523).
 *
 * It lists every archetype that has an installed handler, the user's default
 * for it, and the other installed candidates. The user can make a handler the
 * default, forget a default, or uninstall a handler. Defaults stay per
 * archetype, as NAP-INTENT (napplet/naps master `377bf939`) requires, and only
 * the user changes them: napplets have no access to this panel.
 *
 * @module
 */

import type { InstalledNappletCatalog, InstalledNappletRecord } from './installed-napplet-catalog.js';

/** One installed handler row under an archetype. */
export interface PajaIntentHandlerRow {
  readonly id: string;
  readonly title: string;
  /** Conventions this handler advertises for the archetype, sorted. */
  readonly conventions: readonly string[];
  readonly isDefault: boolean;
}

/** One archetype group in the panel. */
export interface PajaIntentHandlerGroup {
  readonly archetype: string;
  /** The default handler's catalog ID, when it is installed. */
  readonly defaultId?: string;
  readonly handlers: readonly PajaIntentHandlerRow[];
}

/**
 * Group installed records by archetype for the panel. A saved default whose
 * handler is no longer installed is not shown as a default.
 *
 * @param records - Installed, verified records.
 * @param getDefault - The user's per-archetype default.
 * @returns Archetype groups sorted by name, default handler first.
 * @example
 * ```ts
 * const groups = pajaIntentHandlerGroups(catalog.installed(), (archetype) => defaults.get(archetype));
 * ```
 */
export function pajaIntentHandlerGroups(
  records: readonly InstalledNappletRecord[],
  getDefault: (archetype: string) => string | undefined,
): PajaIntentHandlerGroup[] {
  const byArchetype = new Map<string, Map<string, { record: InstalledNappletRecord; conventions: Set<string> }>>();
  for (const record of records) {
    for (const contract of record.archetypes) {
      const handlers = byArchetype.get(contract.slug) ?? new Map();
      byArchetype.set(contract.slug, handlers);
      const entry = handlers.get(record.id) ?? { record, conventions: new Set<string>() };
      entry.conventions.add(contract.convention);
      handlers.set(record.id, entry);
    }
  }
  return [...byArchetype.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([archetype, handlers]) => {
      const saved = getDefault(archetype);
      const defaultId = saved !== undefined && handlers.has(saved) ? saved : undefined;
      const rows = [...handlers.values()].map(({ record, conventions }) => ({
        id: record.id,
        title: record.title ?? (record.dTag || record.id),
        conventions: [...conventions].sort(),
        isDefault: record.id === defaultId,
      })).sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.title.localeCompare(b.title));
      return { archetype, ...(defaultId === undefined ? {} : { defaultId }), handlers: rows };
    });
}

/** Host hooks for {@link installPajaIntentHandlersPanel}. */
export interface PajaIntentHandlersPanelHost {
  readonly catalog: InstalledNappletCatalog;
  getDefault(archetype: string): string | undefined;
  /** Save or forget (`undefined`) the user's default, persist it, and emit `intent.changed`. */
  setDefault(archetype: string, id: string | undefined): void;
}

/** Live panel controls. */
export interface PajaIntentHandlersPanel {
  /** Re-render after a default changed somewhere else, such as the chooser. */
  refresh(): void;
  dispose(): void;
}

/**
 * Render the handlers panel into `#paja-intent-handlers` and keep it current.
 *
 * @param host - Installed catalog and default-handler policy.
 * @param document - Host document.
 * @returns Panel controls, or `null` when the mount is missing.
 * @example
 * ```ts
 * const panel = installPajaIntentHandlersPanel({ catalog, getDefault, setDefault });
 * ```
 */
export function installPajaIntentHandlersPanel(
  host: PajaIntentHandlersPanelHost,
  document: Pick<Document, 'getElementById' | 'createElement'> = window.document,
): PajaIntentHandlersPanel | null {
  const mount = document.getElementById('paja-intent-handlers');
  if (!mount) return null;
  const button = (label: string, name: string, action: () => void) => {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    element.setAttribute('aria-label', name);
    element.addEventListener('click', action);
    return element;
  };
  const uninstall = (id: string) => {
    for (const group of pajaIntentHandlerGroups(host.catalog.installed(), host.getDefault)) {
      if (group.defaultId === id) host.setDefault(group.archetype, undefined);
    }
    host.catalog.remove(id);
  };
  const render = () => {
    const groups = pajaIntentHandlerGroups(host.catalog.installed(), host.getDefault);
    if (groups.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = 'No installed app handles an intent yet. Open a napplet, or use Search for apps when an intent has no handler.';
      mount.replaceChildren(empty);
      return;
    }
    mount.replaceChildren(...groups.map((group) => {
      const section = document.createElement('section');
      section.className = 'intent-handler-group';
      section.setAttribute('aria-label', `${group.archetype} handlers`);
      const heading = document.createElement('h3');
      heading.textContent = group.archetype;
      section.append(heading);
      for (const handler of group.handlers) {
        const row = document.createElement('div');
        row.className = 'intent-handler-row';
        const label = document.createElement('div');
        label.textContent = handler.isDefault ? `${handler.title} (default)` : handler.title;
        const detail = document.createElement('small');
        detail.textContent = handler.conventions.join(', ');
        const actions = document.createElement('div');
        actions.className = 'intent-handler-actions';
        actions.append(handler.isDefault
          ? button('Forget default', `Forget ${handler.title} as default for ${group.archetype}`, () => { host.setDefault(group.archetype, undefined); render(); })
          : button('Make default', `Make ${handler.title} default for ${group.archetype}`, () => { host.setDefault(group.archetype, handler.id); render(); }));
        actions.append(button('Uninstall', `Uninstall ${handler.title}`, () => uninstall(handler.id)));
        row.append(label, detail, actions);
        section.append(row);
      }
      return section;
    }));
  };
  const stop = host.catalog.onChanged(() => render());
  render();
  return { refresh: render, dispose: () => { stop(); mount.replaceChildren(); } };
}
