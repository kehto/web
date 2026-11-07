import { describe, expect, it } from 'vitest';

import { INC_MOCK_ENTRY, INC_SPEC_REF, MOCK_INC_TOPICS } from './inc.js';

describe('NAP-INC entry', () => {
  it('records the merged master spec and a runtime-owned note without a factory', () => {
    expect(INC_SPEC_REF).toEqual({ nap: 'NAP-INC', status: 'merged', source: 'master', sha: '43cb3a4e8555', path: 'naps/NAP-INC.md' });
    expect(INC_MOCK_ENTRY).toMatchObject({ domain: 'inc', kind: 'runtime-owned', spec: INC_SPEC_REF });
    expect(INC_MOCK_ENTRY.create).toBeUndefined();
    expect(INC_MOCK_ENTRY.note).toContain('inc-handler.ts');
    expect(INC_MOCK_ENTRY.note).toContain('must not fabricate');
  });

  it('ships stable, queryless topic strings following the advisory prefixes', () => {
    expect(MOCK_INC_TOPICS).toEqual({
      profileOpen: 'napplet:profile/open',
      dmOpen: 'napplet:dm/open',
      mediaPlay: 'napplet:media/play',
      shellStateGet: 'shell:state-get',
    });
    for (const topic of Object.values(MOCK_INC_TOPICS)) {
      expect(topic).not.toContain('?');
      expect(topic).toMatch(/^(napplet:[a-z]+\/[a-z-]+|shell:[a-z-]+)$/);
    }
    expect(Object.isFrozen(MOCK_INC_TOPICS)).toBe(true);
  });
});
