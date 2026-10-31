/**
 * Browser half of Paja's experimental `x-` NAP extensions: import each served
 * module, build its `ShellExtension` with a settings context, validate it with
 * the shell's extension policy, and install it on the Paja ShellAdapter.
 */

import {
  defineShellExtension,
  getShellDomainState,
  resolveShellExtensions,
  type ShellAdapter,
  type ShellDomainState,
  type ShellExtension,
} from '@kehto/shell';

import type { PajaExtensionModule, PajaExtensionSetting, PajaHostExtensionConfig } from './extensions.js';
import type { PajaHostConfig } from './options.js';

/** One extension loaded into the Paja host page. */
export interface PajaLoadedExtension {
  /** Validated shell extension. */
  readonly extension: ShellExtension;
  /** Settings the module asked the sidebar to render. */
  readonly settings: readonly PajaExtensionSetting[];
  /** Module file name. */
  readonly name: string;
  /** Live enabled flag (interface toggle). */
  enabled: boolean;
  /** Current setting values. */
  readonly values: Record<string, string>;
}

/** Diagnostic reported when a module cannot load or violates extension policy. */
export interface PajaExtensionLoadFailure {
  readonly name: string;
  readonly reason: string;
}

const STORAGE_PREFIX = 'kehto.paja.extension.';

function readStoredSettings(name: string): Record<string, string> {
  try {
    const raw = globalThis.localStorage?.getItem(`${STORAGE_PREFIX}${name}`);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  } catch {
    return {};
  }
}

function writeStoredSettings(name: string, values: Readonly<Record<string, string>>): void {
  try {
    globalThis.localStorage?.setItem(`${STORAGE_PREFIX}${name}`, JSON.stringify(values));
  } catch {
    // Settings still apply for this page; persistence is a convenience.
  }
}

/**
 * Import and validate every configured extension module.
 *
 * A failing module is reported and skipped so one broken experiment cannot
 * take Paja down; built-in domains keep working.
 *
 * @param config - Host-page config with optional `extensions`.
 * @param reservedServices - Service names extensions must not override.
 * @param importModule - Module loader (dynamic `import()` by default).
 * @returns Loaded extensions and load failures.
 */
export async function loadPajaExtensions(
  config: Pick<PajaHostConfig, 'extensions'>,
  reservedServices: readonly string[],
  importModule: (url: string) => Promise<unknown> = (url) => import(/* @vite-ignore */ url),
): Promise<{ loaded: PajaLoadedExtension[]; failures: PajaExtensionLoadFailure[] }> {
  const loaded: PajaLoadedExtension[] = [];
  const failures: PajaExtensionLoadFailure[] = [];
  for (const entry of config.extensions ?? []) {
    try {
      loaded.push(await loadOne(entry, importModule));
      resolveShellExtensions(loaded.map((item) => item.extension), reservedServices);
    } catch (error) {
      loaded.pop();
      failures.push({ name: entry.name, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return { loaded, failures };
}

async function loadOne(
  entry: PajaHostExtensionConfig,
  importModule: (url: string) => Promise<unknown>,
): Promise<PajaLoadedExtension> {
  const module = await importModule(entry.url) as Partial<PajaExtensionModule>;
  if (typeof module?.default !== 'function') throw new Error(`${entry.name} must default-export an extension factory`);
  const values: Record<string, string> = { ...entry.settings, ...readStoredSettings(entry.name) };
  const extension = defineShellExtension(module.default({
    settings: { get: (key) => (values[key] ? values[key] : undefined) },
  }));
  const settings = Array.isArray(module.settings)
    ? module.settings.filter((setting) => typeof setting?.key === 'string' && typeof setting.label === 'string')
    : [];
  return { extension, settings, name: entry.name, enabled: entry.enabled, values };
}

/**
 * Install loaded extensions on a Paja adapter: set `extensions` and fold
 * disabled extension toggles into `capabilities.disabledDomains`.
 *
 * @param adapter - The Paja ShellAdapter, before `createShellBridge`.
 * @param loaded - Loaded extensions (their `enabled` flags stay live).
 */
export function installPajaExtensions(adapter: ShellAdapter, loaded: readonly PajaLoadedExtension[]): void {
  if (loaded.length === 0) return;
  (adapter as { extensions?: readonly ShellExtension[] }).extensions = Object.freeze(loaded.map((item) => item.extension));
  const descriptor = Object.getOwnPropertyDescriptor(adapter, 'capabilities');
  const readBase = (): ShellAdapter['capabilities'] => descriptor?.get ? descriptor.get.call(adapter) : descriptor?.value;
  Object.defineProperty(adapter, 'capabilities', {
    configurable: true,
    enumerable: true,
    get() {
      const base = readBase();
      const disabled = loaded.filter((item) => !item.enabled).map((item) => item.extension.domain);
      return { ...base, disabledDomains: [...(base?.disabledDomains ?? []), ...disabled] };
    },
  });
}

/**
 * Save one setting value for a loaded extension.
 *
 * @param loaded - The extension.
 * @param key - Setting key.
 * @param value - New value; empty clears it.
 */
export function setPajaExtensionSetting(loaded: PajaLoadedExtension, key: string, value: string): void {
  if (value) loaded.values[key] = value;
  else delete loaded.values[key];
  writeStoredSettings(loaded.name, loaded.values);
}

/** Inputs the extensions section needs from the host state. */
export interface PajaExtensionsRenderState {
  readonly extensions?: readonly PajaLoadedExtension[];
  readonly extensionFailures?: readonly PajaExtensionLoadFailure[];
  domainState(domain: string): ShellDomainState;
  saveExtensionSetting?(domain: string, key: string, value: string): void;
}

/**
 * Render the "Extensions" sidebar section.
 *
 * @param state - Host state with loaded extensions.
 */
export function renderPajaExtensions(state: PajaExtensionsRenderState): void {
  const container = document.getElementById('paja-extensions');
  const section = document.getElementById('paja-section-extensions');
  if (!container || !section) return;
  const loaded = state.extensions ?? [];
  const failures = state.extensionFailures ?? [];
  const rows: HTMLElement[] = loaded.map((item) => {
    const { domain } = item.extension;
    const row = document.createElement('form');
    row.className = 'extension';
    row.dataset.extensionDomain = domain;
    row.dataset.state = item.enabled ? state.domainState(domain) : 'disabled';
    const title = document.createElement('div');
    title.className = 'section-title';
    title.textContent = `${row.dataset.state === 'unconfigured' ? '⚠ ' : ''}${domain} · ${row.dataset.state}`;
    row.append(title);
    for (const setting of item.settings) {
      const label = document.createElement('label');
      label.textContent = setting.label;
      const input = document.createElement('input');
      input.id = `paja-extension-${domain}-${setting.key}`;
      input.type = 'text';
      input.spellcheck = false;
      input.value = item.values[setting.key] ?? '';
      if (setting.placeholder) input.placeholder = setting.placeholder;
      input.dataset.settingKey = setting.key;
      label.append(input);
      row.append(label);
    }
    if (item.settings.length > 0) {
      const save = document.createElement('button');
      save.type = 'submit';
      save.id = `paja-extension-${domain}-save`;
      save.textContent = 'Save';
      row.append(save);
    }
    row.addEventListener('submit', (event) => {
      event.preventDefault();
      for (const input of Array.from(row.querySelectorAll<HTMLInputElement>('input[data-setting-key]'))) {
        state.saveExtensionSetting?.(domain, input.dataset.settingKey ?? '', input.value.trim());
      }
    });
    return row;
  });
  for (const failure of failures) {
    const row = document.createElement('p');
    row.className = 'hint';
    row.dataset.extensionFailure = failure.name;
    row.textContent = `${failure.name} not loaded: ${failure.reason}`;
    rows.push(row);
  }
  container.replaceChildren(...rows);
}

/**
 * Host-facing state for an extension domain, honoring the live toggle.
 *
 * @param adapter - Paja adapter.
 * @param loaded - The extension.
 * @returns The tri-state for its domain.
 */
export function pajaExtensionDomainState(adapter: ShellAdapter, loaded: PajaLoadedExtension): ShellDomainState {
  return loaded.enabled ? getShellDomainState(adapter, loaded.extension.domain) : 'disabled';
}
