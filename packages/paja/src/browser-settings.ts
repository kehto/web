import {
  PAJA_SETTING_DEFINITIONS,
  getPajaSettingDefault,
  normalizePajaSettings,
  setActivePajaSettings,
  validatePajaSettingValue,
  type PajaSettingDefinition,
  type PajaSettingKey,
  type PajaSettingValues,
} from './settings.js';

/** Host-origin storage key holding only the user's overrides, never defaults. */
export const PAJA_SETTINGS_STORAGE_KEY = 'kehto:paja:settings.v1';

const UNIT_LABELS: Record<PajaSettingDefinition['unit'], string> = {
  ms: 'ms', seconds: 's', bytes: 'bytes', count: '', chars: 'chars', iterations: 'iterations', ratio: '',
};

/** Outcome of a save attempt. */
export interface PajaSettingsSaveResult {
  /** Whether the overrides were applied. */
  readonly ok: boolean;
  /** Text for the status region. */
  readonly message: string;
  /** Per-key validation errors when `ok` is false. */
  readonly errors: Readonly<Record<string, string>>;
}

/** Persisted, host-owned Paja settings. Napplets cannot reach this store. */
export interface PajaSettingsStore {
  /** Value used when the user has no override: config-file seed, else built-in default. */
  baseline(key: PajaSettingKey): number;
  /** The user's current override for a key, if any. */
  override(key: PajaSettingKey): number | undefined;
  /** Current status text. */
  status(): string;
  /** Validate and apply a full draft; values equal to the baseline drop the override. */
  save(draft: Readonly<Record<string, unknown>>): PajaSettingsSaveResult;
  /** Remove every override. */
  resetAll(): PajaSettingsSaveResult;
}

/**
 * Create the browser settings store and activate its values for this page.
 * Corrupt or out-of-range stored entries are dropped; unavailable storage
 * keeps changes for this session only.
 *
 * @param options - Config-file seeds and a storage accessor.
 * @returns The store.
 * @example
 * const store = createPajaSettingsStore({ seeds: config.settings });
 * store.save({ 'relay.liveQueryWaitMs': 8000 });
 */
export function createPajaSettingsStore(options: {
  readonly seeds?: PajaSettingValues;
  readonly getStorage?: () => Storage;
} = {}): PajaSettingsStore {
  const getStorage = options.getStorage ?? (() => localStorage);
  const seeds = normalizePajaSettings(options.seeds, 'browser').values;
  let overrides: PajaSettingValues = {};
  let status = 'Using default settings.';
  try {
    const stored = getStorage().getItem(PAJA_SETTINGS_STORAGE_KEY);
    if (stored !== null) {
      const result = normalizePajaSettings(JSON.parse(stored), 'browser');
      overrides = result.values;
      status = result.rejected.length > 0
        ? `Restored saved settings; ignored ${String(result.rejected.length)} invalid or retired entr${result.rejected.length === 1 ? 'y' : 'ies'}.`
        : 'Restored saved settings.';
    }
  } catch {
    status = 'Saved settings could not be restored; defaults are in use. Storage may be unavailable.';
  }
  const activate = (): void => setActivePajaSettings({ ...seeds, ...overrides });
  activate();

  const baseline = (key: PajaSettingKey): number => seeds[key] ?? getPajaSettingDefault(key);
  const persist = (next: PajaSettingValues, saved: string): PajaSettingsSaveResult => {
    overrides = next;
    activate();
    try {
      const storage = getStorage();
      if (Object.keys(next).length > 0) storage.setItem(PAJA_SETTINGS_STORAGE_KEY, JSON.stringify(next));
      else storage.removeItem(PAJA_SETTINGS_STORAGE_KEY);
      status = saved;
    } catch {
      status = 'Applied for this session only; storage is unavailable, so settings will not persist.';
    }
    return { ok: true, message: status, errors: {} };
  };

  return {
    baseline,
    override: (key) => overrides[key],
    status: () => status,
    save(draft) {
      const errors: Record<string, string> = {};
      const next: Record<string, number> = {};
      for (const definition of PAJA_SETTING_DEFINITIONS) {
        if (definition.scope !== 'browser' || !(definition.key in draft)) continue;
        const value = draft[definition.key];
        const problem = validatePajaSettingValue(definition, value);
        if (problem) errors[definition.key] = problem;
        else if (value !== baseline(definition.key)) next[definition.key] = value as number;
      }
      const invalid = Object.keys(errors).length;
      if (invalid > 0) {
        return { ok: false, message: `Fix ${String(invalid)} invalid setting${invalid === 1 ? '' : 's'}; nothing was saved.`, errors };
      }
      return persist(next as PajaSettingValues, 'Settings saved for this host origin.');
    },
    resetAll: () => persist({}, 'All settings reset to defaults.'),
  };
}

function formatValue(definition: PajaSettingDefinition, value: number): string {
  const unit = UNIT_LABELS[definition.unit];
  return unit ? `${String(value)} ${unit}` : String(value);
}

function renderField(definition: PajaSettingDefinition, store: PajaSettingsStore): HTMLElement {
  const row = document.createElement('div');
  row.className = 'config-field settings-field';
  const id = `paja-setting-${definition.key.replace(/[^a-z0-9]/giu, '-')}`;
  const label = document.createElement('label');
  label.className = 'config-field-label';
  label.htmlFor = id;
  label.textContent = definition.label;
  const controls = document.createElement('div');
  controls.className = 'settings-controls';
  const input = document.createElement('input');
  input.type = 'number';
  input.id = id;
  input.dataset.settingKey = definition.key;
  input.min = String(definition.min);
  input.max = String(definition.max);
  input.step = definition.unit === 'ratio' ? 'any' : '1';
  const key = definition.key as PajaSettingKey;
  const server = definition.scope === 'server';
  input.value = String(server ? definition.defaultValue : store.override(key) ?? store.baseline(key));
  input.disabled = server;
  const hint = document.createElement('small');
  hint.id = `${id}-hint`;
  hint.textContent = server
    ? `Default ${formatValue(definition, definition.defaultValue)}. Set "${definition.key}" under "settings" in the Paja config file.`
    : `${definition.key} · default ${formatValue(definition, store.baseline(key))} · range ${String(definition.min)}–${String(definition.max)}`;
  input.setAttribute('aria-describedby', hint.id);
  controls.append(input);
  if (!server) {
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'Reset';
    reset.setAttribute('aria-label', `Reset ${definition.label}`);
    reset.addEventListener('click', () => {
      input.value = String(store.baseline(key));
      input.removeAttribute('aria-invalid');
    });
    controls.append(reset);
  }
  row.append(label, controls, hint);
  return row;
}

const TAB_KEYS: Readonly<Record<string, (index: number, count: number) => number>> = {
  ArrowDown: (index, count) => (index + 1) % count,
  ArrowRight: (index, count) => (index + 1) % count,
  ArrowUp: (index, count) => (index - 1 + count) % count,
  ArrowLeft: (index, count) => (index - 1 + count) % count,
  Home: () => 0,
  End: (_index, count) => count - 1,
};

function slug(group: string): string {
  return group.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');
}

function tabsOf(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
}

/** Show one group's panel; roving tabindex keeps a single tab stop in the list. */
function selectTab(container: HTMLElement, index: number, focus: boolean): void {
  tabsOf(container).forEach((tab, tabIndex) => {
    const selected = tabIndex === index;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    const panel = document.getElementById(tab.getAttribute('aria-controls')!);
    if (panel) panel.hidden = !selected;
    if (selected && focus) tab.focus();
  });
}

function selectedTab(container: HTMLElement): number {
  return Math.max(0, tabsOf(container).findIndex((tab) => tab.getAttribute('aria-selected') === 'true'));
}

function renderTabs(container: HTMLElement, store: PajaSettingsStore, selected: number): void {
  const tablist = document.createElement('div');
  tablist.className = 'settings-tablist';
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', 'Settings groups');
  tablist.setAttribute('aria-orientation', 'vertical');
  const panels = new Map<string, HTMLElement>();
  for (const definition of PAJA_SETTING_DEFINITIONS) {
    let panel = panels.get(definition.group);
    if (!panel) {
      const id = slug(definition.group);
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'settings-tab';
      tab.id = `paja-settings-tab-${id}`;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', `paja-settings-panel-${id}`);
      tab.textContent = definition.group;
      tablist.append(tab);
      panel = document.createElement('div');
      panel.className = 'settings-panel';
      panel.id = `paja-settings-panel-${id}`;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tab.id);
      panel.tabIndex = 0;
      panels.set(definition.group, panel);
    }
    panel.append(renderField(definition, store));
  }
  tablist.addEventListener('click', (event) => {
    const index = tabsOf(container).indexOf((event.target as Element).closest('[role="tab"]') as HTMLButtonElement);
    if (index >= 0) selectTab(container, index, true);
  });
  tablist.addEventListener('keydown', (event) => {
    const move = TAB_KEYS[event.key];
    if (!move) return;
    event.preventDefault();
    selectTab(container, move(selectedTab(container), panels.size), true);
  });
  container.replaceChildren(tablist, ...panels.values());
  selectTab(container, Math.min(selected, panels.size - 1), false);
}

/** Flag tabs holding invalid fields, then reveal and focus the first invalid field. */
function revealInvalid(container: HTMLElement): void {
  let first: HTMLInputElement | null = null;
  tabsOf(container).forEach((tab, index) => {
    const panel = document.getElementById(tab.getAttribute('aria-controls')!);
    const invalid = panel?.querySelector<HTMLInputElement>('[aria-invalid="true"]') ?? null;
    tab.querySelector('.settings-tab-flag')?.remove();
    if (!invalid) return;
    const flag = document.createElement('span');
    flag.className = 'settings-tab-flag';
    flag.textContent = ' · needs fixing';
    tab.append(flag);
    if (!first) { first = invalid; selectTab(container, index, false); }
  });
  (first as HTMLInputElement | null)?.focus();
}

function readDraft(container: HTMLElement): Record<string, unknown> {
  const draft: Record<string, unknown> = {};
  for (const input of Array.from(container.querySelectorAll<HTMLInputElement>('input[data-setting-key]:not(:disabled)'))) {
    const text = input.value.trim();
    draft[input.dataset.settingKey!] = text === '' ? Number.NaN : Number(text);
  }
  return draft;
}

/**
 * Wire the header Settings button and the tabbed dialog (one tab per settings
 * group). Fields are generated from the registry so the panel and the
 * registry cannot drift.
 *
 * @param store - Active settings store.
 * @returns A disposer; a no-op when the dialog markup is absent.
 * @example
 * const dispose = installPajaSettingsPanel(createPajaSettingsStore());
 */
export function installPajaSettingsPanel(store: PajaSettingsStore): () => void {
  const open = document.getElementById('paja-settings-open');
  const dialog = document.getElementById('paja-settings-dialog') as HTMLDialogElement | null;
  const fields = document.getElementById('paja-settings-fields');
  const status = document.getElementById('paja-settings-status');
  const save = document.getElementById('paja-settings-save');
  const saveReload = document.getElementById('paja-settings-save-reload');
  const resetAll = document.getElementById('paja-settings-reset-all');
  const cancel = document.getElementById('paja-settings-cancel');
  // Without the panel markup there are no listeners to remove.
  if (!open || !dialog || !fields || !status || !save || !saveReload || !resetAll || !cancel) return () => undefined;

  const show = (): void => {
    renderTabs(fields, store, selectedTab(fields));
    status.textContent = store.status();
    dialog.showModal();
  };
  const apply = (reload: boolean): void => {
    const result = store.save(readDraft(fields));
    for (const input of Array.from(fields.querySelectorAll<HTMLInputElement>('input[data-setting-key]'))) {
      const error = result.errors[input.dataset.settingKey!];
      if (error) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
      input.title = error ?? '';
    }
    status.textContent = result.message;
    revealInvalid(fields);
    if (!result.ok) return;
    if (reload) window.location.reload();
  };
  const listeners: [HTMLElement, () => void][] = [
    [open, show],
    [save, () => apply(false)],
    [saveReload, () => apply(true)],
    [resetAll, () => { status.textContent = store.resetAll().message; renderTabs(fields, store, selectedTab(fields)); }],
    [cancel, () => dialog.close()],
  ];
  for (const [element, listener] of listeners) element.addEventListener('click', listener);
  return () => { for (const [element, listener] of listeners) element.removeEventListener('click', listener); };
}
