/**
 * Playground host wiring for experimental x- NAP extensions.
 *
 * The playground hosts the toy `x-echo` NAP (a byte-identical copy of
 * tests/fixtures/experimental-nap/x-echo.js) through `ShellAdapter.extensions`,
 * the same public hook any downstream host uses. Its settings and enabled flag
 * are per-browser conveniences kept in localStorage.
 */

import {
  getShellDomainState,
  getShellExtensionBindings,
  listShellExtensionCapabilities,
  type AclCapability,
  type ShellAdapter,
  type ShellDomainState,
  type ShellExtension,
  type ShellExtensionBinding,
} from '@kehto/shell';
import { createEchoExtension, settings as echoSettings } from './extensions/x-echo.js';

/** A setting a playground extension renders in the shell controls bar. */
export interface PlaygroundExtensionSetting {
  readonly key: string;
  readonly label: string;
  readonly placeholder?: string;
}

interface PlaygroundExtensionEntry {
  readonly extension: ShellExtension;
  readonly settings: readonly PlaygroundExtensionSetting[];
  readonly values: Record<string, string>;
  enabled: boolean;
}

const STORAGE_KEY = 'kehto.playground.extensions.v1';

/** Persisted per-browser extension state, after {@link sanitizeStoredExtensionState}. */
export interface StoredExtensionState {
  readonly values?: Record<string, Record<string, string>>;
  readonly disabled?: readonly string[];
  /** Domain → napplet d tags whose frame environment withholds it. */
  readonly deniedFor?: Record<string, readonly string[]>;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringItems(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function stringValues(value: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

/**
 * Keep only well-formed extension state from untrusted localStorage data.
 * Setting values keep only string fields of plain-object domain records,
 * `disabled` keeps only string items of an array, and `deniedFor` keeps only
 * array entries with string `d` tags. Anything else is dropped.
 *
 * @param value - Parsed JSON from storage.
 * @returns The sanitized state; `{}` for non-object input.
 * @example
 * ```ts
 * sanitizeStoredExtensionState({ values: { 'x-echo': { prefix: 5 } }, disabled: 'x-echo' });
 * // { values: { 'x-echo': {} }, disabled: [], deniedFor: {} }
 * ```
 */
export function sanitizeStoredExtensionState(value: unknown): StoredExtensionState {
  if (!isPlainRecord(value)) return {};
  const values = isPlainRecord(value.values) ? value.values : {};
  const deniedFor = isPlainRecord(value.deniedFor) ? value.deniedFor : {};
  return {
    values: Object.fromEntries(Object.entries(values)
      .filter((entry): entry is [string, Record<string, unknown>] => isPlainRecord(entry[1]))
      .map(([domain, record]) => [domain, stringValues(record)])),
    disabled: stringItems(value.disabled),
    deniedFor: Object.fromEntries(Object.entries(deniedFor)
      .filter(([, dTags]) => Array.isArray(dTags))
      .map(([domain, dTags]) => [domain, stringItems(dTags)])),
  };
}

function readStored(): StoredExtensionState {
  try {
    return sanitizeStoredExtensionState(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'));
  } catch {
    return {};
  }
}

/**
 * Initial state of a playground ACL toggle for an x- capability. An explicit
 * decision wins whatever the block state; with none, the toggle reads the ACL
 * default policy through `check` (block-independent, see `defaultCheck`).
 *
 * @param decisions - Explicit x- decisions from the ACL snapshot, if any.
 * @param cap - The x- capability.
 * @param check - Fallback that reads the ACL default policy.
 * @returns Whether the toggle starts enabled.
 * @example
 * ```ts
 * extensionToggleEnabled(entry?.extensions, 'x-echo:send', () => adapter.defaultCheck('x-echo:send'));
 * ```
 */
export function extensionToggleEnabled(
  decisions: Readonly<Record<string, boolean>> | undefined,
  cap: string,
  check: () => boolean,
): boolean {
  return decisions && Object.hasOwn(decisions, cap) ? decisions[cap] === true : check();
}

/**
 * Whether the `__kehtoPlaygroundExtensions__` test hook may be installed:
 * only in dev builds or when the page URL carries the `kehto-test` query key.
 *
 * @param search - `window.location.search`.
 * @param dev - `import.meta.env.DEV`.
 * @returns True when the test hook is allowed.
 * @example
 * ```ts
 * if (playgroundExtensionTestHooksEnabled(location.search, import.meta.env.DEV)) installHook();
 * ```
 */
export function playgroundExtensionTestHooksEnabled(search: string, dev: boolean): boolean {
  return dev || new URLSearchParams(search).has('kehto-test');
}

const stored = readStored();
const echoValues: Record<string, string> = { ...stored.values?.['x-echo'] };
const entries: PlaygroundExtensionEntry[] = [
  {
    extension: createEchoExtension({ getPrefix: () => echoValues.prefix || undefined }),
    settings: echoSettings,
    values: echoValues,
    enabled: !stored.disabled?.includes('x-echo'),
  },
];
const extensions: readonly ShellExtension[] = Object.freeze(entries.map((entry) => entry.extension));
const deniedFor = new Map<string, Set<string>>(
  Object.entries(stored.deniedFor ?? {}).map(([domain, dTags]) => [domain, new Set(dTags)]),
);

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      values: Object.fromEntries(entries.map((entry) => [entry.extension.domain, entry.values])),
      disabled: entries.filter((entry) => !entry.enabled).map((entry) => entry.extension.domain),
      deniedFor: Object.fromEntries([...deniedFor].map(([domain, dTags]) => [domain, [...dTags]])),
    }));
  } catch {
    // Storage can be unavailable; the change still applies to this page.
  }
}

/** Extensions to pass as `ShellAdapter.extensions`. */
export function getPlaygroundExtensions(): readonly ShellExtension[] {
  return extensions;
}

/** Extension domains the user switched off (folded into `disabledDomains`). */
export function getDisabledPlaygroundExtensionDomains(): readonly string[] {
  return entries.filter((entry) => !entry.enabled).map((entry) => entry.extension.domain);
}

/**
 * Narrow one frame's environment: withhold extension domains denied for its
 * napplet `d` tag. Used as the demo adapter's `capabilities.resolveEnvironment`.
 *
 * @param dTag - The frame's verified napplet `d` tag.
 * @param available - Live domains and services before policy.
 * @returns The granted subset.
 */
export function resolvePlaygroundExtensionEnvironment(
  dTag: string,
  available: Readonly<{ domains: readonly string[]; services: readonly string[] }>,
): { domains: readonly string[]; services: readonly string[] } {
  const denied = (name: string) => deniedFor.get(name)?.has(dTag) === true;
  return { domains: available.domains.filter((d) => !denied(d)), services: available.services.filter((s) => !denied(s)) };
}

/**
 * Deny or re-allow an extension domain for one napplet `d` tag. Takes effect
 * for frames loaded afterwards (environments are frozen per frame).
 *
 * @param domain - Extension domain.
 * @param dTag - Napplet `d` tag.
 * @param denied - Whether to withhold the domain.
 */
export function setPlaygroundExtensionDenied(domain: string, dTag: string, denied: boolean): void {
  const set = deniedFor.get(domain) ?? new Set<string>();
  if (denied) set.add(dTag);
  else set.delete(dTag);
  deniedFor.set(domain, set);
  persist();
}

/** Prelude bindings for the extension domains exposed to one frame. */
export function getPlaygroundExtensionBindings(domains: readonly string[]): Readonly<Record<string, ShellExtensionBinding>> {
  return getShellExtensionBindings(extensions, domains);
}

/** Extension capabilities with labels and hints for the ACL panel. */
export function getPlaygroundExtensionCapabilities(): readonly { cap: AclCapability; label: string; hint: string }[] {
  return listShellExtensionCapabilities(extensions).map((entry) => ({
    cap: entry.capability,
    label: entry.label ?? entry.capability,
    hint: entry.description ?? `${entry.domain} experimental capability`,
  }));
}

function stateOf(adapter: ShellAdapter, entry: PlaygroundExtensionEntry): ShellDomainState {
  return entry.enabled ? getShellDomainState(adapter, entry.extension.domain) : 'disabled';
}

/**
 * Render the extension controls (state toggle, settings) into the shell bar.
 *
 * @param container - Host element.
 * @param adapter - The demo ShellAdapter (for live tri-state).
 * @param onEnabledChange - Called after a toggle; new frames pick up the change.
 */
export function renderPlaygroundExtensionControls(
  container: HTMLElement,
  adapter: ShellAdapter,
  onEnabledChange: (domain: string, enabled: boolean) => void,
): void {
  const rows = entries.map((entry) => {
    const { domain } = entry.extension;
    const form = document.createElement('form');
    form.className = 'shell-control-group playground-extension';
    form.dataset.extensionDomain = domain;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'shell-control-btn';
    toggle.dataset.interfaceDomain = domain;
    const paint = () => {
      const state = stateOf(adapter, entry);
      toggle.dataset.state = state;
      toggle.dataset.enabled = String(entry.enabled);
      toggle.textContent = state === 'unconfigured' ? `⚠ ${domain}` : domain;
      toggle.title = state === 'unconfigured'
        ? `${domain} is advertised but not configured; set its settings`
        : `${domain} ${entry.enabled ? 'enabled' : 'disabled'} (applies to newly loaded napplets)`;
    };
    toggle.addEventListener('click', () => {
      entry.enabled = !entry.enabled;
      persist();
      paint();
      onEnabledChange(domain, entry.enabled);
    });
    form.append(toggle);
    for (const setting of entry.settings) {
      const input = document.createElement('input');
      input.id = `playground-extension-${domain}-${setting.key}`;
      input.className = 'shell-control-input';
      input.type = 'text';
      input.spellcheck = false;
      input.placeholder = setting.placeholder ?? setting.label;
      input.setAttribute('aria-label', `${domain} ${setting.label}`);
      input.value = entry.values[setting.key] ?? '';
      input.dataset.settingKey = setting.key;
      form.append(input);
    }
    const save = document.createElement('button');
    save.type = 'submit';
    save.id = `playground-extension-${domain}-save`;
    save.className = 'shell-control-btn subtle';
    save.textContent = 'save';
    form.append(save);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      for (const input of Array.from(form.querySelectorAll<HTMLInputElement>('input[data-setting-key]'))) {
        const key = input.dataset.settingKey ?? '';
        const value = input.value.trim();
        if (value) entry.values[key] = value;
        else delete entry.values[key];
      }
      persist();
      paint();
    });
    paint();
    return form;
  });
  container.replaceChildren(...rows);
}
