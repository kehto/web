import {
  PAJA_SETTING_DEFINITIONS,
  type PajaSettingDefinition,
  type PajaSettingKey,
} from './settings-registry.js';

export {
  PAJA_SETTING_DEFINITIONS,
  type PajaSettingDefinition,
  type PajaSettingKey,
  type PajaSettingScope,
  type PajaSettingUnit,
} from './settings-registry.js';

/** Partial map of setting overrides keyed by registered setting key. */
export type PajaSettingValues = Partial<Record<PajaSettingKey, number>>;

/** Result of validating untrusted setting input. */
export interface PajaSettingsNormalization {
  /** Accepted, in-range overrides. */
  readonly values: PajaSettingValues;
  /** Human-readable reason for every rejected entry. */
  readonly rejected: readonly string[];
}

const DEFINITIONS = new Map<string, PajaSettingDefinition>(
  PAJA_SETTING_DEFINITIONS.map((definition) => [definition.key, definition]),
);

let active: PajaSettingValues = {};

/**
 * Look up a registered setting definition.
 *
 * @param key - Setting key.
 * @returns The definition, or `undefined` for an unknown key.
 * @example
 * findPajaSettingDefinition('fs.maxReadBytes')?.defaultValue; // 1048576
 */
export function findPajaSettingDefinition(key: string): PajaSettingDefinition | undefined {
  return DEFINITIONS.get(key);
}

/**
 * Validate one value against its definition.
 *
 * @param definition - Registered setting.
 * @param value - Untrusted candidate.
 * @returns An error message, or `null` when the value is acceptable.
 * @example
 * validatePajaSettingValue(definition, 0); // 'Use a value from 1 to 256.'
 */
export function validatePajaSettingValue(definition: PajaSettingDefinition, value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Enter a number.';
  if (definition.unit !== 'ratio' && !Number.isInteger(value)) return 'Enter a whole number.';
  if (value < definition.min || value > definition.max) {
    return `Use a value from ${String(definition.min)} to ${String(definition.max)}.`;
  }
  return null;
}

/**
 * Validate an untrusted object of overrides (config file or browser storage).
 * Unknown keys, wrong types, and out-of-range values are dropped, never clamped,
 * so a typo cannot silently weaken a guard.
 *
 * @param raw - Untrusted input.
 * @param scope - When given, keep only settings consumed by that process.
 * @returns Accepted values and rejection reasons.
 * @example
 * normalizePajaSettings({ 'fs.maxWatchCount': 32 }).values; // { 'fs.maxWatchCount': 32 }
 */
export function normalizePajaSettings(raw: unknown, scope?: PajaSettingDefinition['scope']): PajaSettingsNormalization {
  const values: Record<string, number> = {};
  const rejected: string[] = [];
  if (raw === undefined || raw === null) return { values, rejected };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { values, rejected: ['settings must be an object of numbers'] };
  for (const [key, value] of Object.entries(raw)) {
    const definition = DEFINITIONS.get(key);
    if (!definition) { rejected.push(`${key}: unknown setting`); continue; }
    if (scope && definition.scope !== scope) continue;
    const problem = validatePajaSettingValue(definition, value);
    if (problem) rejected.push(`${key}: ${problem}`);
    else values[key] = value as number;
  }
  return { values: values as PajaSettingValues, rejected };
}

/**
 * Replace the active overrides for this process. Values are read at call time,
 * so new operations pick up changes without a reload.
 *
 * @param values - Validated overrides; omitted keys use built-in defaults.
 * @returns Nothing.
 * @example
 * setActivePajaSettings({ 'relay.liveQueryWaitMs': 8000 });
 */
export function setActivePajaSettings(values: PajaSettingValues): void {
  active = Object.freeze({ ...normalizePajaSettings(values).values });
}

/**
 * Current active overrides (not including defaults).
 *
 * @returns A frozen copy of the active overrides.
 * @example
 * getActivePajaSettings(); // {}
 */
export function getActivePajaSettings(): PajaSettingValues {
  return active;
}

/**
 * Effective value of a setting: active override, otherwise built-in default.
 *
 * @param key - Registered setting key.
 * @returns The effective number.
 * @example
 * const waitMs = getPajaSetting('relay.liveQueryWaitMs');
 */
export function getPajaSetting(key: PajaSettingKey): number {
  const definition = DEFINITIONS.get(key);
  if (!definition) throw new Error(`Unknown Paja setting ${key}`);
  return active[key] ?? definition.defaultValue;
}

/**
 * Built-in default of a setting, ignoring overrides.
 *
 * @param key - Registered setting key.
 * @returns The shipped default.
 * @example
 * getPajaSettingDefault('fs.maxWatchCount'); // 16
 */
export function getPajaSettingDefault(key: PajaSettingKey): number {
  const definition = DEFINITIONS.get(key);
  if (!definition) throw new Error(`Unknown Paja setting ${key}`);
  return definition.defaultValue;
}
