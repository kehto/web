import { describe, expect, it, vi } from 'vitest';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { createPajaWebrtcProfile } from './browser-webrtc-profile.js';
import type { NostrEvent } from '@napplet/core';

describe('soy-rtc/1 host profile boundaries', () => {
  it('authenticates hello, separates namespaces and delivery, and stops on revocation', async () => {
    vi.useFakeTimers();
    const candidates = [generateSecretKey(), generateSecretKey()].sort((a, b) => getPublicKey(a).localeCompare(getPublicKey(b)));
    const other = candidates[0]!, key = candidates[1]!;
    const pc = Object.assign(new EventTarget(), { close: vi.fn() });
    const createPeer = vi.fn(() => pc as unknown as RTCPeerConnection);
    let receive!: (event: NostrEvent) => void;
    const unsubscribe = vi.fn();
    const published: NostrEvent[] = [];
    let current = true;
    const controller = new AbortController();
    const hooks = createPajaWebrtcProfile({ secretKey: key, namespace: 'author:35129:game', relays: ['wss://signal.example'],
      isCurrent: () => current, createPeer, relay: {
        subscribe(_relays, _filters, fn) { receive = fn; return { close: unsubscribe }; },
        async publish(_relays, event) { published.push(event); },
      },
    });
    const context = { windowId: 'one', signal: controller.signal, emit: vi.fn() };
    try {
      const request = { scope: { type: 'room' as const, room: 'code' }, channel: 'game', protocol: 'v1' };
      const opened = await hooks.open!(request, context, hooks.planOpen!(request, context));
      expect(opened.session).toMatchObject({ ordered: true, maxPayloadBytes: 16384 });
      await vi.advanceTimersByTimeAsync(1);
      const wire = 'db17996f4d64049e148164c0da0baee1b93a0a3b4c23d0ded9514c3e52b50215';
      expect(published[0]!.tags).toContainEqual(['d', wire]);
      expect(published[0]!.pubkey).toBe(getPublicKey(key));
      const hello = (extra = {}, tag = wire) => finalizeEvent({ kind: 25050, created_at: Math.floor(Date.now() / 1000), tags: [['d', tag]],
        content: JSON.stringify({ v: 'soy-rtc/1', wire, nonce: crypto.randomUUID(), type: 'hello', ...extra }) }, other);
      receive(hello({}, 'wrong-namespace'));
      receive(hello({ realtime: { profile: 'soy-rtc/realtime-1', ordered: false, maxRetransmits: 0 } }));
      const spoof = JSON.parse(JSON.stringify(hello())); receive({ ...spoof, pubkey: getPublicKey(generateSecretKey()) });
      await vi.advanceTimersByTimeAsync(1);
      expect(createPeer).not.toHaveBeenCalled();
      // Key ordering makes the independent remote peer offer.
      receive(hello()); await vi.advanceTimersByTimeAsync(1);
      expect(createPeer).toHaveBeenCalledTimes(1);
      controller.abort(); current = false;
      const count = published.length;
      receive(hello()); await vi.advanceTimersByTimeAsync(6000);
      expect(published).toHaveLength(count);
      expect(unsubscribe).toHaveBeenCalledTimes(1);
      expect(() => hooks.send!(opened.session.id, {}, context)).toThrow('session not found');
      await expect(hooks.open!(request, context, hooks.planOpen!(request, context))).rejects.toThrow();
    } finally { hooks.destroyWindow!('one'); vi.useRealTimers(); }
  });
});
