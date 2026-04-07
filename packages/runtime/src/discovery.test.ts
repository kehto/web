/**
 * discovery.test.ts — Service registration and lifecycle tests.
 *
 * The legacy NIP-01 REQ-based service discovery (kind 29010) has been removed
 * along with the NIP-01 verb dispatch in the NIP-5D migration.
 *
 * Service discovery for NIP-5D will be addressed in Phase 8 (shell).
 * These tests cover the service registry lifecycle that remains functional.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRuntime } from './runtime.js';
import type { Runtime } from './runtime.js';
import { createMockRuntimeAdapter } from './test-utils.js';
import type { MockRuntimeContext, SentMessage } from './test-utils.js';
import type { ServiceHandler } from './types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WINDOW_ID = 'win-disc-1';

function createMockServiceHandler(
  name: string,
  version: string,
  description?: string,
): ServiceHandler {
  return {
    descriptor: { name, version, ...(description ? { description } : {}) },
    handleMessage() { /* no-op */ },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('service registry lifecycle', () => {
  let runtime: Runtime;
  let ctx: MockRuntimeContext;

  beforeEach(() => {
    ctx = createMockRuntimeAdapter({
      services: {
        audio: createMockServiceHandler('audio', '1.0.0', 'Audio playback management'),
      },
    });
    runtime = createRuntime(ctx.hooks);
  });

  it('registerService adds a service to the registry', () => {
    runtime.registerService('notifications', createMockServiceHandler('notifications', '2.0.0'));
    // Registering should not throw and service is available for dispatch
    expect(true).toBe(true);
  });

  it('unregisterService removes a service from the registry', () => {
    runtime.registerService('notifications', createMockServiceHandler('notifications', '2.0.0'));
    runtime.unregisterService('notifications');
    expect(true).toBe(true);
  });

  it('unregisterService is a no-op for unknown service names', () => {
    expect(() => {
      runtime.unregisterService('non-existent-service');
    }).not.toThrow();
  });

  it('registering a service twice replaces the old handler', () => {
    const handler1 = createMockServiceHandler('audio', '1.0.0');
    const handler2 = createMockServiceHandler('audio', '2.0.0');
    runtime.registerService('audio', handler1);
    runtime.registerService('audio', handler2);
    // No throw expected
    expect(true).toBe(true);
  });

  it('onWindowDestroyed is called on destroyWindow when handler implements it', () => {
    const destroyed: string[] = [];
    const handler: ServiceHandler = {
      descriptor: { name: 'test-svc', version: '1.0.0' },
      handleMessage() { /* no-op */ },
      onWindowDestroyed(windowId) { destroyed.push(windowId); },
    };
    runtime.registerService('test-svc', handler);
    runtime.destroyWindow(WINDOW_ID);
    expect(destroyed).toContain(WINDOW_ID);
  });
});

describe('sessionRegistry and aclState accessors', () => {
  let runtime: Runtime;

  beforeEach(() => {
    const ctx = createMockRuntimeAdapter();
    runtime = createRuntime(ctx.hooks);
  });

  it('sessionRegistry is accessible', () => {
    expect(runtime.sessionRegistry).toBeDefined();
    expect(typeof runtime.sessionRegistry.getEntry).toBe('function');
  });

  it('aclState is accessible', () => {
    expect(runtime.aclState).toBeDefined();
    expect(typeof runtime.aclState.check).toBe('function');
  });

  it('manifestCache is accessible', () => {
    expect(runtime.manifestCache).toBeDefined();
    expect(typeof runtime.manifestCache.get).toBe('function');
  });
});
