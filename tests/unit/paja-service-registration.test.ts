import { describe, expect, it, vi } from 'vitest';
import { createRuntime, type ServiceHandler } from '@kehto/runtime';
import { createMockRuntimeAdapter, createNip5dSessionEntry, findEnvelopeResponse } from '../../packages/runtime/src/test-utils.js';
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

  // kehto/web#428: Paja only creates the webrtc service once a signer makes
  // signaling available, which is after createRuntime copied the adapter's
  // services. The synchronizer has to carry that late entry into routing.
  it('routes webrtc.open once a signer-gated service appears and stops when it goes', () => {
    const ctx = createMockRuntimeAdapter();
    const runtime = createRuntime(ctx.hooks);
    runtime.sessionRegistry.register('w1', createNip5dSessionEntry('w1', 'app', 'a'.repeat(64)));
    const adapterServices: Record<string, ServiceHandler> = {};
    const sync = trackPajaServices(runtime, adapterServices);
    const webrtc: ServiceHandler = {
      descriptor: { name: 'webrtc', version: '1', description: 'test' },
      handleMessage: vi.fn((_windowId, message, send) => {
        send({ type: 'webrtc.open.result', id: (message as { id?: string }).id, error: 'signaling unavailable' });
      }),
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      // Signer connects: refreshAvailability() adds the service, then syncs.
      adapterServices.webrtc = webrtc;
      expect(runtime.hasService('webrtc')).toBe(false);
      sync(adapterServices);
      expect(runtime.hasService('webrtc')).toBe(true);
      runtime.handleMessage('w1', { type: 'webrtc.open', id: 'open-1' });
      expect(webrtc.handleMessage).toHaveBeenCalledTimes(1);
      expect(findEnvelopeResponse(ctx.sent, 'webrtc.open.result')).toEqual(
        { type: 'webrtc.open.result', id: 'open-1', error: 'signaling unavailable' });

      // Signer disconnects: the entry is deleted and routing follows.
      delete adapterServices.webrtc;
      sync(adapterServices);
      expect(runtime.hasService('webrtc')).toBe(false);
      runtime.handleMessage('w1', { type: 'webrtc.open', id: 'open-2' });
      expect(webrtc.handleMessage).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
      runtime.destroy();
    }
  });
});
