/**
 * domains/theme.ts — Mock NAP-THEME service.
 *
 * Spec: naps/NAP-THEME.md @ napplet/naps master 43cb3a4e8555 (merged)
 * Routes: theme.get; push theme.changed
 * Spec gaps / decisions:
 *   - There is no wire subscribe: `setTheme()` broadcasts `theme.changed` to
 *     every window the mock has seen (any `theme.get`) plus, when attached,
 *     every `runtime.listWindowIds()` window. Runtime delivery already filters
 *     windows without the `theme` domain.
 *   - `initialTheme: null` models "no active theme"; `theme.get` then answers
 *     with `error: 'no active theme'` as the NAP's error example shows.
 *   - Font and background URLs are example-domain placeholders; the mock does
 *     not fetch them.
 */
import type { NappletMessage } from '@kehto/runtime';
import type { Theme, ThemeChangedMessage } from '@napplet/nap/theme/types';
import { defineMockService, pushToWindow } from '../core/handler.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';

/** Spec document read when this mock was written. */
export const THEME_SPEC_REF: NapSpecRef = {
  nap: 'NAP-THEME',
  status: 'merged',
  source: 'master',
  sha: '43cb3a4e8555',
  path: 'naps/NAP-THEME.md',
};

/** Names of the fixture themes. */
export type MockThemeName = 'light' | 'dark';

/**
 * Fixture themes: `light` is colors-only, `dark` carries fonts, background,
 * and a title.
 *
 * @example
 * ```ts
 * MOCK_THEMES.dark.colors.background === '#0d1117';
 * ```
 */
export const MOCK_THEMES: Readonly<Record<MockThemeName, Theme>> = Object.freeze({
  light: {
    colors: { background: '#ffffff', text: '#333333', primary: '#0066cc' },
    title: 'Mock Light',
  },
  dark: {
    colors: { background: '#0d1117', text: '#c9d1d9', primary: '#58a6ff' },
    fonts: {
      body: { name: 'Inter', url: 'https://fonts.example.org/inter.woff2' },
      title: { name: 'Playfair Display', url: 'https://fonts.example.org/playfair.woff2' },
    },
    background: { url: 'https://media.example.org/bg.jpg', mode: 'cover', mime: 'image/jpeg' },
    title: 'Mock Dark',
  },
});

/**
 * In-memory state of the theme mock.
 *
 * @example
 * ```ts
 * service.mock.state().current?.title; // 'Mock Dark'
 * ```
 */
export interface MockThemeState {
  /** Active theme, or `undefined` when no theme is active. */
  current: Theme | undefined;
  /** Windows that have talked to the mock and receive `theme.changed`. */
  windows: Set<string>;
  /** Number of `setTheme()` broadcasts since construction or reset. */
  changes: number;
}

/**
 * Options for `createMockThemeService`.
 *
 * @example
 * ```ts
 * const options: MockThemeOptions = { initialTheme: 'light' };
 * ```
 */
export interface MockThemeOptions extends MockServiceOptions {
  /** Starting theme: a fixture name, a full `Theme`, or `null` for no active theme. Default `'dark'`. */
  initialTheme?: MockThemeName | Theme | null;
}

/**
 * The theme mock service with its `setTheme` control.
 *
 * @example
 * ```ts
 * const theme = createMockThemeService();
 * theme.setTheme('light'); // pushes theme.changed to every known window
 * ```
 */
export type MockThemeService = MockService<MockThemeState> & {
  /**
   * Replace the active theme and push `theme.changed` to every known window.
   *
   * @param theme - Fixture name or full `Theme`.
   * @returns The broadcast envelope.
   */
  setTheme(theme: MockThemeName | Theme): ThemeChangedMessage;
};

function resolveTheme(theme: MockThemeName | Theme | null | undefined): Theme | undefined {
  if (theme === null) return undefined;
  if (theme === undefined) return MOCK_THEMES.dark;
  return typeof theme === 'string' ? MOCK_THEMES[theme] : theme;
}

/**
 * Create the NAP-THEME mock.
 *
 * @param options - Initial theme and shared mock options.
 * @returns The theme mock service.
 * @example
 * ```ts
 * const theme = createMockThemeService({ initialTheme: 'light' });
 * theme.handleMessage('w1', { type: 'theme.get', id: 't1' }, send);
 * // → { type: 'theme.get.result', id: 't1', theme: MOCK_THEMES.light }
 * ```
 */
export function createMockThemeService(options: MockThemeOptions = {}): MockThemeService {
  const base = defineMockService<MockThemeState>({
    domain: 'theme',
    version: '1.0.0',
    description: 'Mock NAP-THEME shell-provided theming',
    kind: 'service',
    initialState: () => ({ current: resolveTheme(options.initialTheme), windows: new Set(), changes: 0 }),
    routes: {
      'theme.get': ({ windowId, state, reply, fail }) => {
        state.windows.add(windowId);
        if (!state.current) {
          fail('no active theme');
          return;
        }
        reply({ theme: state.current });
      },
    },
    onWindowDestroyed: (windowId, state) => { state.windows.delete(windowId); },
  }, options);

  const service: MockThemeService = Object.assign(base, {
    setTheme(theme: MockThemeName | Theme): ThemeChangedMessage {
      const state = base.mock.state();
      state.current = resolveTheme(theme);
      state.changes += 1;
      const envelope: ThemeChangedMessage = { type: 'theme.changed', theme: state.current as Theme };
      const targets = new Set([...state.windows, ...(base.mock.runtime?.listWindowIds() ?? [])]);
      for (const windowId of targets) pushToWindow(base, windowId, envelope as NappletMessage);
      return envelope;
    },
  });
  return service;
}

/** Registry row for the theme mock. */
export const THEME_MOCK_ENTRY: MockDomainEntry = {
  domain: 'theme',
  kind: 'service',
  spec: THEME_SPEC_REF,
  create: (options) => createMockThemeService(options),
};
