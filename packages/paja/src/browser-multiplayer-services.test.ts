import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import { PAJA_CVM_OPERATIONS, createPajaMultiplayerServices } from './browser-multiplayer-services.js';
import type { PajaMultiplayerConfig } from './multiplayer-config.js';

// kehto/web#465. NIP-5D (nostr-protocol/nips#2303 @ dskvr/nips@f60550c3):
// "Messages with an unrecognized `type` MUST be silently ignored." NAP-CVM #31
// @ 28cf1bdb: "Truly unknown message types retain the silent-ignore behavior
// defined by NIP-5D." The unscoped base used to answer `unsupported`.
describe('createPajaMultiplayerServices unknown types', () => {
  const build = () => createPajaMultiplayerServices({
    config: { relays: [] } as unknown as PajaMultiplayerConfig,
    registry: [],
    scopeKey: () => 'scope',
    namespace: () => undefined,
    backend: () => { throw new Error('a known operation would need a backend'); },
  });

  it('scopes every napplet request NAP-CVM defines', () => {
    expect([...PAJA_CVM_OPERATIONS].sort()).toEqual(['cvm.close', 'cvm.discover', 'cvm.registry.call', 'cvm.registry.describe',
      'cvm.registry.has', 'cvm.registry.list', 'cvm.request']);
  });

  it.each(['cvm.bogus', 'cvm.request.result', 'webrtc.bogus', 'webrtc.stats'])('ignores %s without a reply', (type) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { cvm, webrtc } = build();
    const sent: NappletMessage[] = [];
    const service = type.startsWith('cvm.') ? cvm : webrtc;
    service.handleMessage('w1', { type, id: 'probe' } as NappletMessage, (message) => sent.push(message));
    expect(sent).toEqual([]);
    expect(warn.mock.calls.some(([line]) => String(line).includes('[KEHTO_UNRECOGNIZED_MESSAGE_TYPE]'))).toBe(true);
    warn.mockRestore();
  });
});

// kehto/web#507. NAP-WEBRTC (napplet/naps#59 @ fb4dd6f0): "A shell that does
// not support byte payloads returns the error `unsupported`." The documented
// soy-rtc/1 profile carries JSON only (docs/paja-multiplayer.md), so its
// `webrtc.sendBytes` stays on the hookless base service and answers that.
describe('createPajaMultiplayerServices byte payloads', () => {
  it('answers webrtc.sendBytes with unsupported and never reaches a backend', () => {
    const { webrtc } = createPajaMultiplayerServices({
      config: { relays: [] } as unknown as PajaMultiplayerConfig,
      registry: [],
      scopeKey: () => 'scope',
      namespace: () => undefined,
      backend: () => { throw new Error('sendBytes must not need a backend'); },
    });
    const sent: NappletMessage[] = [];
    webrtc.handleMessage('w1', { type: 'webrtc.sendBytes', id: 'b1', sessionId: 's1', bytes: 'AAEC/w==' } as NappletMessage, (message) => sent.push(message));
    expect(sent).toEqual([{ type: 'webrtc.sendBytes.result', id: 'b1', error: 'unsupported' }]);
  });
});
