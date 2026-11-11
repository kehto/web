import { createServer } from 'node:http';
import { expect, test, type Page } from '@playwright/test';
import { startPajaServer, type PajaServer } from '../../packages/paja/dist/index.js';

// A napplet that does what flooded the old Firewall: it registers one keyboard
// action per command at launch, each of which is a separate exact scope. The
// count stays under the runtime's startup burst budget (20 operations in the
// first three seconds), which is enforced independently of any approval.
const ACTIONS = 18;
const TARGET_HTML = `<!doctype html><html><head>
  <meta name="napplet-requires" content="shell">
  <meta name="napplet-optional" content="theme keys link">
  </head><body><output id="executed">pending</output><output id="theme-state"></output>
  <output id="registered">0</output><output id="link-result"></output>
  <button id="open-link" type="button">Open docs</button>
  <script>
    document.getElementById('executed').textContent = 'yes';
    document.getElementById('theme-state').textContent = typeof window.napplet.theme;
    let registered = 0;
    for (let index = 0; index < ${ACTIONS}; index++) {
      window.napplet.keys?.registerAction({ id: 'demo.action-' + index, label: 'Action ' + index }).then(() => {
        document.getElementById('registered').textContent = String(++registered);
      }, () => undefined);
    }
    document.getElementById('open-link').addEventListener('click', () => {
      window.napplet.link.open('https://example.com/docs', { label: 'Read the docs' }).then((result) => {
        document.getElementById('link-result').textContent = result.status;
      });
    });
  </script></body></html>`;

let target: ReturnType<typeof createServer>;
let host: PajaServer;

test.beforeAll(async () => {
  target = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'access-control-allow-origin': '*' });
    response.end(TARGET_HTML);
  });
  await new Promise<void>((resolve, reject) => {
    target.once('error', reject);
    target.listen(0, '127.0.0.1', () => { target.off('error', reject); resolve(); });
  });
  const address = target.address();
  if (!address || typeof address === 'string') throw new Error('Target did not bind');
  host = await startPajaServer({ options: { targetUrl: `http://127.0.0.1:${address.port}/`, port: 0 } });
});

test.afterAll(async () => {
  await host?.close();
  await new Promise<void>((resolve, reject) => target.close((error) => error ? reject(error) : resolve()));
});

const dialogOf = (page: Page) => page.locator('.kehto-approval-ui dialog');

async function choose(page: Page, permission: string, effect: 'Allow' | 'Deny'): Promise<void> {
  const dialog = dialogOf(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(permission);
  await dialog.getByRole('button', { name: effect, exact: true }).click();
}
test('launches without prompting and summarizes what the rules allowed', async ({ page }) => {
  await page.goto(host.url);
  const frame = page.frameLocator('#napplet-frame');
  await expect(frame.locator('#executed')).toHaveText('yes');
  await expect(frame.locator('#theme-state')).toHaveText('object');
  await expect(frame.locator('#registered')).toHaveText(String(ACTIONS));
  await expect(dialogOf(page)).toBeHidden();
  const rules = page.locator('.kehto-fw-rule-list li');
  await expect(rules).toHaveCount(2);
  await expect(rules.nth(0)).toContainText('Everything else');
  await expect(rules.nth(0).locator('select')).toHaveValue('allow');
  await expect(rules.nth(1)).toContainText('link.open');
  await expect(rules.nth(1).locator('select')).toHaveValue('ask');
  await expect(page.locator('.kehto-fw-by-rule')).toContainText('allowed by default rules');
  await expect(page.locator('.kehto-fw-domain')).toHaveCount(0);
});

test('tightening a rule retires the frame it had allowed and asks on the next launch', async ({ page }) => {
  await page.goto(host.url);
  const frame = page.frameLocator('#napplet-frame');
  await expect(frame.locator('#theme-state')).toHaveText('object');
  const add = page.locator('.kehto-fw-rule-add');
  await add.getByLabel('Interface or operation').fill('theme');
  await add.getByLabel('Rule action').selectOption('ask');
  await add.getByRole('button', { name: 'Add rule' }).click();
  await expect(page.locator('.kehto-fw-rule-list li')).toHaveCount(3);
  await choose(page, 'Use the theme interface', 'Deny');
  await expect(frame.locator('#executed')).toHaveText('yes');
  await expect(frame.locator('#theme-state')).toHaveText('undefined');

  // The rule is durable: a fresh page load asks again instead of allowing.
  await page.reload();
  await choose(page, 'Use the theme interface', 'Allow');
  await expect(page.frameLocator('#napplet-frame').locator('#theme-state')).toHaveText('object');
});

test('a rule changed in place takes effect and can be restored', async ({ page }) => {
  await page.goto(host.url);
  await expect(page.frameLocator('#napplet-frame').locator('#executed')).toHaveText('yes');
  await page.locator('.kehto-fw-rule-list li').nth(0).locator('select').selectOption('ask');
  await choose(page, 'connect-src', 'Deny');
  await expect.poll(() => page.evaluate(() => window.__KEHTO_PAJA__?.getState().status)).toBe('error');
  await page.getByRole('button', { name: 'Restore defaults' }).click();
  await expect(page.locator('.kehto-fw-rule-list li').nth(0).locator('select')).toHaveValue('allow');
  await page.reload();
  await expect(page.frameLocator('#napplet-frame').locator('#executed')).toHaveText('yes');
});

test('opening a link asks once, names the destination, and opens from that click', async ({ page }) => {
  await page.goto(host.url);
  const frame = page.frameLocator('#napplet-frame');
  await expect(frame.locator('#registered')).toHaveText(String(ACTIONS));
  await frame.locator('#open-link').click();
  const dialog = dialogOf(page);
  await expect(dialog.locator('h2')).toHaveText('Open an external link?');
  await expect(dialog.locator('.kehto-approval-scopes code')).toHaveText('https://example.com/docs');
  await expect(dialog.getByRole('button', { name: 'Just this once' })).toHaveAttribute('aria-pressed', 'true');
  const popup = page.waitForEvent('popup');
  await dialog.getByRole('button', { name: 'Allow', exact: true }).click();
  expect((await popup).url()).toContain('example.com/docs');
  await expect(frame.locator('#link-result')).toHaveText('opened');
  // The Firewall prompt was the only question: no second confirmation dialog.
  await expect(page.locator('#paja-confirmation-dialog')).toBeHidden();

  // "Just this once" leaves nothing behind, so the same link asks again.
  await frame.locator('#open-link').click();
  await choose(page, 'https://example.com/docs', 'Deny');
  await expect(frame.locator('#link-result')).toHaveText('denied');
});

test('a prompt answer can become a standing rule for that napplet', async ({ page }) => {
  await page.goto(host.url);
  const frame = page.frameLocator('#napplet-frame');
  await expect(frame.locator('#registered')).toHaveText(String(ACTIONS));
  await frame.locator('#open-link').click();
  const dialog = dialogOf(page);
  await dialog.getByLabel('Do this for every future link.open request from this napplet').check();
  const popup = page.waitForEvent('popup');
  await dialog.getByRole('button', { name: 'Allow', exact: true }).click();
  await popup;
  await expect(page.locator('.kehto-fw-rule-list li')).toHaveCount(3);
  await expect(page.locator('.kehto-fw-rule-list li').nth(2)).toContainText('link.open');
  await expect(page.locator('.kehto-fw-rule-list li').nth(2).locator('select')).toHaveValue('allow');
});

test('answered decisions are grouped under one napplet heading and revoked as a group', async ({ page }) => {
  await page.goto(host.url);
  const frame = page.frameLocator('#napplet-frame');
  await expect(frame.locator('#registered')).toHaveText(String(ACTIONS));
  await frame.locator('#open-link').click();
  const dialog = dialogOf(page);
  await dialog.getByRole('button', { name: 'Until it closes' }).click();
  const popup = page.waitForEvent('popup');
  await dialog.getByRole('button', { name: 'Allow', exact: true }).click();
  await popup;
  await expect(page.locator('.kehto-fw-napplet')).toHaveCount(1);
  const link = page.locator('.kehto-fw-domain', { hasText: 'link' });
  await expect(link.locator('summary')).toContainText('1 decision');
  await link.locator('summary').click();
  await expect(link.locator('li')).toContainText('https://example.com/docs');
  await link.getByRole('button', { name: /Revoke all link/ }).click();
  await expect(page.locator('.kehto-fw-domain')).toHaveCount(0);
});
