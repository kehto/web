import type { PajaNestedContextLockSetting } from './options.js';

/**
 * Per-origin runtime override for the experimental nested-browsing-context lock,
 * set from the Paja host GUI. It lets a deployed runtime toggle the policy
 * without a CLI flag, persisted in this host origin's `localStorage`. When unset,
 * the serialized host config (CLI / config file / `auto`) decides.
 *
 * @see docs/policies/EXPERIMENTAL.md
 */
const STORAGE_KEY = 'kehto:paja:nested-context-lock';

function isSetting(value: unknown): value is PajaNestedContextLockSetting {
  return value === 'auto' || value === 'on' || value === 'off';
}

/**
 * Read the GUI override for the nested-context lock, or `null` to follow the
 * host config. Safe in any environment: a missing or throwing `localStorage`
 * (private window, no DOM, blocked storage) reads as `null`.
 *
 * @param getStorage - Storage accessor; defaults to `localStorage`.
 * @returns The saved setting, or `null` when none is set or storage is unavailable.
 */
export function readStoredNestedContextLockSetting(
  getStorage: () => Storage = () => localStorage,
): PajaNestedContextLockSetting | null {
  try {
    const stored = getStorage().getItem(STORAGE_KEY);
    return isSetting(stored) ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Host-GUI state for the nested-context-lock override. `''` means "follow the
 * host default" and clears the override.
 *
 * @param getStorage - Storage accessor; defaults to `localStorage`.
 * @returns Getters and a `save` that persists the choice per host origin.
 */
export function createPajaSecuritySettings(getStorage: () => Storage = () => localStorage) {
  let setting = readStoredNestedContextLockSetting(getStorage);
  let status = setting
    ? `Frame-creation lock forced ${setting} for this host.`
    : 'Frame-creation lock follows the host default.';
  return {
    getSetting: (): PajaNestedContextLockSetting | null => setting,
    getStatus: () => status,
    save(next: string): { ok: boolean; message: string } {
      if (next !== '' && !isSetting(next)) {
        return { ok: false, message: 'Choose host default, auto, on, or off.' };
      }
      try {
        const storage = getStorage();
        if (next === '') {
          storage.removeItem(STORAGE_KEY);
          setting = null;
          status = 'Frame-creation lock follows the host default.';
        } else {
          storage.setItem(STORAGE_KEY, next);
          setting = next;
          status = `Frame-creation lock forced ${next}; applies on the next napplet load.`;
        }
      } catch {
        setting = next === '' ? null : (next as PajaNestedContextLockSetting);
        status = 'Applied for this session only; storage is unavailable, so the choice will not persist.';
      }
      return { ok: true, message: status };
    },
  };
}

/**
 * Wire the host-page nested-context-lock control. Reads `#paja-nested-context-lock`
 * (a select whose value is `''` | `auto` | `on` | `off`) and persists changes.
 *
 * @returns The current getter and a disposer, or a no-op disposer when the
 *   control is absent.
 */
export function installPajaSecuritySettings(): {
  getSetting: () => PajaNestedContextLockSetting | null;
  dispose: () => void;
} {
  const settings = createPajaSecuritySettings();
  const select = document.getElementById('paja-nested-context-lock') as HTMLSelectElement | null;
  const status = document.getElementById('paja-nested-context-lock-status');
  if (!select || !status) return { getSetting: settings.getSetting, dispose: () => {} };
  select.value = settings.getSetting() ?? '';
  status.textContent = settings.getStatus();
  const onChange = (): void => {
    const result = settings.save(select.value);
    select.setAttribute('aria-invalid', String(!result.ok));
    status.textContent = result.message;
    if (!result.ok) select.value = settings.getSetting() ?? '';
  };
  select.addEventListener('change', onChange);
  return { getSetting: settings.getSetting, dispose: () => select.removeEventListener('change', onChange) };
}
