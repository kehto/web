/**
 * NAP-WEBRTC (napplet/naps#59 @ fb4dd6f0e6294e1837733d2af61931e3e114bd97),
 * kehto/web#507: two Paja hosts, each with its own NIP-44 signer, join one
 * room through Paja's own Nostr signaling and exchange byte payloads over a
 * real Chromium RTCDataChannel.
 *
 * - Byte payloads: "The shell MUST deliver the decoded bytes to the peer as
 *   one binary payload. It MUST NOT send the base64 text." and "A payload sent
 *   with `sendBytes` MUST be received as a `bytes` event." `send` stays
 *   `message`; "The shell MUST NOT convert between them."
 * - Limits: "A larger payload fails with \"payload too large\"."
 * - "Receivers MUST reject non-canonical encodings."
 */
import { expect, test, type FrameLocator, type Page } from '@playwright/test';
import { generateSecretKey } from 'nostr-tools/pure';
import type { PajaServer } from '../../packages/paja/dist/index.js';
import { installMemoryRelay, type MemoryRelay } from './helpers/memory-relay.js';
import { connectKeySigner, installKeySigner, openFlowTarget, readLog, settleApproving, startFlowRuntime, startFlowTarget, type FlowTarget, type FlowWindow, type TrackedResult } from './helpers/paja-flows.js';
import { installPajaApprovalDriver } from './paja-approval-driver.js';

const RELAY = 'wss://paja-webrtc-bytes.example';
// Local peers need direct host candidates on CI machines without multicast DNS.
test.use({ launchOptions: {
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
  args: ['--disable-features=WebRtcHideLocalIpsWithMdns', '--allow-loopback-in-peer-connection'],
} });

let target: FlowTarget;
let runtime: PajaServer;
test.beforeAll(async () => {
  target = await startFlowTarget(['webrtc']);
  runtime = await startFlowRuntime(target, RELAY);
});
test.afterAll(async () => { await runtime.close(); await target.close(); });

interface Peer { readonly page: Page; readonly frame: FrameLocator; readonly relay: MemoryRelay; readonly pubkey: string; sessionId: string }

async function startPeer(page: Page): Promise<Omit<Peer, 'sessionId'>> {
  const signer = await installKeySigner(page, generateSecretKey(), { installOnLoad: false });
  await installPajaApprovalDriver(page);
  const relay = await installMemoryRelay(page, RELAY);
  const before = await (async () => { await openFlowTarget(page, runtime); return page.evaluate(() => window.__KEHTO_PAJA__!.getState().generation); })();
  await connectKeySigner(page);
  // Advertising webrtc needs a fresh injection (NIP-5D), so the frame reloads once.
  await expect.poll(() => page.evaluate(() => window.__KEHTO_PAJA__!.getState().generation)).toBe(before + 1);
  const frame = page.frameLocator('#napplet-frame');
  await expect.poll(() => frame.locator('body').evaluate(() => typeof (window as unknown as FlowWindow).napplet.webrtc)).toBe('object');
  await expect(frame.locator('#flow-status')).toHaveText('ready');
  return { page, frame, relay, pubkey: signer.pubkey };
}

/** Run one napplet call in the frame and settle it, approving host prompts. */
async function napplet(peer: Peer, key: string, call: string, ...args: unknown[]): Promise<TrackedResult> {
  await peer.frame.locator('body').evaluate((_body, [name, method, params]) => {
    const w = window as unknown as FlowWindow;
    w.__track(name as string, w.napplet.webrtc[method as string](...(params as unknown[])));
  }, [key, call, args] as const);
  return (await settleApproving(peer.page, peer.frame, key)).result;
}

/**
 * Approve host prompts as the user would, for the whole handshake: after
 * `open` returns, Paja still asks before signing each signaling event.
 */
async function keepApproving(peer: Peer): Promise<void> {
  await peer.page.evaluate(() => {
    setInterval(() => {
      const dialog = document.querySelector<HTMLElement>('#paja-confirmation-dialog');
      if (dialog?.checkVisibility()) document.querySelector<HTMLButtonElement>('#paja-confirmation-approve')?.click();
    }, 100);
  });
}

const rtcEvents = (peer: Peer, type: string) => async () => (await readLog(peer.frame, 'rtc') as { type: string }[]).filter((event) => event.type === type);

test('two Paja hosts exchange sendBytes over a real data channel as bytes events', async ({ page, context }) => {
  test.setTimeout(90_000);
  const otherPage = await context.newPage();
  try {
    const a = await startPeer(page) as Peer;
    const b = await startPeer(otherPage) as Peer;
    // One relay between the two pages: each page's publications reach the other's subscriptions.
    a.relay.onPublish((event) => b.relay.store(event));
    b.relay.onPublish((event) => a.relay.store(event));

    for (const peer of [a, b]) {
      await keepApproving(peer);
      await peer.frame.locator('body').evaluate(() => {
        const w = window as unknown as FlowWindow;
        w.napplet.webrtc.onEvent((event: unknown) => w.__push('rtc', event));
      });
    }
    const request = { scope: { type: 'room', room: 'kehto-507-bytes' }, channel: 'bytes' };
    const [openedA, openedB] = await Promise.all([napplet(a, 'open', 'open', request), napplet(b, 'open', 'open', request)]);
    for (const [peer, opened] of [[a, openedA], [b, openedB]] as const) {
      expect(opened, JSON.stringify(opened)).toMatchObject({ ok: true, value: { session: { channel: 'bytes', maxPayloadBytes: 65_536 } } });
      peer.sessionId = (opened as { value: { session: { id: string } } }).value.session.id;
    }
    await expect.poll(rtcEvents(a, 'peer'), { timeout: 30_000 }).toContainEqual(expect.objectContaining({ pubkey: b.pubkey, state: 'joined' }));
    await expect.poll(rtcEvents(b, 'peer'), { timeout: 30_000 }).toContainEqual(expect.objectContaining({ pubkey: a.pubkey, state: 'joined' }));

    expect(await napplet(a, 'bytes', 'sendBytes', a.sessionId, 'AAEC/w==')).toEqual({ ok: true, value: null });
    expect(await napplet(a, 'empty', 'sendBytes', a.sessionId, '')).toEqual({ ok: true, value: null });
    // Base64-looking text sent with `send` stays a JSON message.
    expect(await napplet(a, 'json', 'send', a.sessionId, 'AAEC/w==')).toEqual({ ok: true, value: null });
    expect(await napplet(b, 'back', 'sendBytes', b.sessionId, 'CQgH')).toEqual({ ok: true, value: null });

    await expect.poll(rtcEvents(b, 'bytes'), { timeout: 15_000 }).toEqual([
      { type: 'bytes', sessionId: b.sessionId, from: a.pubkey, bytes: 'AAEC/w==' },
      { type: 'bytes', sessionId: b.sessionId, from: a.pubkey, bytes: '' },
    ]);
    await expect.poll(rtcEvents(b, 'message'), { timeout: 15_000 }).toEqual([{ type: 'message', sessionId: b.sessionId, from: a.pubkey, payload: 'AAEC/w==' }]);
    await expect.poll(rtcEvents(a, 'bytes'), { timeout: 15_000 }).toEqual([{ type: 'bytes', sessionId: a.sessionId, from: b.pubkey, bytes: 'CQgH' }]);
    expect(await rtcEvents(a, 'message')()).toEqual([]);

    const oversized = await page.evaluate(() => btoa(String.fromCharCode(...new Uint8Array(65_537))));
    expect(await napplet(a, 'big', 'sendBytes', a.sessionId, oversized)).toEqual({ ok: false, error: 'payload too large' });
    expect(await napplet(a, 'bad', 'sendBytes', a.sessionId, 'AAEC/x==')).toEqual({ ok: false, error: 'invalid request' });

    // Payloads travel only over the data channel, never through signaling.
    for (const event of [...a.relay.published, ...b.relay.published]) expect(event.content).not.toContain('AAEC/w==');
    expect(await napplet(a, 'close', 'close', a.sessionId)).toEqual({ ok: true, value: null });
  } finally { await otherPage.close(); await page.goto('about:blank'); }
});
