/** Independent soy-rtc/1 wire peer plus real CVM gift wraps; no production provider fixtures. */
import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent, type NostrEvent } from 'nostr-tools/pure';
import * as nip44 from 'nostr-tools/nip44';
import { startPajaServer } from '../../packages/paja/dist/index.js';
import { installMemoryRelay } from './helpers/memory-relay.js';
import { openFlowTarget, settleApproving, startFlowTarget, type FlowWindow } from './helpers/paja-flows.js';
import { installPajaApprovalDriver } from './paja-approval-driver.js';

const RELAY = 'wss://multiplayer-test.example';
const tool = { name: 'get_weather', inputSchema: { properties: { location: { type: 'string' } }, required: ['location'] }, outputSchema: { properties: { temperature: { type: 'number' } }, required: ['temperature'] } };
// Published CEP-15 worked example, independently derived from its JCS bytes.
const HASH = 'c042f92e9ab085590656cea78e2628d44ffed49ea8da90aa32e208155fedd84e';

// Local fixture peers need direct host candidates on CI machines without multicast DNS.
test.use({ launchOptions: {
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
  args: ['--disable-features=WebRtcHideLocalIpsWithMdns', '--allow-loopback-in-peer-connection'],
} });

test('configured registry and independent peer share authenticated transport identity without a user signer', async ({ page, context }) => {
  test.setTimeout(60000);
  const key = generateSecretKey(), server = getPublicKey(key);
  const target = await startFlowTarget(['webrtc', 'cvm']);
  const runtime = await startPajaServer({ options: { targetUrl: target.url, port: 0,
    simulation: { relay: { mode: 'live', urls: [RELAY] }, multiplayer: {
      profile: 'soy-rtc/1', relays: [RELAY], developmentNamespace: 'test:35129:fixture',
      registry: [{ family: 'weather.v1', server: { pubkey: server, relays: [RELAY] }, tools: [{ name: tool.name, schemaHash: HASH }] }],
    } },
  } });
  const peerPage = await context.newPage();
  const peerKey = generateSecretKey(), peerPubkey = getPublicKey(peerKey);
  const nonce = 'independent-peer';
  const wire = createHash('sha256').update(JSON.stringify(['soy-rtc/1', 'test:35129:fixture', ['room', 'room-code'], 'game', 'test/1'])).digest('hex');
  const clients = new Set<string>();
  const errors: string[] = [];
  try {
    await installPajaApprovalDriver(page);
    const relay = await installMemoryRelay(page, RELAY);
    let remote: { key: string; nonce: string } | undefined;
    let chain = Promise.resolve();
    await peerPage.goto(target.url);
    await peerPage.evaluate(() => {
      const w = window as any;
      w.pc = new RTCPeerConnection({ iceServers: [] }); w.messages = [];
      w.attach = (c: RTCDataChannel) => { w.channel = c; c.onmessage = (e: MessageEvent) => w.messages.push(JSON.parse(e.data)); };
      w.pc.ondatachannel = (e: RTCDataChannelEvent) => w.attach(e.channel);
      w.sdp = async (type: 'offer' | 'answer') => {
        if (type === 'offer') w.attach(w.pc.createDataChannel('game', { ordered: true }));
        await w.pc.setLocalDescription(await (type === 'offer' ? w.pc.createOffer() : w.pc.createAnswer()));
        if (w.pc.iceGatheringState !== 'complete') await new Promise<void>(resolve => { w.pc.onicegatheringstatechange = () => { if (w.pc.iceGatheringState === 'complete') resolve(); }; });
        return w.pc.localDescription.sdp;
      };
    });
    const signal = (body: Record<string, unknown>, recipient?: string) => {
      const raw = JSON.stringify({ v: 'soy-rtc/1', wire, nonce, ...body });
      relay.store(finalizeEvent({ kind: 25050, created_at: Math.floor(Date.now() / 1000), tags: [['d', wire], ...(recipient ? [['p', recipient]] : [])],
        content: recipient ? nip44.encrypt(raw, nip44.getConversationKey(peerKey, recipient)) : raw }, peerKey));
    };
    relay.onPublish(event => {
      if ([21059, 1059].includes(event.kind) && event.tags.some(t => t[0] === 'p' && t[1] === server)) {
        const inner = JSON.parse(nip44.decrypt(event.content, nip44.getConversationKey(key, event.pubkey))) as NostrEvent;
        if (!verifyEvent(inner)) throw new Error('Invalid CVM signature');
        clients.add(inner.pubkey);
        const message = JSON.parse(inner.content);
        if (message.id === undefined) return;
        const result = message.method === 'initialize' ? { protocolVersion: '2025-11-25', capabilities: { tools: {} }, serverInfo: { name: 'fixture', version: '1' } }
          : message.method === 'tools/list' ? { tools: [tool] } : { content: [], structuredContent: { actor: inner.pubkey } };
        const response = finalizeEvent({ kind: 25910, created_at: Math.floor(Date.now() / 1000), tags: [['p', inner.pubkey]], content: JSON.stringify({ jsonrpc: '2.0', id: message.id, result }) }, key);
        const wrapping = generateSecretKey();
        relay.store(finalizeEvent({ kind: 21059, created_at: response.created_at, tags: [['p', inner.pubkey]], content: nip44.encrypt(JSON.stringify(response), nip44.getConversationKey(wrapping, inner.pubkey)) }, wrapping));
      }
      if (event.kind !== 25050) return;
      expect(event.tags).toContainEqual(['d', wire]);
      const encrypted = event.tags.some(t => t[0] === 'p');
      const body = JSON.parse(encrypted ? nip44.decrypt(event.content, nip44.getConversationKey(peerKey, event.pubkey)) : event.content);
      chain = chain.then(async () => {
        if (body.type === 'hello' && !remote) {
          remote = { key: event.pubkey, nonce: body.nonce }; signal({ type: 'hello' });
          if (peerPubkey < remote.key) signal({ type: 'offer', to: remote.nonce, sdp: await peerPage.evaluate(() => (window as any).sdp('offer')) }, remote.key);
        } else if (body.type === 'offer' && remote) {
          expect(body.to).toBe(nonce);
          await peerPage.evaluate(sdp => (window as any).pc.setRemoteDescription({ type: 'offer', sdp }), body.sdp);
          signal({ type: 'answer', to: remote.nonce, sdp: await peerPage.evaluate(() => (window as any).sdp('answer')) }, remote.key);
        } else if (body.type === 'answer') await peerPage.evaluate(sdp => (window as any).pc.setRemoteDescription({ type: 'answer', sdp }), body.sdp);
      }).catch(error => { errors.push(String(error)); });
    });
    const frame = await openFlowTarget(page, runtime);
    await frame.locator('body').evaluate(() => {
      const w = window as unknown as FlowWindow;
      w.__track('actor', w.napplet.cvm.registry.call({ family: 'weather.v1' }, 'get_weather', { location: 'test' }));
    });
    const actor = await settleApproving(page, frame, 'actor');
    expect(actor.result, JSON.stringify(actor)).toMatchObject({ ok: true });
    await frame.locator('body').evaluate(() => {
      const w = window as unknown as FlowWindow;
      w.napplet.webrtc.onEvent((e: unknown) => w.__push('rtc', e));
      w.__track('room', w.napplet.webrtc.open({ scope: { type: 'room', room: 'room-code' }, channel: 'game', protocol: 'test/1', ordered: false, maxRetransmits: 0 }));
    });
    const opened = await settleApproving(page, frame, 'room');
    expect(opened.result).toMatchObject({ ok: true, value: { session: { ordered: true, maxPayloadBytes: 16384 } } });
    await expect.poll(() => frame.locator('body').evaluate(() => (window as unknown as FlowWindow).__log.rtc ?? []), { timeout: 20000 }).toContainEqual(expect.objectContaining({ type: 'peer', pubkey: peerPubkey, state: 'joined' }));
    expect(clients).toEqual(new Set([remote!.key]));
    expect(actor.result).toMatchObject({ value: { structuredContent: { actor: remote!.key } } });
    await peerPage.evaluate(() => (window as any).channel.send(JSON.stringify({ move: 7 })));
    await expect.poll(() => frame.locator('body').evaluate(() => (window as unknown as FlowWindow).__log.rtc ?? []), { timeout: 20000 }).toContainEqual(expect.objectContaining({ type: 'message', from: peerPubkey, payload: { move: 7 } }));
    await frame.locator('body').evaluate(() => {
      const w = window as unknown as FlowWindow;
      w.__track('send', w.napplet.webrtc.send((w.__results.room as any).value.session.id, { move: 9 }));
    });
    expect((await settleApproving(page, frame, 'send')).result.ok).toBe(true);
    await expect.poll(() => peerPage.evaluate(() => (window as any).messages)).toEqual([{ move: 9 }]);
    expect(errors).toEqual([]);
    await frame.locator('body').evaluate(() => { const w = window as unknown as FlowWindow; w.__track('close', w.napplet.webrtc.close((w.__results.room as any).value.session.id)); });
    expect((await settleApproving(page, frame, 'close')).result.ok).toBe(true);
    await expect.poll(() => peerPage.evaluate(() => (window as any).channel.readyState)).toBe('closed');
    await openFlowTarget(page, runtime);
    await frame.locator('body').evaluate(() => {
      const w = window as unknown as FlowWindow;
      w.__track('new-actor', w.napplet.cvm.registry.call({ family: 'weather.v1' }, 'get_weather', { location: 'test' }));
    });
    const next = await settleApproving(page, frame, 'new-actor');
    expect(next.result.ok).toBe(true);
    expect(clients.size).toBe(2);
    expect(next.result).not.toMatchObject({ value: { structuredContent: { actor: remote!.key } } });
  } finally { await peerPage.close(); await page.goto('about:blank'); await runtime.close(); await target.close(); }
});
