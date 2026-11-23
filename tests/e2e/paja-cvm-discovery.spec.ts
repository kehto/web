import { expect, test } from '@playwright/test';
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent, type NostrEvent } from 'nostr-tools/pure';
import { neventEncode } from 'nostr-tools/nip19';
import * as nip44 from 'nostr-tools/nip44';
import { startPajaServer } from '../../packages/paja/dist/index.js';
import { installMemoryRelay } from './helpers/memory-relay.js';
import { openFlowTarget, settleApproving, startFlowTarget, type FlowWindow } from './helpers/paja-flows.js';
import { installPajaApprovalDriver } from './paja-approval-driver.js';

const RELAY = 'wss://cvm-discovery.example';
const HASH = 'c042f92e9ab085590656cea78e2628d44ffed49ea8da90aa32e208155fedd84e';
const tool = { name: 'get_weather', inputSchema: { properties: { location: { type: 'string' } }, required: ['location'] }, outputSchema: { properties: { temperature: { type: 'number' } }, required: ['temperature'] }, _meta: { 'io.contextvm/common-schema': { schemaHash: HASH } } };

// `cvm.registry` is the canonical file-based pin and needs no signaling profile;
// `legacy` keeps the deprecated `multiplayer.registry` path (PAJA_MULTIPLAYER_REGISTRY).
const MODES = [
  { name: 'plain CVM', multiplayer: false, legacy: false },
  { name: 'multiplayer', multiplayer: true, legacy: false },
  { name: 'legacy multiplayer registry', multiplayer: true, legacy: true },
] as const;

for (const { name, multiplayer, legacy } of MODES) {
  test(`discovers, selects, persists and invokes multiple families (${name})`, async ({ page }, testInfo) => {
    test.setTimeout(90000);
    const keys = [generateSecretKey(), generateSecretKey()];
    const announcements = keys.map(key => finalizeEvent({ kind: 11317, created_at: 100, tags: [['i', HASH, tool.name], ['k', 'io.contextvm/common-schema']], content: JSON.stringify({ tools: [tool] }) }, key));
    const target = await startFlowTarget(['cvm']);
    const configured = { family: 'configured.weather', server: { pubkey: announcements[0].pubkey, relays: [RELAY] }, tools: [{ name: tool.name, schemaHash: HASH }] };
    const runtime = await startPajaServer({ options: { targetUrl: target.url, port: 0, simulation: {
      relay: { mode: 'live', urls: [RELAY] },
      ...(legacy ? {} : { cvm: { registry: [configured] } }),
      ...(multiplayer ? { multiplayer: { profile: 'soy-rtc/1', relays: [RELAY], ...(legacy ? { registry: [configured] } : {}) } } : {}),
    } } });
    const warnings: string[] = [];
    page.on('console', message => { if (message.type() === 'warning') warnings.push(message.text()); });
    try {
      await installPajaApprovalDriver(page);
      const relay = await installMemoryRelay(page, RELAY);
      announcements.forEach(relay.store);
      relay.onPublish(event => {
        const key = keys.find(key => event.tags.some(tag => tag[0] === 'p' && tag[1] === getPublicKey(key)));
        if (!key || ![1059, 21059].includes(event.kind)) return;
        const inner = JSON.parse(nip44.decrypt(event.content, nip44.getConversationKey(key, event.pubkey))) as NostrEvent;
        expect(verifyEvent(inner)).toBe(true);
        const message = JSON.parse(inner.content);
        if (message.id === undefined) return;
        const result = message.method === 'initialize' ? { protocolVersion: '2025-11-25', capabilities: { tools: {} }, serverInfo: { name: 'weather', version: '1' } }
          : message.method === 'tools/list' ? { tools: [tool] } : { content: [], structuredContent: { temperature: 20 } };
        const response = finalizeEvent({ kind: 25910, created_at: Math.floor(Date.now() / 1000), tags: [['p', inner.pubkey]], content: JSON.stringify({ jsonrpc: '2.0', id: message.id, result }) }, key);
        const wrapper = generateSecretKey();
        relay.store(finalizeEvent({ kind: 21059, created_at: response.created_at, tags: [['p', inner.pubkey]], content: nip44.encrypt(JSON.stringify(response), nip44.getConversationKey(wrapper, inner.pubkey)) }, wrapper));
      });
      await page.route('https://provider.example/.well-known/napplet.json', route => route.fulfill({ json: { version: 1, backend: { pubkey: announcements[0].pubkey, relays: [RELAY] } }, headers: { 'access-control-allow-origin': '*' } }));
      // Tall enough that the section screenshots below are not clipped by the sidebar scroll.
      await page.setViewportSize({ width: 1280, height: 2000 });
      await openFlowTarget(page, runtime);
      if (!multiplayer) {
        const boxes = await Promise.all(['#paja-section-intent-handlers', '#paja-section-security'].map(id => page.locator(id).boundingBox()));
        const [top, bottom] = boxes as [NonNullable<(typeof boxes)[0]>, NonNullable<(typeof boxes)[0]>];
        await page.screenshot({ path: testInfo.outputPath('sidebar-sections.png'), clip: { x: top.x, y: top.y, width: top.width, height: bottom.y + bottom.height - top.y } });
      }
      await expect(page.locator('#paja-section-cvm > summary')).toHaveText(/ContextVM providers/);
      await expect(page.locator('#paja-section-multiplayer > summary')).toHaveText(/Multiplayer signaling/);
      const signaling = page.locator('#paja-section-multiplayer');
      await signaling.locator('summary').click();
      await expect(signaling.locator('#paja-cvm-form')).toHaveCount(0);
      const signalingJson = JSON.parse(await page.locator('#paja-multiplayer-input').inputValue() || 'null');
      expect(signalingJson === null ? null : Object.keys(signalingJson)).toEqual(multiplayer ? (legacy ? ['profile', 'relays', 'registry'] : ['profile', 'relays']) : null);
      if (!legacy) await signaling.screenshot({ path: testInfo.outputPath(`multiplayer-signaling-${multiplayer ? 'configured' : 'empty'}.png`) });
      await signaling.locator('summary').click();
      const section = page.locator('#paja-section-cvm');
      await section.locator('summary').click();
      const input = page.locator('#paja-cvm-discovery'), json = page.locator('#paja-cvm-json');
      await input.fill(HASH);
      await page.locator('#paja-cvm-find').click();
      await expect(page.locator('#paja-cvm-results option')).toHaveCount(3);
      await expect(json).toHaveValue('');
      await expect(page.locator('#paja-cvm-save')).toBeDisabled();
      await page.locator('#paja-cvm-results').selectOption('0');
      await expect(json).toHaveJSProperty('readOnly', true);
      await expect(page.locator('#paja-cvm-origin')).toContainText(HASH);
      await page.locator('#paja-cvm-tools input').uncheck();
      await expect(page.locator('#paja-cvm-save')).toBeDisabled();
      await page.locator('#paja-cvm-tools input').check();
      await page.locator('#paja-cvm-label').fill('weather.first');
      await page.locator('#paja-cvm-save').click();
      await expect(page.locator('#paja-cvm-saved')).toContainText('weather.first');
      await expect(json).toHaveJSProperty('readOnly', true);

      await input.fill(neventEncode({ id: announcements[1].id, relays: [RELAY] }));
      await page.locator('#paja-cvm-find').click();
      await expect(page.locator('#paja-cvm-origin')).toContainText(announcements[1].id);
      await page.locator('#paja-cvm-label').fill('weather.second');
      await page.locator('#paja-cvm-save').click();
      await expect(page.locator('#paja-cvm-saved')).toContainText('weather.second');
      await expect(page.locator('#paja-cvm-saved')).toContainText('weather.first');

      await input.fill('https://provider.example/rooms');
      await page.locator('#paja-cvm-find').click();
      await expect(page.locator('#paja-cvm-origin')).toContainText('https://provider.example/.well-known/napplet.json');
      await page.locator('#paja-cvm-label').fill('weather.website');
      await page.locator('#paja-cvm-save').click();
      await expect(page.locator('#paja-cvm-saved')).toContainText('weather.website');
      await page.locator('#paja-cvm-saved').getByRole('button', { name: /^weather.website ·/ }).click();
      await expect(json).toHaveJSProperty('readOnly', true);
      await test.info().attach('CVM family settings', { body: await section.screenshot(), contentType: 'image/png' });
      if (!legacy) await section.screenshot({ path: testInfo.outputPath(`contextvm-providers-${multiplayer ? 'multiplayer' : 'plain'}.png`) });

      await page.locator('#paja-cvm-new').click();
      await json.fill(JSON.stringify({ ...configured, family: 'weather.manual' }));
      await page.locator('#paja-cvm-save').click();
      await expect(page.locator('#paja-cvm-saved')).toContainText('weather.manual');
      await page.locator('#paja-cvm-saved').getByRole('button', { name: /^weather.manual ·/ }).click();
      await expect(json).toHaveJSProperty('readOnly', false);
      await expect(page.locator('#paja-cvm-origin')).toHaveText('Source: manual JSON');

      const frame = await openFlowTarget(page, runtime);
      for (const family of ['weather.first', 'weather.second', 'weather.website', 'weather.manual', 'configured.weather']) {
        await frame.locator('body').evaluate((_body, family) => {
          const w = window as unknown as FlowWindow;
          w.__track(family, w.napplet.cvm.registry.call({ family }, 'get_weather', { location: 'Budapest' }));
        }, family);
        expect((await settleApproving(page, frame, family)).result).toMatchObject({ ok: true, value: { structuredContent: { temperature: 20 } } });
      }
      await page.locator('#paja-cvm-manual').click();
      await expect(json).toHaveJSProperty('readOnly', false);
      await expect(page.locator('#paja-cvm-origin')).toHaveText('Source: manual JSON');
      await json.fill('{invalid');
      await page.locator('#paja-cvm-save').click();
      await expect(page.locator('#paja-cvm-status')).not.toBeEmpty();
      await expect(page.locator('#paja-cvm-saved')).toContainText('weather.second');
      await page.getByRole('button', { name: 'Remove weather.second', exact: true }).click();
      await expect(page.locator('#paja-cvm-saved')).not.toContainText('weather.second');
      await expect(page.locator('#paja-cvm-saved')).toContainText('weather.first');
      await expect(page.locator('#paja-cvm-saved')).toContainText('weather.website');
      const legacyWarnings = warnings.filter(text => text.includes('[PAJA_MULTIPLAYER_REGISTRY]'));
      if (legacy) expect(legacyWarnings[0]).toContain('simulation.cvm.registry');
      else expect(legacyWarnings).toEqual([]);
    } finally { if (!page.isClosed()) await page.goto('about:blank'); await runtime.close(); await target.close(); }
  });
}
