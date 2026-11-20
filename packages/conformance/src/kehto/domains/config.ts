import { createConfigService, type ConfigSettingsContext } from '@kehto/services';
import type { DomainBackendModule } from './types.js';

type ConfigValues = Record<string, unknown>;

/**
 * Values persisted before any schema exists. `legacy` is an orphan no fixture
 * schema declares, so NAP-CONFIG forbids delivering it.
 */
const PERSISTED_SEED: Readonly<ConfigValues> = Object.freeze({ legacy: 'orphaned value' });

/** NAP-CONFIG backend: the reference config service over an in-memory, per-window value store. */
export const CONFIG_BACKEND: DomainBackendModule = {
  domain: 'config',
  create() {
    const store = new Map<string, ConfigValues>();
    const settings = new Map<string, ConfigSettingsContext>();
    const opened: { windowId: string; section: string | undefined }[] = [];
    const config = createConfigService({
      getValues: (windowId) => ({ ...(store.get(windowId) ?? PERSISTED_SEED) }),
      saveValues: (windowId, values) => { store.set(windowId, { ...values }); },
      openSettings: (windowId, section, context) => { opened.push({ windowId, section }); settings.set(windowId, context); },
      onWindowDestroyed: (windowId) => { store.delete(windowId); settings.delete(windowId); },
    });
    return {
      services: { config: config.handler },
      controls: {
        /**
         * The settings UI commits `payload` (default `{ theme: 'light' }`) for the newest
         * endpoint, through the context `openSettings` received, or the host publish path.
         */
        'config.commit': (payload, { endpoints }) => {
          const windowId = endpoints().at(-1);
          if (!windowId) return null;
          const values = (payload && typeof payload === 'object' ? payload : { theme: 'light' }) as ConfigValues;
          const context = settings.get(windowId);
          if (context) return context.commit(values);
          store.set(windowId, { ...values });
          config.publishValues(values, windowId);
          return values;
        },
        /** Evidence: every `openSettings` the host received, with the section it honored. Triggers nothing. */
        'config.openedSettings': () => [...opened],
      },
    };
  },
};
