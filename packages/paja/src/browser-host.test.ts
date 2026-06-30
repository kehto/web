import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('@kehto/paja browser host runtime source guards', () => {
  it('preserves resolved pointer identity when the runtime iframe finishes loading', () => {
    const source = readFileSync(new URL('./browser-host.ts', import.meta.url), 'utf8');

    expect(source).toContain(
      'runtime.currentWindowId = registerFrameForGeneration(bridge, frame, config, state.generation, state.resolvedTarget);',
    );
  });
});
