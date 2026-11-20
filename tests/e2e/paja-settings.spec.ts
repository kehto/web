import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { createPajaRuntimeHostConfig, renderPajaHtml } from '../../packages/paja/dist/index.js';

const config = createPajaRuntimeHostConfig({
  simulation: { relay: { mode: 'memory' } },
  settings: { 'llm.modelsTimeoutMs': 12_000 },
});
const script = readFileSync(new URL('../../packages/paja/dist/browser-host.js', import.meta.url), 'utf8');

async function openPaja(page: Page): Promise<void> {
  await page.route('http://paja.test/web/paja/**', (route) => route.fulfill({
    contentType: route.request().url().endsWith('.js') ? 'text/javascript' : 'text/html',
    body: route.request().url().endsWith('.js') ? script : renderPajaHtml(config),
  }));
  await page.goto('http://paja.test/web/paja/');
}

async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Paja settings' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('settings panel persists overrides across reloads and resets them', async ({ page }) => {
  await openPaja(page);
  let dialog = await openSettings(page);
  const wait = dialog.getByRole('spinbutton', { name: 'Live relay query and connect wait', exact: true });
  await expect(wait).toHaveValue('4000');
  await expect(dialog.getByText('relay.liveQueryWaitMs · default 4000 ms · range 250–120000')).toBeVisible();
  // Config-file seeds become the visible default.
  await expect(dialog.getByRole('spinbutton', { name: 'Model list timeout', exact: true })).toHaveValue('12000');
  await expect(dialog.getByText('llm.modelsTimeoutMs · default 12000 ms', { exact: false })).toBeVisible();
  // Server-scope settings are shown but only editable in the config file.
  await expect(dialog.getByRole('spinbutton', { name: 'Proxied resource timeout', exact: true })).toBeDisabled();

  await wait.fill('9000');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Settings saved for this host origin.');
  expect(await page.evaluate(() => localStorage.getItem('kehto:paja:settings.v1'))).toBe('{"relay.liveQueryWaitMs":9000}');

  await page.reload();
  dialog = await openSettings(page);
  await expect(dialog.getByRole('status')).toHaveText('Restored saved settings.');
  await expect(dialog.getByRole('spinbutton', { name: 'Live relay query and connect wait', exact: true })).toHaveValue('9000');

  await dialog.getByRole('button', { name: 'Reset all' }).click();
  await expect(dialog.getByRole('status')).toHaveText('All settings reset to defaults.');
  await expect(dialog.getByRole('spinbutton', { name: 'Live relay query and connect wait', exact: true })).toHaveValue('4000');
  expect(await page.evaluate(() => localStorage.getItem('kehto:paja:settings.v1'))).toBeNull();
});

test('settings panel refuses out-of-range values and keeps security floors', async ({ page }) => {
  await openPaja(page);
  const dialog = await openSettings(page);
  const floor = dialog.getByRole('spinbutton', { name: 'Minimum vault password length', exact: true });
  await floor.fill('6');
  const size = dialog.getByRole('spinbutton', { name: 'Maximum resource size', exact: true });
  await size.fill('');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Fix 2 invalid settings; nothing was saved.');
  await expect(floor).toHaveAttribute('aria-invalid', 'true');
  // Focus moves to the first invalid field in panel order.
  await expect(size).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('kehto:paja:settings.v1'))).toBeNull();

  await dialog.getByRole('button', { name: 'Reset Minimum vault password length' }).click();
  await expect(floor).toHaveValue('12');
  await expect(floor).not.toHaveAttribute('aria-invalid');
});
