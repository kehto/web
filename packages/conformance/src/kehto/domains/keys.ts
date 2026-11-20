import { createKeysService } from '@kehto/services';
import type { DomainBackendModule } from './types.js';

interface PressPayload { key: string; code: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean }

/**
 * NAP-KEYS backend: the reference keys service listening on a private
 * EventTarget (never the host document). `keys.press` dispatches one keydown
 * there, as the host would see a user pressing the chord.
 */
export const KEYS_BACKEND: DomainBackendModule = {
  domain: 'keys',
  create() {
    const target = new EventTarget();
    const keys = createKeysService({ listenerTarget: target });
    return {
      services: { keys },
      controls: {
        'keys.press': (payload) => {
          const press = payload as PressPayload;
          target.dispatchEvent(Object.assign(new Event('keydown'), { ...press, repeat: false }));
        },
      },
      dispose() { keys.destroy(); },
    };
  },
};
