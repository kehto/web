import type {
  ConfigServiceOptions,
  ConfigSettingsContext,
} from '@kehto/services';
import type { ConfigValues } from '@napplet/nap/config/types';
import type { PajaIdentityProvider } from './browser-adapter.js';

const STORAGE_PREFIX = 'kehto:paja:config:';
const STORAGE_PROBE_KEY = `${STORAGE_PREFIX}probe`;

interface ConfigFieldBinding {
  readonly path: readonly string[];
  read(): unknown;
}

/** Browser dependencies for Paja's shell-owned NAP-CONFIG backend. */
export interface PajaConfigControllerOptions {
  /** Resolve a trusted napplet identity from the host-owned window registry. */
  readonly getIdentity: PajaIdentityProvider;
  /** DOM owner for the shell settings dialog. */
  readonly document?: Document;
  /** Durable browser storage. Defaults to the host page's localStorage. */
  readonly storage?: Storage;
  /** Host-configured seed used only when this identity has no stored values. */
  readonly getInitialValues?: (windowId: string) => ConfigValues;
}

/** Live host controller and service bridge for NAP-CONFIG. */
export interface PajaConfigController {
  /** Hooks supplied to the generic config service. */
  readonly serviceOptions: ConfigServiceOptions;
  /** Close the active settings surface and release listeners. */
  dispose(): void;
}

/**
 * Create Paja's real browser NAP-CONFIG backend.
 *
 * Values are stored under the host-resolved `(dTag, aggregateHash)` identity;
 * no napplet-supplied key participates in scope selection. The controller is
 * unavailable unless both durable storage and the shell-owned settings dialog
 * are usable, so capability discovery cannot advertise a partial backend.
 *
 * @param options - Trusted identity, DOM, and storage dependencies.
 * @returns A controller when the full host boundary is available, otherwise null.
 */
export function createPajaConfigController(
  options: PajaConfigControllerOptions,
): PajaConfigController | null {
  const document = options.document ?? globalThis.document;
  const storage = options.storage ?? readGlobalStorage();
  const dialog = document?.getElementById('paja-config-dialog') as HTMLDialogElement | null;
  const title = document?.getElementById('paja-config-title');
  const description = document?.getElementById('paja-config-description');
  const fields = document?.getElementById('paja-config-fields');
  const error = document?.getElementById('paja-config-error');
  const cancel = document?.getElementById('paja-config-cancel') as HTMLButtonElement | null;
  const save = document?.getElementById('paja-config-save') as HTMLButtonElement | null;
  if (!storage || !dialog || !title || !description || !fields || !error || !cancel || !save) return null;
  if (!storageIsWritable(storage)) return null;

  let active: { windowId: string; context: ConfigSettingsContext } | null = null;
  let bindings: ConfigFieldBinding[] = [];
  let disposed = false;

  const settle = (): void => {
    if (!active) return;
    active = null;
    bindings = [];
    fields.replaceChildren();
    error.textContent = '';
  };

  const close = (): void => {
    settle();
    if (dialog.open) dialog.close();
  };

  const onCancel = (): void => close();
  const onDialogExit = (): void => settle();
  const onSave = (): void => {
    if (!active || disposed) return;
    try {
      const values: ConfigValues = {};
      for (const binding of bindings) {
        const value = binding.read();
        if (value !== undefined) assignPath(values, binding.path, value);
      }
      active.context.commit(values);
      close();
    } catch (cause) {
      error.textContent = cause instanceof Error ? cause.message : 'Unable to save configuration';
    }
  };
  cancel.addEventListener('click', onCancel);
  save.addEventListener('click', onSave);
  dialog.addEventListener('cancel', onDialogExit);
  dialog.addEventListener('close', onDialogExit);

  const getValues = (windowId: string): ConfigValues => {
    try {
      const raw = storage.getItem(storageKey(options.getIdentity(windowId)));
      if (!raw) return cloneValues(options.getInitialValues?.(windowId) ?? {});
      const value = JSON.parse(raw) as unknown;
      return isRecord(value) ? value : {};
    } catch {
      return {};
    }
  };

  const saveValues = (windowId: string, values: ConfigValues): void => {
    storage.setItem(storageKey(options.getIdentity(windowId)), JSON.stringify(values));
  };

  const openSettings = (
    windowId: string,
    section: string | undefined,
    context: ConfigSettingsContext,
  ): void => {
    if (disposed) return;
    close();
    active = { windowId, context };
    bindings = [];
    fields.replaceChildren();
    error.textContent = '';
    const identity = options.getIdentity(windowId);
    title.textContent = context.schema.title ?? `Settings for ${identity.dTag}`;
    description.textContent = context.schema.description ?? `${identity.dTag} · ${identity.aggregateHash}`;
    renderObjectFields(
      document,
      fields,
      context.schema as Record<string, unknown>,
      context.values,
      [],
      bindings,
      section,
    );
    if (bindings.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'config-empty';
      empty.textContent = section ? `No editable settings in section “${section}”.` : 'No editable settings.';
      fields.append(empty);
    }
    dialog.showModal();
  };

  return {
    serviceOptions: {
      getValues,
      saveValues,
      openSettings,
      onWindowDestroyed: (windowId) => {
        if (active?.windowId === windowId) close();
      },
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      cancel.removeEventListener('click', onCancel);
      save.removeEventListener('click', onSave);
      dialog.removeEventListener('cancel', onDialogExit);
      dialog.removeEventListener('close', onDialogExit);
      close();
    },
  };
}

function cloneValues(values: ConfigValues): ConfigValues {
  try {
    return structuredClone(values);
  } catch {
    return {};
  }
}

function renderObjectFields(
  document: Document,
  parent: HTMLElement,
  schema: Record<string, unknown>,
  values: ConfigValues,
  path: readonly string[],
  bindings: ConfigFieldBinding[],
  selectedSection?: string,
): void {
  const properties = isRecord(schema.properties) ? schema.properties : {};
  const required = new Set(Array.isArray(schema.required) ? schema.required.filter((key): key is string => typeof key === 'string') : []);
  const ordered = Object.entries(properties)
    .filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]))
    .filter(([, child]) => !selectedSection || child['x-napplet-section'] === selectedSection || child.type === 'object')
    .sort(([leftKey, left], [rightKey, right]) => compareSchemaFields(leftKey, left, rightKey, right));

  for (const [key, rawChild] of ordered) {
    const child = rawChild;
    const childPath = [...path, key];
    const current = readPath(values, childPath);
    if (child.type === 'object') {
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'config-group';
      const legend = document.createElement('legend');
      legend.textContent = labelFor(key, child);
      fieldset.append(legend);
      renderObjectFields(document, fieldset, child, values, childPath, bindings, selectedSection);
      if (fieldset.children.length > 1) parent.append(fieldset);
      continue;
    }

    const row = document.createElement('label');
    row.className = 'config-field';
    if (typeof child['x-napplet-section'] === 'string') row.dataset.section = child['x-napplet-section'];
    const label = document.createElement('span');
    label.className = 'config-field-label';
    label.textContent = labelFor(key, child);
    row.append(label);
    const binding = createFieldBinding(document, childPath, child, current, required.has(key));
    row.append(binding.element);
    const help = descriptionFor(child);
    if (help) {
      const copy = document.createElement('small');
      copy.textContent = help;
      row.append(copy);
    }
    parent.append(row);
    bindings.push({ path: childPath, read: binding.read });
  }
}

function createFieldBinding(
  document: Document,
  path: readonly string[],
  schema: Record<string, unknown>,
  current: unknown,
  required: boolean,
): { element: HTMLElement; read(): unknown } {
  if (Array.isArray(schema.enum)) {
    const select = document.createElement('select');
    select.required = required;
    if (!required) {
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = 'Not set';
      select.append(empty);
    }
    for (const [index, value] of schema.enum.entries()) {
      const option = document.createElement('option');
      option.value = JSON.stringify(value);
      option.textContent = Array.isArray(schema.enumDescriptions) && typeof schema.enumDescriptions[index] === 'string'
        ? `${String(value)} — ${schema.enumDescriptions[index]}`
        : String(value);
      option.selected = Object.is(value, current);
      select.append(option);
    }
    return { element: select, read: () => select.value === '' ? undefined : JSON.parse(select.value) as unknown };
  }
  if (schema.type === 'boolean') {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = current === true;
    return { element: input, read: () => input.checked };
  }
  if (schema.type === 'array') {
    const textarea = document.createElement('textarea');
    textarea.rows = 3;
    textarea.value = JSON.stringify(Array.isArray(current) ? current : [], null, 2);
    textarea.required = required;
    return {
      element: textarea,
      read: () => {
        const parsed = JSON.parse(textarea.value) as unknown;
        if (!Array.isArray(parsed)) throw new Error(`${path.join('.')} must be a JSON array`);
        return parsed;
      },
    };
  }
  const input = document.createElement('input');
  input.required = required;
  if (schema.type === 'number' || schema.type === 'integer') {
    input.type = 'number';
    input.step = schema.type === 'integer' ? '1' : 'any';
    if (typeof schema.minimum === 'number') input.min = String(schema.minimum);
    if (typeof schema.maximum === 'number') input.max = String(schema.maximum);
    input.value = typeof current === 'number' ? String(current) : '';
    return { element: input, read: () => input.value === '' ? undefined : Number(input.value) };
  }
  input.type = schema['x-napplet-secret'] === true ? 'password' : formatInputType(schema.format);
  input.value = typeof current === 'string' ? current : '';
  if (typeof schema.minLength === 'number') input.minLength = schema.minLength;
  if (typeof schema.maxLength === 'number') input.maxLength = schema.maxLength;
  return { element: input, read: () => input.value === '' && !required ? undefined : input.value };
}

function compareSchemaFields(
  leftKey: string,
  left: Record<string, unknown>,
  rightKey: string,
  right: Record<string, unknown>,
): number {
  const leftOrder = typeof left['x-napplet-order'] === 'number' ? left['x-napplet-order'] : Number.POSITIVE_INFINITY;
  const rightOrder = typeof right['x-napplet-order'] === 'number' ? right['x-napplet-order'] : Number.POSITIVE_INFINITY;
  return leftOrder - rightOrder || leftKey.localeCompare(rightKey);
}

function assignPath(target: ConfigValues, path: readonly string[], value: unknown): void {
  let cursor = target;
  for (const segment of path.slice(0, -1)) {
    const child = cursor[segment];
    if (!isRecord(child)) cursor[segment] = {};
    cursor = cursor[segment] as ConfigValues;
  }
  const final = path.at(-1);
  if (final) cursor[final] = value;
}

function readPath(values: ConfigValues, path: readonly string[]): unknown {
  let cursor: unknown = values;
  for (const segment of path) {
    if (!isRecord(cursor)) return undefined;
    cursor = cursor[segment];
  }
  return cursor;
}

function labelFor(key: string, schema: Record<string, unknown>): string {
  return typeof schema.title === 'string' ? schema.title : key;
}

function descriptionFor(schema: Record<string, unknown>): string | null {
  if (typeof schema.deprecationMessage === 'string') return schema.deprecationMessage;
  if (typeof schema.markdownDescription === 'string') return schema.markdownDescription;
  return typeof schema.description === 'string' ? schema.description : null;
}

function formatInputType(format: unknown): string {
  if (format === 'email') return 'email';
  if (format === 'uri') return 'url';
  if (format === 'date') return 'date';
  if (format === 'date-time') return 'datetime-local';
  if (format === 'color') return 'color';
  return 'text';
}

function storageKey(identity: ReturnType<PajaIdentityProvider>): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(JSON.stringify([identity.dTag, identity.aggregateHash]))}`;
}

function storageIsWritable(storage: Storage): boolean {
  try {
    const prior = storage.getItem(STORAGE_PROBE_KEY);
    storage.setItem(STORAGE_PROBE_KEY, '1');
    if (prior === null) storage.removeItem(STORAGE_PROBE_KEY);
    else storage.setItem(STORAGE_PROBE_KEY, prior);
    return true;
  } catch {
    return false;
  }
}

function readGlobalStorage(): Storage | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
