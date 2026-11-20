import { createThemeService } from '@kehto/services';
import type { ShellBridge } from '@kehto/shell';
import type { DomainBackendModule } from './types.js';

/** Theme every full-profile boot starts with; the theme fixture asserts it. */
export const FIXTURE_THEME = Object.freeze({ colors: Object.freeze({ background: '#101820', text: '#f2f2f2', primary: '#ff6f61' }), title: 'Conformance' });
/** Theme the `theme.publish` control switches to. */
export const FIXTURE_THEME_NEXT = Object.freeze({ colors: Object.freeze({ background: '#ffffff', text: '#111111', primary: '#0055ff' }), title: 'Conformance next' });

/** NAP-THEME backend: the reference theme service, broadcasting through the bridge. */
export const THEME_BACKEND: DomainBackendModule = {
  domain: 'theme',
  create() {
    let bridge: ShellBridge | null = null;
    const theme = createThemeService({ initialTheme: structuredClone(FIXTURE_THEME), onBroadcast: (envelope) => bridge?.publishTheme(envelope.theme) });
    return {
      services: { theme: theme.handler },
      attach(attached) { bridge = attached; },
      controls: {
        'theme.publish': () => { theme.publishTheme(structuredClone(FIXTURE_THEME_NEXT)); },
      },
    };
  },
};
