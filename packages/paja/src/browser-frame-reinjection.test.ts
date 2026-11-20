/**
 * kehto/web#487: a signer change reloads a Paja frame only when the advertised
 * domain set changes what that frame would be injected (NIP-5D), never for the
 * identity change itself (NAP-IDENTITY napplet/naps master 377bf939).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { originRegistry } from '@kehto/shell';
import {
  createPajaReinjectionGate,
  diffPajaDomains,
  pajaFrameNeedsReinjection,
  recordPajaFrameDeclarations,
} from './browser-frame-reinjection.js';

function mountedFrame(admitted: readonly string[], windowId = 'paja:1'): HTMLIFrameElement {
  const win = { postMessage() {} } as unknown as Window;
  originRegistry.register(win, windowId, { dTag: 'd', aggregateHash: 'a'.repeat(64) });
  originRegistry.setEnvironment(win, { capabilities: { domains: admitted }, services: [] });
  return { contentWindow: win } as unknown as HTMLIFrameElement;
}

afterEach(() => { originRegistry.clear(); });

describe('Paja frame re-injection gate', () => {
  it('diffs advertised domain lists', () => {
    expect(diffPajaDomains(['relay', 'dm'], ['relay', 'webrtc'])).toEqual({ added: ['webrtc'], removed: ['dm'] });
  });

  it('keeps a frame whose declarations the change does not touch', () => {
    const frame = mountedFrame(['shell', 'identity']);
    recordPajaFrameDeclarations(frame, ['shell'], ['identity'], true);
    expect(pajaFrameNeedsReinjection(frame, { added: ['webrtc', 'dm'], removed: [] })).toBe(false);
    expect(pajaFrameNeedsReinjection(frame, { added: [], removed: ['upload'] })).toBe(false);
    expect(pajaFrameNeedsReinjection(frame, { added: [], removed: [] })).toBe(false);
  });

  it('reloads for an added domain the napplet declared', () => {
    const frame = mountedFrame(['identity']);
    recordPajaFrameDeclarations(frame, [], ['identity', 'webrtc'], true);
    expect(pajaFrameNeedsReinjection(frame, { added: ['webrtc'], removed: [] })).toBe(true);
  });

  it('reloads for a removed domain the frame was admitted', () => {
    const frame = mountedFrame(['identity', 'webrtc']);
    recordPajaFrameDeclarations(frame, [], ['identity', 'webrtc'], true);
    expect(pajaFrameNeedsReinjection(frame, { added: [], removed: ['webrtc'] })).toBe(true);
  });

  it('treats a napplet that declared nothing as asking for every domain', () => {
    const frame = mountedFrame(['identity', 'relay']);
    recordPajaFrameDeclarations(frame, [], [], false);
    expect(pajaFrameNeedsReinjection(frame, { added: ['dm'], removed: [] })).toBe(true);
  });

  it('fails safe to a reload when no committed napplet or record exists', () => {
    const change = { added: ['webrtc'], removed: [] };
    expect(pajaFrameNeedsReinjection(null, change)).toBe(true);
    expect(pajaFrameNeedsReinjection({ contentWindow: {} } as unknown as HTMLIFrameElement, change)).toBe(true);
    expect(pajaFrameNeedsReinjection(mountedFrame(['identity']), change)).toBe(true);
  });

  it('compares against the last advertised set and reloads without a baseline', () => {
    let domains = ['shell', 'identity'];
    const gate = createPajaReinjectionGate(() => domains);
    const frame = mountedFrame(['shell', 'identity']);
    recordPajaFrameDeclarations(frame, ['shell'], ['identity'], true);
    expect(gate.shouldReload(frame)).toBe(true);
    gate.snapshot();
    domains = ['shell', 'identity', 'webrtc'];
    expect(gate.shouldReload(frame)).toBe(false);
    // The baseline moved: a later identity-only change compares against it.
    expect(gate.shouldReload(frame)).toBe(false);
  });
});
