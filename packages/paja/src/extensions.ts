/**
 * Paja configuration contract for experimental (`x-`) NAP extensions.
 *
 * A Paja config lists extension modules; each module is a browser ES module
 * whose default export receives a {@link PajaExtensionContext} and returns a
 * `ShellExtension` from `@kehto/shell`. Paja serves each module from its own
 * origin, imports it in the host page before the shell bridge starts, and
 * passes the result through `ShellAdapter.extensions`. No kehto package
 * changes are needed to add a domain.
 *
 * @module
 */

import type { ShellExtension } from '@kehto/shell';

/** One text setting an extension asks the Paja sidebar to collect. */
export interface PajaExtensionSetting {
  /** Stable setting key passed to `context.settings.get`. */
  readonly key: string;
  /** Human label shown in the Extensions section. */
  readonly label: string;
  /** Optional placeholder text. */
  readonly placeholder?: string;
}

/** Host services Paja hands to an extension factory. */
export interface PajaExtensionContext {
  /** Live settings, seeded from config and edited in the Extensions section. */
  readonly settings: {
    /** Current value for `key`, or `undefined` when unset or empty. */
    get(key: string): string | undefined;
  };
}

/** Default export of a Paja extension module. */
export type PajaExtensionFactory = (context: PajaExtensionContext) => ShellExtension;

/** Shape of a module listed in Paja's `extensions` config. */
export interface PajaExtensionModule {
  /** Factory that returns the shell extension declaration. */
  readonly default: PajaExtensionFactory;
  /** Settings to render in the Extensions section. */
  readonly settings?: readonly PajaExtensionSetting[];
}

/** Raw extension entry: a module path, or a module with defaults. */
export type PajaExtensionRawOption = string | {
  /** Path to the ES module, relative to the config file (or cwd). */
  readonly module: string;
  /** Whether the domain starts enabled (default `true`). */
  readonly enabled?: boolean;
  /** Initial setting values; the sidebar can override them per browser. */
  readonly settings?: Readonly<Record<string, string>>;
};

/** Normalized extension entry. */
export interface PajaExtensionOption {
  /** Module path served to the host page (config-relative paths are resolved by the config loader; others by the server against cwd). */
  readonly modulePath: string;
  /** Whether the domain starts enabled. */
  readonly enabled: boolean;
  /** Initial setting values. */
  readonly settings: Readonly<Record<string, string>>;
}

/** Serialized extension entry embedded in the host-page config. */
export interface PajaHostExtensionConfig {
  /** Same-origin URL of the served module. */
  readonly url: string;
  /** Module file name for diagnostics. */
  readonly name: string;
  /** Whether the domain starts enabled. */
  readonly enabled: boolean;
  /** Initial setting values. */
  readonly settings: Readonly<Record<string, string>>;
}

/** Thrown when an `extensions` config entry is malformed. */
export class PajaExtensionConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PajaExtensionConfigError';
  }
}

/**
 * Normalize raw `extensions` entries.
 *
 * @param raw - Entries from CLI options or a config file.
 * @returns Normalized entries.
 * @throws PajaExtensionConfigError for malformed entries.
 * @example
 * ```ts
 * normalizePajaExtensions(['./x-echo.js']);
 * // [{ modulePath: './x-echo.js', enabled: true, settings: {} }]
 * ```
 */
export function normalizePajaExtensions(
  raw: readonly PajaExtensionRawOption[] | undefined,
): readonly PajaExtensionOption[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new PajaExtensionConfigError('extensions must be an array of module paths');
  return raw.map((entry, index) => {
    const value = typeof entry === 'string' ? { module: entry } : entry;
    if (!value || typeof value !== 'object' || typeof value.module !== 'string' || value.module.trim() === '') {
      throw new PajaExtensionConfigError(`extensions[${index}] must be a module path or { module }`);
    }
    if (!/\.(m?js)$/.test(value.module)) {
      throw new PajaExtensionConfigError(`extensions[${index}] must be a .js or .mjs browser module`);
    }
    const settings: Record<string, string> = {};
    for (const [key, setting] of Object.entries(value.settings ?? {})) {
      if (typeof setting !== 'string') throw new PajaExtensionConfigError(`extensions[${index}].settings.${key} must be a string`);
      settings[key] = setting;
    }
    return Object.freeze({
      modulePath: value.module,
      enabled: value.enabled !== false,
      settings: Object.freeze(settings),
    });
  });
}

/**
 * Build the host-page config entries and the URL → file map the server serves.
 *
 * @param extensions - Normalized entries.
 * @returns Host config entries in declaration order.
 * @example
 * ```ts
 * createPajaHostExtensions(options.extensions)[0].url; // '/__kehto/extensions/0.js'
 * ```
 */
export function createPajaHostExtensions(extensions: readonly PajaExtensionOption[]): readonly PajaHostExtensionConfig[] {
  return extensions.map((entry, index) => Object.freeze({
    url: pajaExtensionUrl(index),
    name: entry.modulePath.split(/[\\/]/).pop() ?? `extension-${index}.js`,
    enabled: entry.enabled,
    settings: entry.settings,
  }));
}

/**
 * Same-origin URL Paja serves the extension module at.
 *
 * @param index - Position in the `extensions` list.
 * @returns The module URL path.
 * @example
 * ```ts
 * pajaExtensionUrl(0); // '/__kehto/extensions/0.js'
 * ```
 */
export function pajaExtensionUrl(index: number): string {
  return `/__kehto/extensions/${index}.js`;
}

/**
 * Rebase relative module paths in raw entries (used by the config loader so
 * paths are relative to the config file).
 *
 * @param raw - Raw entries from a config file.
 * @param rebase - Maps a relative module path to an absolute one.
 * @returns Entries with rebased module paths.
 * @example
 * ```ts
 * rebasePajaExtensions(['./x-echo.js'], (path) => resolve(configDir, path));
 * ```
 */
export function rebasePajaExtensions(
  raw: readonly PajaExtensionRawOption[] | undefined,
  rebase: (modulePath: string) => string,
): readonly PajaExtensionRawOption[] | undefined {
  if (!Array.isArray(raw)) return raw;
  return raw.map((entry) => {
    if (typeof entry === 'string') return rebase(entry);
    if (entry && typeof entry === 'object' && typeof entry.module === 'string') return { ...entry, module: rebase(entry.module) };
    return entry;
  });
}
