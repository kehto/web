import { createServer } from 'node:http';
import { expect, test } from '@playwright/test';
import { demoBeforeEach } from './helpers/index.js';

test.use({ baseURL: 'http://localhost:4174' });

test('required interface denial prevents a verified playground app from running', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    const answer = () => {
      const dialog = document.querySelector<HTMLDialogElement>('.kehto-approval-ui dialog[open]');
      if (!dialog) return;
      const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button')];
      if (dialog.textContent?.includes(':chat;')) {
        buttons.find((button) => button.textContent === 'Deny')?.click();
        return;
      }
      const lifetime = dialog.querySelector<HTMLSelectElement>('select');
      if (!lifetime || ![...lifetime.options].some((option) => option.value === 'session')) return;
      lifetime.value = 'session';
      lifetime.dispatchEvent(new Event('change', { bubbles: true }));
      buttons.find((button) => button.textContent === 'Allow')?.click();
    };
    const observe = () => new MutationObserver(answer).observe(document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['open'],
    });
    if (document.documentElement) observe();
    else document.addEventListener('DOMContentLoaded', observe, { once: true });
  });
  await page.goto('/');
  await expect(page.locator('#chat-status')).toHaveText('load failed', { timeout: 60_000 });
  await expect(page.locator('#chat-frame-container iframe')).toHaveCount(0);
  await expect(page.locator('#bot-frame-container iframe')).toHaveCount(1);
});

test('revoking one verified app interface retires its live frame only', async ({ page }) => {
  test.setTimeout(90_000);
  await demoBeforeEach(page);
  await expect(page.locator('#chat-frame-container iframe')).toHaveCount(1);
  await expect(page.locator('#bot-frame-container iframe')).toHaveCount(1);
  await page.locator('#playground-firewall-panel summary').click();
  const chatRelayGrant = page.locator('#firewall-grants li')
    .filter({ hasText: /:chat; artifact SHA-256/ })
    .filter({ hasText: 'access exact:relay' });
  await expect(chatRelayGrant).toHaveCount(1);
  await chatRelayGrant.getByRole('button', { name: 'Revoke access exact:relay' }).click();
  await expect(page.locator('#chat-frame-container iframe')).toHaveCount(0);
  await expect(page.locator('#bot-frame-container iframe')).toHaveCount(1);
});

test('a verified frame cannot send direct browser requests to a relay or asset origin', async ({ page }) => {
  test.setTimeout(90_000);
  const requests: string[] = [];
  const destination = createServer((request, response) => {
    requests.push(request.url ?? '/');
    response.writeHead(200, { 'access-control-allow-origin': '*' });
    response.end('reached');
  });
  await new Promise<void>((resolve, reject) => {
    destination.once('error', reject);
    destination.listen(0, '127.0.0.1', () => { destination.off('error', reject); resolve(); });
  });
  try {
    const address = destination.address();
    if (!address || typeof address === 'string') throw new Error('Destination did not bind');
    await demoBeforeEach(page);
    const frame = page.frameLocator('#chat-frame-container iframe');
    await expect(frame.locator('body')).toBeVisible();
    const origin = `http://127.0.0.1:${address.port}`;
    await frame.locator('body').evaluate(async (body, base) => {
      await fetch(`${base}/fetch`).catch(() => undefined);
      for (const [tag, attribute, path] of [
        ['script', 'src', 'script'], ['img', 'src', 'image'], ['iframe', 'src', 'frame'],
        ['object', 'data', 'object'], ['link', 'href', 'manifest'],
      ] as const) {
        const element = document.createElement(tag);
        if (tag === 'link') element.setAttribute('rel', 'manifest');
        element.setAttribute(attribute, `${base}/${path}`);
        body.appendChild(element);
      }
    }, origin);
    await page.waitForTimeout(300);
    expect(requests).toEqual([]);
  } finally {
    await new Promise<void>((resolve, reject) => destination.close((error) => error ? reject(error) : resolve()));
  }
});
