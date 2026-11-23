import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
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

async function openSettings(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Paja settings' });
  await expect(dialog).toBeVisible();
  // Only the panel scrolls; the title and actions stay reachable.
  await expect(dialog.getByText('Paja settings', { exact: true })).toBeInViewport();
  await expect(dialog.getByRole('button', { name: 'Save and reload' })).toBeInViewport();
  return dialog;
}

const field = (dialog: Locator, name: string) => dialog.getByRole('spinbutton', { name, exact: true });
const tab = (dialog: Locator, name: string) => dialog.getByRole('tab', { name });

test('top-bar controls share one vertical centre', async ({ page }) => {
  await openPaja(page);
  const centres = await Promise.all(['#simulation-theme', '#paja-settings-open', '#reload-target'].map(async (selector) => {
    const box = (await page.locator(selector).boundingBox())!;
    return box.y + box.height / 2;
  }));
  for (const centre of centres) expect(Math.abs(centre - centres[0]!)).toBeLessThanOrEqual(1);
});

test('settings are grouped into keyboard-navigable tabs', async ({ page }) => {
  await openPaja(page);
  const dialog = await openSettings(page);
  const tabs = dialog.getByRole('tablist', { name: 'Settings groups' }).getByRole('tab');
  await expect(tabs).toHaveCount(14);
  // ContextVM providers and Multiplayer signaling are separate groups, like their sidebar panels.
  await expect(tab(dialog, 'ContextVM providers')).toBeVisible();
  await expect(tab(dialog, 'Multiplayer signaling')).toBeVisible();
  await expect(tab(dialog, 'Relays and queries')).toHaveAttribute('aria-selected', 'true');
  await expect(field(dialog, 'Live relay query and connect wait')).toBeVisible();
  await expect(field(dialog, 'Model list timeout')).toBeHidden();

  await tab(dialog, 'Relays and queries').focus();
  await page.keyboard.press('ArrowDown');
  await expect(tab(dialog, 'Resources and Blossom')).toBeFocused();
  await expect(tab(dialog, 'Resources and Blossom')).toHaveAttribute('aria-selected', 'true');
  await expect(field(dialog, 'Maximum resource size')).toBeVisible();
  await tab(dialog, 'Firewall').click();
  await expect(field(dialog, 'Relay origins listed open in a prompt')).toHaveValue('5');
  await expect(field(dialog, 'Requirements per approval request')).toHaveValue('128');
  await expect(field(dialog, 'Grants in the permission table')).toHaveValue('2048');
  await page.keyboard.press('End');
  await expect(tab(dialog, 'Server (config file only)')).toHaveAttribute('aria-selected', 'true');
  // Server-scope settings are shown but only editable in the config file.
  await expect(field(dialog, 'Proxied resource timeout')).toBeDisabled();
  await page.keyboard.press('Home');
  await expect(tab(dialog, 'Relays and queries')).toHaveAttribute('aria-selected', 'true');
  expect(await tabs.evaluateAll((all) => all.filter((el) => (el as HTMLElement).tabIndex === 0).length)).toBe(1);
});

test('settings panel persists overrides across reloads and resets them', async ({ page }) => {
  await openPaja(page);
  let dialog = await openSettings(page);
  const wait = field(dialog, 'Live relay query and connect wait');
  await expect(wait).toHaveValue('4000');
  await expect(dialog.getByText('relay.liveQueryWaitMs · default 4000 ms · range 250–120000')).toBeVisible();
  // Config-file seeds become the visible default.
  await tab(dialog, 'Language models').click();
  await expect(field(dialog, 'Model list timeout')).toHaveValue('12000');
  await expect(dialog.getByText('llm.modelsTimeoutMs · default 12000 ms', { exact: false })).toBeVisible();

  await tab(dialog, 'Relays and queries').click();
  await wait.fill('9000');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Settings saved for this host origin.');
  expect(await page.evaluate(() => localStorage.getItem('kehto:paja:settings.v1'))).toBe('{"relay.liveQueryWaitMs":9000}');

  await page.reload();
  dialog = await openSettings(page);
  await expect(dialog.getByRole('status')).toHaveText('Restored saved settings.');
  await expect(field(dialog, 'Live relay query and connect wait')).toHaveValue('9000');

  await dialog.getByRole('button', { name: 'Reset all' }).click();
  await expect(dialog.getByRole('status')).toHaveText('All settings reset to defaults.');
  await expect(field(dialog, 'Live relay query and connect wait')).toHaveValue('4000');
  expect(await page.evaluate(() => localStorage.getItem('kehto:paja:settings.v1'))).toBeNull();
});

test('settings panel refuses out-of-range values, flags their tabs and keeps security floors', async ({ page }) => {
  await openPaja(page);
  const dialog = await openSettings(page);
  await tab(dialog, 'Language models').click();
  const floor = field(dialog, 'Minimum vault password length');
  await floor.fill('6');
  await tab(dialog, 'Resources and Blossom').click();
  const size = field(dialog, 'Maximum resource size');
  await size.fill('');
  await tab(dialog, 'Language models').click();
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Fix 2 invalid settings; nothing was saved.');
  // Both tabs are flagged; the first invalid field in panel order is revealed and focused.
  await expect(tab(dialog, 'Resources and Blossom')).toHaveAccessibleName('Resources and Blossom · needs fixing');
  await expect(tab(dialog, 'Language models')).toHaveAccessibleName('Language models · needs fixing');
  await expect(tab(dialog, 'Resources and Blossom')).toHaveAttribute('aria-selected', 'true');
  await expect(size).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('kehto:paja:settings.v1'))).toBeNull();

  await size.fill('1048576');
  await tab(dialog, 'Language models').click();
  await expect(floor).toHaveAttribute('aria-invalid', 'true');
  await dialog.getByRole('button', { name: 'Reset Minimum vault password length' }).click();
  await expect(floor).toHaveValue('12');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Settings saved for this host origin.');
  await expect(tab(dialog, 'Language models')).toHaveAccessibleName('Language models');
  await expect(floor).not.toHaveAttribute('aria-invalid');
});
