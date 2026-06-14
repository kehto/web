/**
 * upload-dispatch.test.ts — NAP-UPLOAD (shell-mediated file/blob upload) runtime dispatch.
 *
 * Verifies the `upload` domain is routed by the runtime to a registered
 * `upload` service (the registerNub lesson — registering the service alone is
 * not enough; the domain must also be wired in createNubEnvelopeDispatcher),
 * and that the ACL gate denies `upload.upload` for a blocked napplet.
 *
 * NAP-UPLOAD imposes no NAP-CLASS posture: a restricted (class-2) napplet may
 * still upload. Upload guardrails (consent, quotas, allowed rails) are runtime/
 * shell policy behind the Uploader seam, not a class-authority concern.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRuntime } from './runtime.js';
import type { Runtime } from './runtime.js';
import { createMockRuntimeAdapter, createNip5dSessionEntry, findEnvelopeResponse } from './test-utils.js';
import type { MockRuntimeContext } from './test-utils.js';
import type { NappletMessage } from '@napplet/core';

const WINDOW_ID = 'win-upload-1';
const DTAG = 'upload-napp';
const HASH = 'd'.repeat(64);

function session(windowId = WINDOW_ID) {
  return createNip5dSessionEntry(windowId, DTAG, HASH);
}

describe('runtime upload domain dispatch', () => {
  let ctx: MockRuntimeContext;
  let runtime: Runtime;

  beforeEach(() => {
    ctx = createMockRuntimeAdapter();
    runtime = createRuntime(ctx.hooks);
    runtime.sessionRegistry.register(WINDOW_ID, session());
  });

  it('routes upload.upload to a registered upload service (registerNub wiring)', () => {
    const received: NappletMessage[] = [];
    runtime.registerService('upload', {
      descriptor: { name: 'upload', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });

    runtime.handleMessage(WINDOW_ID, {
      type: 'upload.upload',
      id: 'u1',
      request: { data: new ArrayBuffer(8), filename: 'x.bin' },
    } as NappletMessage);

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('upload.upload');
  });

  it('routes upload.status to the service', () => {
    const received: NappletMessage[] = [];
    runtime.registerService('upload', {
      descriptor: { name: 'upload', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });

    runtime.handleMessage(WINDOW_ID, { type: 'upload.status', id: 's1', uploadId: 'up-1' } as NappletMessage);

    expect(received.map((m) => m.type)).toEqual(['upload.status']);
  });

  it('upload.upload without a registered service: no throw, no envelope emitted (silent drop)', () => {
    expect(() => {
      runtime.handleMessage(WINDOW_ID, {
        type: 'upload.upload',
        id: 'u2',
        request: { data: new ArrayBuffer(8) },
      } as NappletMessage);
    }).not.toThrow();
    expect(ctx.sent).toHaveLength(0);
  });

  it('denies upload.upload for a blocked napplet (ACL gate → upload.upload.error)', () => {
    const received: NappletMessage[] = [];
    runtime.registerService('upload', {
      descriptor: { name: 'upload', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });
    runtime.aclState.block('', DTAG, HASH);

    runtime.handleMessage(WINDOW_ID, {
      type: 'upload.upload',
      id: 'u3',
      request: { data: new ArrayBuffer(8) },
    } as NappletMessage);

    expect(received).toHaveLength(0); // service never reached
    const err = findEnvelopeResponse(ctx.sent, 'upload.upload.error');
    expect(err).toBeDefined();
    expect((err as { id?: string }).id).toBe('u3');
  });

  it('allows upload.upload for a class-2 napplet (NAP-UPLOAD imposes no class restriction)', () => {
    const received: NappletMessage[] = [];
    runtime.registerService('upload', {
      descriptor: { name: 'upload', version: '1.0.0' },
      handleMessage(_wid, msg) { received.push(msg); },
    });
    runtime.sessionRegistry.register(WINDOW_ID, { ...session(), class: 'class-2' });

    runtime.handleMessage(WINDOW_ID, {
      type: 'upload.upload',
      id: 'u4',
      request: { data: new ArrayBuffer(8) },
    } as NappletMessage);

    expect(received).toHaveLength(1); // upload is not a class-gated capability
    expect(received[0].type).toBe('upload.upload');
  });
});
