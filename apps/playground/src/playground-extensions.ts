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

interface StoredExtensionState {
  readonly values?: Record<string, Record<string, string>>;
  readonly disabled?: readonly string[];
  /** Domain → napplet d tags whose frame environment withholds it. */
  readonly deniedFor?: Record<string, readonly string[]>;
}

function readStored(): StoredExtensionState {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as StoredExtensionState : {};
  } catch {
    return {};
  }
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
  Object.entries(stored.deniedFor ?? {}).map(([domain, dTags]) => [domain, new Set(Array.isArray(dTags) ? dTags : [])]),
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
