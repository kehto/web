/**
 * Browser conformance proof for NAP-INC #89 (4593ce9e301ce098fd3dad64206fcd6f144fa7af),
 * web convention binding #90 (896c32c92deee68dc4d10fc1132b62df20cccb6f), and the
 * symmetric-channel clarification #92 (c5cd06f7be6d4690b303949abb26e87ff62f4729).
 *
 * The two existing post-shim playground srcdoc frames are neutral endpoints:
 * all normal event and channel operations use window.napplet.inc. Raw envelopes
 * appear only in the two negative wire-attestation vectors required by #89 and
 * the resolution in kehto/web#203.
 */
import { expect, test } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

// Shared developer machines can have an unrelated IPv4 service on 4174. CI and
// normal runs keep localhost; focused conformance runs can select an isolated
// IPv6 preview with KEHTO_PLAYGROUND_BASE_URL=http://[::1]:4174.
test.use({ baseURL: process.env.KEHTO_PLAYGROUND_BASE_URL ?? 'http://localhost:4174' });
test.describe.configure({ mode: 'serial' });

const topic = 'napplet:phase102/probe';

test('two live playground frames retain exact NAP-INC events and symmetric channel lifecycle', async ({ page }) => {
  test.setTimeout(120_000);
  await demoBeforeEach(page);

  const botHandle = await page.locator('#bot-frame-container iframe').elementHandle();
  const chatHandle = await page.locator('#chat-frame-container iframe').elementHandle();
  expect(botHandle).not.toBeNull();
  expect(chatHandle).not.toBeNull();
  const bot = await botHandle!.contentFrame();
  const chat = await chatHandle!.contentFrame();
  expect(bot).not.toBeNull();
  expect(chat).not.toBeNull();

  await expect.poll(
    () => bot!.evaluate(() => typeof (window as Window & { napplet?: { inc?: unknown } }).napplet?.inc),
    { timeout: 15_000 },
  ).toBe('object');
  await expect.poll(
    () => chat!.evaluate(() => typeof (window as Window & { napplet?: { inc?: unknown } }).napplet?.inc),
    { timeout: 15_000 },
  ).toBe('object');

  // Both frames use the public injected API. The receiver's queryless identity
  // is deliberately stable while the sender supplies the convention URI.
  await chat!.evaluate((stableTopic) => {
    const inc = (window as Window & { napplet: { inc: any } }).napplet.inc;
    (window as any).__phase102 = { topicEvents: [], botEvents: [] };
    (window as any).__phase102.topicSubscription = inc.on(stableTopic, (event: unknown) => {
      (window as any).__phase102.topicEvents.push(event);
    });
  }, topic);
  await bot!.evaluate((stableTopic) => {
    const inc = (window as Window & { napplet: { inc: any } }).napplet.inc;
    (window as any).__phase102 = { botEvents: [] };
    (window as any).__phase102.botSubscription = inc.on(stableTopic, (event: unknown) => {
      (window as any).__phase102.botEvents.push(event);
    });
  }, topic);

  await bot!.evaluate((stableTopic) => {
    (window as Window & { napplet: { inc: any } }).napplet.inc.emit(
      `${stableTopic}?text=hello%20from%20bot&plus=a+b`,
    );
  }, topic);
  await expect.poll(
    () => chat!.evaluate(() => (window as any).__phase102.topicEvents.length),
    { timeout: 10_000 },
  ).toBe(1);
  expect(await chat!.evaluate(() => (window as any).__phase102.topicEvents[0])).toEqual({
    topic,
    sender: 'bot',
    payload: { text: 'hello from bot', plus: 'a+b' },
  });
  expect(await bot!.evaluate(() => (window as any).__phase102.botEvents)).toEqual([]);

  // Caller-supplied sender fields are untrusted. The runtime derives bot from
  // the authenticated source window, and raw query-bearing text stays distinct.
  await bot!.evaluate((stableTopic) => {
    window.parent.postMessage({
      type: 'inc.emit',
      topic: stableTopic,
      sender: 'forged-sender',
      payload: { source: 'raw' },
    }, '*');
  }, topic);
  await expect.poll(
    () => chat!.evaluate(() => (window as any).__phase102.topicEvents.length),
    { timeout: 10_000 },
  ).toBe(2);
  expect(await chat!.evaluate(() => (window as any).__phase102.topicEvents[1])).toEqual({
    topic,
    sender: 'bot',
    payload: { source: 'raw' },
  });
  await bot!.evaluate((stableTopic) => {
    window.parent.postMessage({
      type: 'inc.emit',
      topic: `${stableTopic}?must-not-base-match=true`,
      payload: { rejected: true },
    }, '*');
  }, topic);
  await page.waitForTimeout(250);
  expect(await chat!.evaluate(() => (window as any).__phase102.topicEvents)).toHaveLength(2);

  // #92 requires target opened delivery before the opener's correlated success.
  // This first channel has an already-attached target callback to prove both
  // endpoints receive equivalent public handles (never a raw peer object).
  await chat!.evaluate(() => {
    const inc = (window as Window & { napplet: { inc: any } }).napplet.inc;
    (window as any).__phase102.immediateOpenedSubscription = inc.channel.onOpened((handle: any) => {
      (window as any).__phase102.immediateTarget = handle;
      (window as any).__phase102.immediateTargetInfo = { id: handle.id, peer: handle.peer };
    });
  });
  const immediateOpener = await bot!.evaluate(async () => {
    const handle = await (window as Window & { napplet: { inc: any } }).napplet.inc.channel.open('chat');
    (window as any).__phase102.immediateOpener = handle;
    return { id: handle.id, peer: handle.peer };
  });
  await expect.poll(
    () => chat!.evaluate(() => (window as any).__phase102.immediateTargetInfo ?? null),
    { timeout: 10_000 },
  ).toEqual({ id: immediateOpener.id, peer: 'bot' });
  expect(immediateOpener.peer).toBe('chat');
  await bot!.evaluate(() => (window as any).__phase102.immediateOpener.close());
  await expect.poll(
    () => bot!.evaluate(async () => (window as Window & { napplet: { inc: any } }).napplet.inc.channel.list()),
    { timeout: 10_000 },
  ).toEqual([]);
  await chat!.evaluate(() => (window as any).__phase102.immediateOpenedSubscription.close());

  // Open a second channel before the target attaches onOpened. Its host-pushed
  // handle must be retained, then it retains a pre-on event and terminal close.
  const opener = await bot!.evaluate(async () => {
    const handle = await (window as Window & { napplet: { inc: any } }).napplet.inc.channel.open('chat');
    (window as any).__phase102.opener = handle;
    (window as any).__phase102.openerEvents = [];
    (window as any).__phase102.openerClosed = [];
    handle.on((event: unknown) => (window as any).__phase102.openerEvents.push(event));
    handle.onClosed((closed: unknown) => (window as any).__phase102.openerClosed.push(closed));
    return { id: handle.id, peer: handle.peer };
  });
  await chat!.evaluate(() => {
    const inc = (window as Window & { napplet: { inc: any } }).napplet.inc;
    (window as any).__phase102.delayedOpenedSubscription = inc.channel.onOpened((handle: any) => {
      (window as any).__phase102.target = handle;
      (window as any).__phase102.targetInfo = { id: handle.id, peer: handle.peer };
      (window as any).__phase102.targetEvents = [];
      (window as any).__phase102.targetClosed = [];
    });
  });
  await expect.poll(
    () => chat!.evaluate(() => (window as any).__phase102.targetInfo ?? null),
    { timeout: 10_000 },
  ).toEqual({ id: opener.id, peer: 'bot' });
  expect(opener.peer).toBe('chat');

  await bot!.evaluate(() => (window as any).__phase102.opener.emit({ direction: 'bot-to-chat' }));
  await chat!.evaluate(() => {
    (window as any).__phase102.target.on((event: unknown) => (window as any).__phase102.targetEvents.push(event));
  });
  await expect.poll(
    () => chat!.evaluate(() => (window as any).__phase102.targetEvents.length),
    { timeout: 10_000 },
  ).toBe(1);
  expect(await chat!.evaluate(() => (window as any).__phase102.targetEvents[0])).toEqual({
    channelId: opener.id,
    sender: 'bot',
    payload: { direction: 'bot-to-chat' },
  });

  await chat!.evaluate(() => (window as any).__phase102.target.emit({ direction: 'chat-to-bot' }));
  await expect.poll(
    () => bot!.evaluate(() => (window as any).__phase102.openerEvents.length),
    { timeout: 10_000 },
  ).toBe(1);
  expect(await bot!.evaluate(() => (window as any).__phase102.openerEvents[0])).toEqual({
    channelId: opener.id,
    sender: 'chat',
    payload: { direction: 'chat-to-bot' },
  });

  const botList = await bot!.evaluate(async () => {
    const channels = await (window as Window & { napplet: { inc: any } }).napplet.inc.channel.list();
    return channels.map((channel: any) => ({
      id: channel.id,
      peer: channel.peer,
      keys: Object.keys(channel).sort(),
      emit: typeof channel.emit,
    }));
  });
  const chatList = await chat!.evaluate(async () => {
    const channels = await (window as Window & { napplet: { inc: any } }).napplet.inc.channel.list();
    return channels.map((channel: any) => ({
      id: channel.id,
      peer: channel.peer,
      keys: Object.keys(channel).sort(),
      on: typeof channel.on,
    }));
  });
  expect(botList).toEqual([{ id: opener.id, peer: 'chat', keys: ['id', 'peer'], emit: 'undefined' }]);
  expect(chatList).toEqual([{ id: opener.id, peer: 'bot', keys: ['id', 'peer'], on: 'undefined' }]);

  await bot!.evaluate(() => (window as any).__phase102.opener.close());
  await expect.poll(
    () => bot!.evaluate(() => (window as any).__phase102.openerClosed.length),
    { timeout: 10_000 },
  ).toBe(1);
  await chat!.evaluate(() => {
    (window as any).__phase102.target.onClosed((closed: unknown) => (window as any).__phase102.targetClosed.push(closed));
  });
  await expect.poll(
    () => chat!.evaluate(() => (window as any).__phase102.targetClosed.length),
    { timeout: 10_000 },
  ).toBe(1);
  expect(await bot!.evaluate(() => (window as any).__phase102.openerClosed[0])).toEqual({ channelId: opener.id });
  expect(await chat!.evaluate(() => (window as any).__phase102.targetClosed[0])).toEqual({ channelId: opener.id });

  await expect.poll(
    () => bot!.evaluate(async () => (window as Window & { napplet: { inc: any } }).napplet.inc.channel.list()),
    { timeout: 10_000 },
  ).toEqual([]);
  await expect.poll(
    () => chat!.evaluate(async () => (window as Window & { napplet: { inc: any } }).napplet.inc.channel.list()),
    { timeout: 10_000 },
  ).toEqual([]);

  const beforeLaterTraffic = await Promise.all([
    bot!.evaluate(() => (window as any).__phase102.openerEvents.length),
    chat!.evaluate(() => (window as any).__phase102.targetEvents.length),
  ]);
  await bot!.evaluate(() => (window as any).__phase102.opener.emit({ after: 'close' }));
  await chat!.evaluate(() => (window as any).__phase102.target.emit({ after: 'close' }));
  await page.waitForTimeout(250);
  expect(await Promise.all([
    bot!.evaluate(() => (window as any).__phase102.openerEvents.length),
    chat!.evaluate(() => (window as any).__phase102.targetEvents.length),
  ])).toEqual(beforeLaterTraffic);

  await bot!.evaluate(() => (window as any).__phase102.botSubscription.close());
  await chat!.evaluate(() => {
    (window as any).__phase102.topicSubscription.close();
    (window as any).__phase102.delayedOpenedSubscription.close();
  });
});
