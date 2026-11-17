import { describe, expect, it, vi } from 'vitest';
import { createRuntime, type ServiceHandler } from '@kehto/runtime';
import { createMockRuntimeAdapter } from '../../packages/runtime/src/test-utils.js';
import { trackPajaServices } from '../../packages/paja/src/browser-service-registration.js';

describe('Paja service availability changes', () => {
  it('attaches new handlers once and retires removed or replaced handlers', () => {
    const handler = (): ServiceHandler => ({
      descriptor: { name: 'webrtc', version: '1', description: 'test' },
      handleMessage: vi.fn(), onRegistered: vi.fn(), onUnregistered: vi.fn(),
    });
    const first = handler(), second = handler();
    const runtime = createRuntime(createMockRuntimeAdapter().hooks);
    const sync = trackPajaServices(runtime, {});
    sync({ webrtc: first });
    sync({ webrtc: first });
    expect(first.onRegistered).toHaveBeenCalledTimes(1);
    expect(first.onUnregistered).not.toHaveBeenCalled();
    sync({ webrtc: second });
    expect(first.onUnregistered).toHaveBeenCalledTimes(1);
    expect(second.onRegistered).toHaveBeenCalledTimes(1);
    sync({});
    sync({});
    expect(second.onUnregistered).toHaveBeenCalledTimes(1);
    runtime.destroy();
  });
});
