/**
 * llm-dispatch.test.ts — NAP-LLM runtime dispatch.
 *
 * Authority: napplet/naps PR #134 (`nap-llm`) at
 * 3e10939cf788878bbdcc022c101f0ac6193f316c. The runtime routes `llm.*` to one
 * registered `llm` service, answers with a shaped `unsupported` result when the
 * advertised domain has no service, and shapes ACL denials on the NAP result
 * wire rather than a bare `.error` string.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import { createRuntime, type Runtime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry, findEnvelopeResponse, type MockRuntimeContext } from './test-utils.js';
import { createLlmErrorResult } from './domain-results.js';

const WINDOW_ID = 'win-llm-1';
const DTAG = 'llm-napp';
const HASH = 'd'.repeat(64);

describe('runtime llm domain dispatch', () => {
  let ctx: MockRuntimeContext;
  let runtime: Runtime;

  beforeEach(() => {
    ctx = createMockRuntimeAdapter();
    runtime = createRuntime(ctx.hooks);
    runtime.sessionRegistry.register(WINDOW_ID, createNip5dSessionEntry(WINDOW_ID, DTAG, HASH));
  });

  it.each(['llm.select', 'llm.describe', 'llm.generate', 'llm.cancel'])('routes %s to the registered llm service', (type) => {
    const received: NappletMessage[] = [];
    runtime.registerService('llm', {
      descriptor: { name: 'llm', version: '1.0.0' },
      handleMessage(_wid, msg, send) { received.push(msg); send({ type: `${msg.type}.result`, id: 'x' } as NappletMessage); },
    });
    runtime.handleMessage(WINDOW_ID, { type, id: 'r1', handle: 'h1', requestId: 'g1', request: {} } as NappletMessage);
    expect(received.map((m) => m.type)).toEqual([type]);
    expect(ctx.sent.map((entry) => (entry.message as NappletMessage).type)).toEqual([`${type}.result`]);
  });

  it('answers every request type with a shaped unsupported result when no service is registered', () => {
    for (const type of ['llm.select', 'llm.describe', 'llm.generate', 'llm.cancel']) {
      runtime.handleMessage(WINDOW_ID, { type, id: `${type}-id` } as NappletMessage);
      const result = findEnvelopeResponse(ctx.sent, `${type}.result`) as { id?: string; error?: { code?: string; message?: string } } | undefined;
      expect(result?.id).toBe(`${type}-id`);
      expect(result?.error?.code).toBe('unsupported');
      expect(result?.error?.message).not.toContain('undefined');
    }
    expect(ctx.sent).toHaveLength(4);
  });

  it('ignores forged result and delta envelopes from a napplet without a service', () => {
    runtime.handleMessage(WINDOW_ID, { type: 'llm.generate.result', id: 'g1', result: { text: 'x', finish: 'stop' } } as NappletMessage);
    runtime.handleMessage(WINDOW_ID, { type: 'llm.delta', requestId: 'g1', sequence: 0, text: 'x' } as NappletMessage);
    expect(ctx.sent).toHaveLength(0);
  });

  it('denies a blocked napplet on the NAP result wire with code unsupported', () => {
    const received: NappletMessage[] = [];
    runtime.registerService('llm', {
      descriptor: { name: 'llm', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });
    runtime.aclState.block('', DTAG, HASH);
    runtime.handleMessage(WINDOW_ID, { type: 'llm.generate', id: 'g2', request: { handle: 'h', messages: [] } } as NappletMessage);
    expect(received).toHaveLength(0);
    expect(findEnvelopeResponse(ctx.sent, 'llm.generate.error')).toBeUndefined();
    const denial = findEnvelopeResponse(ctx.sent, 'llm.generate.result') as { id?: string; error?: { code?: string; message?: string } } | undefined;
    expect(denial?.id).toBe('g2');
    expect(denial?.error?.code).toBe('unsupported');
    expect(denial?.error?.message).toContain('llm:generate');
  });

  it('does not route llm messages from an unregistered window', () => {
    const received: NappletMessage[] = [];
    runtime.registerService('llm', { descriptor: { name: 'llm', version: '1.0.0' }, handleMessage(_wid, msg) { received.push(msg); } });
    runtime.handleMessage('stranger', { type: 'llm.select', id: 's1' } as NappletMessage);
    expect(received).toHaveLength(0);
    expect(ctx.sent).toHaveLength(0);
  });
});

describe('createLlmErrorResult', () => {
  it('shapes only sanctioned request types and tolerates a missing id', () => {
    expect(createLlmErrorResult({ type: 'llm.cancel' } as NappletMessage, 'unsupported', 'nope'))
      .toEqual({ type: 'llm.cancel.result', id: '', error: { code: 'unsupported', message: 'nope' } });
    expect(createLlmErrorResult({ type: 'llm.cancel', id: 7 } as unknown as NappletMessage, 'unsupported', 'nope'))
      .toMatchObject({ id: '' });
    for (const type of ['llm.delta', 'llm.generate.result', 'llm.unknown', 'relay.subscribe']) {
      expect(createLlmErrorResult({ type } as NappletMessage, 'unsupported', 'nope')).toBeUndefined();
    }
  });
});
