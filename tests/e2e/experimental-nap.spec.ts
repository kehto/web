import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Frame, type Page } from '@playwright/test';
import { startPajaServer, type PajaServer } from '../../packages/paja/dist/index.js';
import { demoBeforeEach, getNappletFrame } from './helpers/index.js';

// Experimental x- NAP (`x-echo` fixture) hosted without changing any kehto
// package. Kehto spec-gap policy: x- domains, x-<domain>:<action> capabilities
// and the host-facing unconfigured state are not in napplet/naps (master 43cb3a4).

const fixtureDir = fileURLToPath(new URL('../fixtures/experimental-nap', import.meta.url));
type Napplet = Window & { napplet?: Record<string, Record<string, (...args: unknown[]) => unknown>> };

// Runs inside the napplet frame: say() racing a short deadline, so a silent
// ACL/firewall drop (no invented envelope) shows up as 'timeout'.
async function say(frame: Frame, text: string): Promise<string> {
  return frame.evaluate((input) => {
    const echo = (window as Napplet).napplet?.['x-echo'];
    if (!echo) return Promise.resolve('missing');
    return Promise.race([
      (echo.say(input) as Promise<string>).then((value) => `ok:${value}`, (error: Error & { code?: string }) => `error:${error.code}`),
      new Promise<string>((done) => setTimeout(() => done('timeout'), 1_500)),
    ]);
  }, text);
}

async function listenHeard(frame: Frame): Promise<void> {
  await frame.evaluate(() => {
    const w = window as Napplet & { heard?: string[] };
    w.heard = [];
    w.napplet?.['x-echo'].onHeard((text: unknown) => w.heard!.push(String(text)));
  });
}

async function heard(frame: Frame): Promise<string[]> {
  return frame.evaluate(() => (window as Window & { heard?: string[] }).heard ?? []);
}

test.describe('x-echo in Paja', () => {
  let target: ReturnType<typeof createServer>;
  let targetUrl: string;
  const servers: PajaServer[] = [];

  test.beforeAll(async () => {
    target = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<!doctype html><body><p>echo probe</p><script>window.parent.postMessage({type:"shell.ready"}, "*")</script>');
    });
    await new Promise<void>((done) => target.listen(0, '127.0.0.1', done));
    const address = target.address();
    if (!address || typeof address === 'string') throw new Error('target did not bind');
    targetUrl = `http://127.0.0.1:${address.port}`;
  });

  test.afterAll(async () => {
    for (const server of servers) await server.close();
    await new Promise<void>((done, fail) => target.close((error) => error ? fail(error) : done()));
  });

  async function paja(config: Record<string, unknown>): Promise<PajaServer> {
    const dir = mkdtempSync(join(tmpdir(), 'paja-x-echo-e2e-'));
    const path = join(dir, 'paja.config.json');
    writeFileSync(path, JSON.stringify(config), 'utf8');
    const server = await startPajaServer({ options: { targetUrl, port: 0, configPath: path } });
    servers.push(server);
    return server;
  }

  async function open(page: Page, server: PajaServer): Promise<Frame> {
    await page.goto(server.url);
    await expect(page.frameLocator('#napplet-frame').locator('body')).toContainText('echo probe');
    const frame = await (await page.locator('#napplet-frame').elementHandle())?.contentFrame();
    if (!frame) throw new Error('Paja napplet frame missing');
    return frame;
  }

  test('advertises, configures, round-trips, pushes, denies by ACL and rejects a shadowing module', async ({ page }) => {
    const server = await paja({ extensions: [join(fixtureDir, 'x-echo.js'), join(fixtureDir, 'shadow-llm.js')] });
    const frame = await open(page, server);
    const toggle = page.locator('#interface-toggles [data-interface-domain="x-echo"]');
    await expect(toggle).toHaveAttribute('data-state', 'unconfigured');
    await expect(toggle).toHaveText(/^⚠ x-echo$/);
    await expect(page.locator('#message-log [data-message-type="paja.extension.loaded"]')).toHaveCount(1);
    expect(await frame.evaluate(() => {
      const n = (window as Napplet).napplet!;
      return { supports: (n.shell.supports as (d: string) => boolean)('x-echo'), say: typeof n['x-echo'].say, llm: typeof n.llm?.generate };
    })).toEqual({ supports: true, say: 'function', llm: 'function' });

    // Collision: the shadowing module is refused; the built-in llm binding survives.
    await expect(page.locator('[data-extension-failure="shadow-llm.js"]')).toContainText('reserved NAP domain');
    await expect(page.locator('#message-log [data-message-type="paja.extension.error"]')).toHaveCount(1);

    expect(await say(frame, 'early')).toBe('error:not-configured');
    await page.locator('#paja-extension-x-echo-prefix').fill('echo>');
    await page.locator('#paja-extension-x-echo-save').click();
    await expect(toggle).toHaveAttribute('data-state', 'supported');
    await expect(toggle).toHaveText('x-echo');

    await listenHeard(frame);
    expect(await say(frame, 'hi')).toBe('ok:echo>hi');
    await expect.poll(() => heard(frame)).toEqual(['echo>hi']);

    const sendAcl = page.locator('#acl-controls [data-acl-capability="x-echo:send"]');
    await sendAcl.click();
    await expect(sendAcl).toHaveAttribute('data-enabled', 'false');
    expect(await say(frame, 'denied')).toBe('timeout');
    await sendAcl.click();
    expect(await say(frame, 'again')).toBe('ok:echo>again');
  });

  test('drops x-echo under a firewall deny and withholds it from a denied target environment', async ({ page }) => {
    const blocked = await paja({
      simulation: { firewall: { mode: 'deny' } },
      extensions: [{ module: join(fixtureDir, 'x-echo.js'), settings: { prefix: 'fw: ' } }],
    });
    const blockedFrame = await open(page, blocked);
    await expect(page.locator('#interface-toggles [data-interface-domain="x-echo"]')).toHaveAttribute('data-state', 'supported');
    expect(await say(blockedFrame, 'hi')).toBe('timeout');

    const denied = await paja({ extensions: [{ module: join(fixtureDir, 'x-echo.js'), settings: { prefix: 'p' }, deniedDTags: ['dev-target'] }] });
    const deniedFrame = await open(page, denied);
    expect(await deniedFrame.evaluate(() => {
      const n = (window as Napplet).napplet!;
      return { present: 'x-echo' in n, supports: (n.shell.supports as (d: string) => boolean)('x-echo') };
    })).toEqual({ present: false, supports: false });
    expect(await say(deniedFrame, 'hi')).toBe('missing');
  });

  test('disables the interface from its toggle', async ({ page }) => {
    const server = await paja({ extensions: [{ module: join(fixtureDir, 'x-echo.js'), settings: { prefix: 'p' } }] });
    await open(page, server);
    const toggle = page.locator('#interface-toggles [data-interface-domain="x-echo"]');
    await toggle.click();
    await expect(toggle).toHaveAttribute('data-state', 'disabled');
    await expect(page.frameLocator('#napplet-frame').locator('body')).toContainText('echo probe');
    await expect.poll(async () => {
      const frame = await (await page.locator('#napplet-frame').elementHandle())?.contentFrame();
      return frame?.evaluate(() => 'x-echo' in ((window as Napplet).napplet ?? {}));
    }).toBe(false);
  });
});

test.describe('x-echo in the playground', () => {
  test.use({ baseURL: 'http://localhost:4174' });
  test.describe.configure({ mode: 'serial' });

  async function chatFrame(page: Page): Promise<Frame> {
    await expect.poll(async () => {
      const frame = await getNappletFrame(page, 'chat-frame-container');
      return frame ? frame.evaluate(() => typeof (window as Napplet).napplet?.['x-echo']?.say) : 'none';
    }, { timeout: 20_000 }).toBe('function');
    return (await getNappletFrame(page, 'chat-frame-container'))!;
  }

  test('advertises, configures, round-trips, pushes and honors ACL, firewall and collisions', async ({ page }) => {
    test.setTimeout(90_000);
    await demoBeforeEach(page, { path: '/?kehto-test' });
    const frame = await chatFrame(page);
    const toggle = page.locator('#playground-extension-controls [data-interface-domain="x-echo"]');
    await expect(toggle).toHaveAttribute('data-state', 'unconfigured');
    await expect(toggle).toHaveText(/^⚠ x-echo$/);
    expect(await frame.evaluate(() => {
      const shell = (window as Napplet).napplet?.shell;
      return shell ? (shell.supports as (d: string) => boolean)('x-echo') : 'x-echo' in ((window as Napplet).napplet ?? {});
    })).toBe(true);

    expect(await say(frame, 'early')).toBe('error:not-configured');
    await page.locator('#playground-extension-x-echo-prefix').fill('pg>');
    await page.locator('#playground-extension-x-echo-save').click();
    await expect(toggle).toHaveAttribute('data-state', 'supported');

    await listenHeard(frame);
    expect(await say(frame, 'hi')).toBe('ok:pg>hi');
    await expect.poll(() => heard(frame)).toEqual(['pg>hi']);

    await page.locator('#acl-expand-all-btn').click();
    const sendAcl = page.locator('#chat-acl [data-acl-capability="x-echo:send"]');
    await sendAcl.click();
    await expect(sendAcl).toHaveAttribute('data-enabled', 'false');
    expect(await say(frame, 'denied')).toBe('timeout');
    await sendAcl.click();
    expect(await say(frame, 'granted')).toBe('ok:pg>granted');

    type Hook = { setFirewallPolicy(d: string, p: string): void; declare(d: string): string | null; setDenied(x: string, d: string, v: boolean): void };
    await page.evaluate(() => (window as unknown as { __kehtoPlaygroundExtensions__: Hook }).__kehtoPlaygroundExtensions__.setFirewallPolicy('chat', 'deny'));
    expect(await say(frame, 'walled')).toBe('timeout');
    await page.evaluate(() => (window as unknown as { __kehtoPlaygroundExtensions__: Hook }).__kehtoPlaygroundExtensions__.setFirewallPolicy('chat', 'allow'));
    expect(await say(frame, 'open')).toBe('ok:pg>open');

    expect(await page.evaluate(() => {
      const hook = (window as unknown as { __kehtoPlaygroundExtensions__: Hook }).__kehtoPlaygroundExtensions__;
      return ['llm', 'x-llm', 'x-echo', 'x-new'].map((domain) => hook.declare(domain));
    })).toEqual([
      expect.stringMatching(/reserved NAP domain/),
      expect.stringMatching(/aliases the reserved NAP domain llm/),
      expect.stringMatching(/declared twice/),
      null,
    ]);
  });

  test('withholds x-echo from one napplet through resolveEnvironment', async ({ page }) => {
    test.setTimeout(90_000);
    await demoBeforeEach(page, { path: '/?kehto-test' });
    await chatFrame(page);
    await page.evaluate(() => (window as unknown as { __kehtoPlaygroundExtensions__: { setDenied(x: string, d: string, v: boolean): void } })
      .__kehtoPlaygroundExtensions__.setDenied('x-echo', 'chat', true));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#topology-root', { state: 'visible', timeout: 15_000 });
    await expect.poll(async () => {
      const prefs = await getNappletFrame(page, 'preferences-frame-container');
      return prefs ? prefs.evaluate(() => typeof (window as Napplet).napplet?.['x-echo']?.say) : 'none';
    }, { timeout: 20_000 }).toBe('function');
    await expect.poll(async () => {
      const chat = await getNappletFrame(page, 'chat-frame-container');
      return chat ? chat.evaluate(() => (window as Napplet).napplet ? 'x-echo' in (window as Napplet).napplet! : 'pending') : 'none';
    }, { timeout: 20_000 }).toBe(false);
  });

  test('keeps the extension test hook off without ?kehto-test (IN-05)', async ({ page }) => {
    test.setTimeout(90_000);
    await demoBeforeEach(page);
    expect(await page.evaluate(() => typeof (window as Window & { __clearAclEvents__?: unknown }).__clearAclEvents__)).toBe('function');
    expect(await page.evaluate(() => '__kehtoPlaygroundExtensions__' in window)).toBe(false);
  });
});
