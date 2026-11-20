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

function renderFields(container: HTMLElement, store: PajaSettingsStore): void {
  const groups = new Map<string, HTMLFieldSetElement>();
  for (const definition of PAJA_SETTING_DEFINITIONS) {
    let group = groups.get(definition.group);
    if (!group) {
      group = document.createElement('fieldset');
      group.className = 'config-group';
      const legend = document.createElement('legend');
      legend.textContent = definition.group;
      group.append(legend);
      groups.set(definition.group, group);
    }
    group.append(renderField(definition, store));
  }
  container.replaceChildren(...groups.values());
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
 * Wire the header Settings button and dialog. Fields are generated from the
 * registry so the panel and the registry cannot drift.
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
  if (!open || !dialog || !fields || !status || !save || !saveReload || !resetAll || !cancel) return () => {};

  const show = (): void => {
    renderFields(fields, store);
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
    if (!result.ok) {
      fields.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    if (reload) window.location.reload();
  };
  const listeners: [HTMLElement, () => void][] = [
    [open, show],
    [save, () => apply(false)],
    [saveReload, () => apply(true)],
    [resetAll, () => { status.textContent = store.resetAll().message; renderFields(fields, store); }],
    [cancel, () => dialog.close()],
  ];
  for (const [element, listener] of listeners) element.addEventListener('click', listener);
  return () => { for (const [element, listener] of listeners) element.removeEventListener('click', listener); };
}
