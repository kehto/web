import type { DomainFixture } from './types.js';

const COLORS = ['background', 'text', 'primary'] as const;

function colorsOf(theme: unknown): string | null {
  const colors = (theme as { colors?: Record<string, unknown> } | undefined)?.colors;
  const missing = COLORS.filter((name) => typeof colors?.[name] !== 'string');
  return missing.length ? `theme.colors lacks ${missing.join(', ')}` : null;
}

/** NAP-THEME at napplet/naps master: correlated get with the required colors, and theme.changed. */
export const THEME_FIXTURE: DomainFixture = {
  domain: 'theme',
  cases: [
    {
      id: 'theme/get', type: 'theme.get',
      semantics: { rule: 'theme.get.result carries a theme with the required background, text and primary colors', verify: (reply) => colorsOf(reply?.theme) },
    },
  ],
  pushes: [
    {
      id: 'theme/changed', type: 'theme.changed', trigger: { control: 'theme.publish' },
      then: [{ id: 'theme/get-after-change', type: 'theme.get' }],
      semantics: {
        rule: 'theme.changed carries the new theme with the required colors, and theme.get then returns it',
        verify(push, replies) {
          const problem = colorsOf(push?.theme);
          if (problem) return problem;
          const after = replies['theme/get-after-change'];
          return JSON.stringify(after?.theme) === JSON.stringify(push?.theme) ? null : 'theme.get after theme.changed did not return the pushed theme';
        },
      },
    },
  ],
};
