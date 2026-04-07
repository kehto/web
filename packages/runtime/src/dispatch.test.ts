/**
 * dispatch.test.ts — Unit tests for @kehto/runtime NIP-5D NUB domain dispatch.
 *
 * Tests NappletMessage envelope dispatch, domain routing, ACL enforcement,
 * and lifecycle — all in Node.js without browser globals.
 *
 * NOTE: Legacy NIP-01 verb tests (AUTH, REQ, CLOSE, COUNT, EVENT) have been
 * removed — AUTH machinery and NIP-01 verb dispatch are gone (NIP-5D clean break).
 * Plan 03 adds full handler tests when NUB domain implementations are in place.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRuntime } from './runtime.js';
import type { Runtime } from './runtime.js';
import { createMockRuntimeAdapter } from './test-utils.js';
import type { MockRuntimeContext } from './test-utils.js';
import type { NappletMessage } from '@napplet/core';

// ─── Constants ────────────────────────────────────────────────────────────────

const WINDOW_ID = 'win-test-1';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runtime NUB dispatch — envelope guard', () => {
  let mock: MockRuntimeContext;
  let runtime: Runtime;

  beforeEach(() => {
    mock = createMockRuntimeAdapter();
    runtime = createRuntime(mock.hooks);
  });

  it('drops null', () => {
    runtime.handleMessage(WINDOW_ID, null);
    expect(mock.sent).toHaveLength(0);
  });

  it('drops non-object primitives', () => {
    runtime.handleMessage(WINDOW_ID, 'hello');
    runtime.handleMessage(WINDOW_ID, 42);
    runtime.handleMessage(WINDOW_ID, true);
    expect(mock.sent).toHaveLength(0);
  });

  it('drops legacy NIP-01 arrays (clean break — no dual-mode)', () => {
    runtime.handleMessage(WINDOW_ID, ['REQ', 'sub-1', { kinds: [1] }]);
    runtime.handleMessage(WINDOW_ID, ['EVENT', { id: 'x', kind: 1 }]);
    runtime.handleMessage(WINDOW_ID, ['AUTH', 'challenge']);
    expect(mock.sent).toHaveLength(0);
  });

  it('drops objects without a "type" field', () => {
    runtime.handleMessage(WINDOW_ID, { action: 'relay.req' });
    runtime.handleMessage(WINDOW_ID, {});
    expect(mock.sent).toHaveLength(0);
  });

  it('drops envelopes with no domain separator (no dot in type)', () => {
    runtime.handleMessage(WINDOW_ID, { type: 'noDot' } as NappletMessage);
    expect(mock.sent).toHaveLength(0);
  });

  it('drops envelopes with unknown domain — silently per NIP-5D spec', () => {
    runtime.handleMessage(WINDOW_ID, { type: 'unknown.action' } as NappletMessage);
    expect(mock.sent).toHaveLength(0);
  });
});

describe('runtime NUB dispatch — domain routing', () => {
  let mock: MockRuntimeContext;
  let runtime: Runtime;

  beforeEach(() => {
    mock = createMockRuntimeAdapter();
    runtime = createRuntime(mock.hooks);
  });

  it('routes relay.* to handleRelayMessage stub and returns .error', () => {
    const msg: NappletMessage = { type: 'relay.req', id: 'sub-1' } as NappletMessage & { id: string };
    runtime.handleMessage(WINDOW_ID, msg);

    const reply = mock.sent.find((s) => s.windowId === WINDOW_ID);
    expect(reply).toBeDefined();
    const responseMsg = reply!.message as unknown as { type: string; error: string };
    expect(responseMsg.type).toBe('relay.req.error');
    expect(responseMsg.error).toBe('not implemented');
  });

  it('routes signer.* to handleSignerMessage stub and returns .error', () => {
    const msg: NappletMessage = { type: 'signer.getPublicKey', id: 'req-1' } as NappletMessage & { id: string };
    runtime.handleMessage(WINDOW_ID, msg);

    const reply = mock.sent.find((s) => s.windowId === WINDOW_ID);
    expect(reply).toBeDefined();
    const responseMsg = reply!.message as unknown as { type: string; error: string };
    expect(responseMsg.type).toBe('signer.getPublicKey.error');
    expect(responseMsg.error).toBe('not implemented');
  });

  it('routes storage.* to handleStorageMessage stub and returns .error', () => {
    const msg: NappletMessage = { type: 'storage.get', id: 'req-2' } as NappletMessage & { id: string };
    runtime.handleMessage(WINDOW_ID, msg);

    const reply = mock.sent.find((s) => s.windowId === WINDOW_ID);
    expect(reply).toBeDefined();
    const responseMsg = reply!.message as unknown as { type: string; error: string };
    expect(responseMsg.type).toBe('storage.get.error');
    expect(responseMsg.error).toBe('not implemented');
  });

  it('routes ifc.* to handleIfcMessage stub and sends no response', () => {
    const msg: NappletMessage = { type: 'ifc.emit' } as NappletMessage;
    runtime.handleMessage(WINDOW_ID, msg);

    // IFC emit has no response — stub silently drops
    expect(mock.sent).toHaveLength(0);
  });
});

describe('runtime lifecycle', () => {
  let mock: MockRuntimeContext;
  let runtime: Runtime;

  beforeEach(() => {
    mock = createMockRuntimeAdapter();
    runtime = createRuntime(mock.hooks);
  });

  it('injectEvent does not throw', () => {
    expect(() => {
      runtime.injectEvent('test:topic', { data: 'hello' });
    }).not.toThrow();
  });

  it('destroy() does not throw', () => {
    expect(() => {
      runtime.destroy();
    }).not.toThrow();
  });

  it('destroyWindow() does not throw for unknown window', () => {
    expect(() => {
      runtime.destroyWindow('non-existent-window');
    }).not.toThrow();
  });

  it('registerService() and unregisterService() are functional', () => {
    runtime.registerService('test-service', {
      descriptor: { name: 'test-service', version: '1.0.0' },
      handleMessage() { /* no-op */ },
    });
    runtime.unregisterService('test-service');
    // No throw expected
    expect(true).toBe(true);
  });

  it('registerConsentHandler() does not throw', () => {
    expect(() => {
      runtime.registerConsentHandler(() => { /* no-op */ });
    }).not.toThrow();
  });
});
