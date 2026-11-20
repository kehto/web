/**
 * Negative coverage for KEHTO_MOCKS_NAP_DRIFT_RETIRED (docs/compatibility.md):
 * the NAP-MESH mock, LLM_TOOLS_SPEC_REF, the LLM result `text` mirror,
 * `respondWith(..., 'toolUse')` and the lowercase `toolcall` delta block were
 * removed without a compatibility path.
 */
import { describe, expect, it } from 'vitest';
import type { NappletMessage } from '@kehto/runtime';

import * as mocks from './index.js';
import { MOCK_NAP_REGISTRY } from './registry.js';

type Msg = NappletMessage & Record<string, unknown>;

describe('KEHTO_MOCKS_NAP_DRIFT_RETIRED', () => {
  it('no longer exports the NAP-MESH mock or LLM_TOOLS_SPEC_REF', () => {
    for (const name of ['createMockMeshService', 'MESH_MOCK_ENTRY', 'MESH_SPEC_REF', 'LLM_TOOLS_SPEC_REF']) {
      expect(Object.hasOwn(mocks, name), name).toBe(false);
    }
    expect(MOCK_NAP_REGISTRY.some((entry) => entry.domain === 'mesh' || entry.spec.nap === 'NAP-MESH')).toBe(false);
    expect(MOCK_NAP_REGISTRY.filter((entry) => entry.spec.nap === 'NAP-LLM').map((entry) => entry.spec.pr)).toEqual([134]);
  });

  it('streams camelCase toolCall blocks and results without a text mirror', () => {
    const queue: Array<() => void> = [];
    const llm = mocks.createMockLlmService({ scheduler: { schedule: (_ms, fn) => { queue.push(fn); return () => {}; } } });
    const sent: Msg[] = [];
    const send = (msg: NappletMessage): void => { sent.push(msg as Msg); };
    llm.handleMessage('w1', { type: 'llm.select', id: 's1' } as NappletMessage, send);
    const handle = (sent[0]?.model as { handle: string }).handle;
    const tool = { name: 'get_weather', parameters: { type: 'object', properties: { city: { type: 'string' } } } };
    const request = { handle, messages: [{ role: 'user', content: [{ type: 'text', text: 'Berlin?' }] }], tools: [tool] };
    llm.handleMessage('w1', { type: 'llm.generate', id: 'g1', request } as unknown as NappletMessage, send);
    while (queue.length > 0) (queue.shift() as () => void)();
    const blocks = sent.filter((msg) => msg.type === 'llm.delta').map((msg) => msg.block);
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.every((block) => block === 'toolCall')).toBe(true);
    expect(sent.at(-1)?.result).not.toHaveProperty('text');
  });

  it('rejects respondWith(..., "toolUse") at compile time and at runtime', () => {
    const llm = mocks.createMockLlmService();
    // @ts-expect-error -- 'toolUse' is not a MockLlmScriptedFinish.
    expect(() => llm.respondWith('x', 'toolUse')).toThrow(TypeError);
    expect(llm.mock.state().scripted).toEqual([]);
  });
});
