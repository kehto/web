/**
 * Paja NAP-IDENTITY browser flows driven by the real signer controls.
 *
 * Spec check: NAP-IDENTITY napplet/naps master@43cb3a4 (getPublicKey returns ""
 * with no signer; the shell MUST push identity.changed to loaded napplets when
 * the shell-user identity changes, and push "" when the signer disconnects).
 *
 * Known gap (tracked by the `test.fixme` below): Paja re-initializes the
 * napplet frame on every signer change (`browser-adapter.ts` refreshes service
 * availability and the upload identity, then reloads the target environment)
 * instead of pushing `identity.changed` to the already-loaded napplet. The
 * passing tests pin the current contract — a re-initialized napplet reads the
 * new identity — so that gap stays visible without blocking this suite.
 */
import { expect, test, type FrameLocator, type Page } from '@playwright/test';
import { generateSecretKey } from 'nostr-tools/pure';
import type { PajaServer } from '../../packages/paja/dist/index.js';
import { installMemoryRelay } from './helpers/memory-relay.js';
import {
  connectKeySigner,
  installKeySigner,
  nappletFrame,
  openFlowTarget,
  readLog,
  readTracked,
  startFlowRuntime,
  startFlowTarget,
  type FlowTarget,
  type FlowWindow,
} from './helpers/paja-flows.js';
import { installPajaApprovalDriver } from './paja-approval-driver.js';

test.beforeEach(async ({ page }) => { await installPajaApprovalDriver(page); });

const RELAY_URL = 'wss://paja-identity-flows.example';

let target: FlowTarget;
let runtime: PajaServer;
let readCounter = 0;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  target = await startFlowTarget(['identity']);
  runtime = await startFlowRuntime(target, RELAY_URL);
});

test.afterAll(async () => {
  await runtime.close();
  await target.close();
});

/** Ask the current napplet frame for its identity; `null` while the frame is being replaced. */
async function readPublicKeyOnce(frame: FrameLocator): Promise<string | null> {
  readCounter += 1;
  const key = `pubkey-${readCounter}`;
  try {
    await frame.locator('body').evaluate((_body, name) => {
      const flow = window as unknown as FlowWindow;
      flow.__track(name, flow.napplet.identity.getPublicKey());
    }, key, { timeout: 2_000 });
    await expect.poll(() => readTracked(frame, key), { timeout: 2_000 }).not.toBeNull();
    const result = await readTracked(frame, key);
    return result?.ok ? String(result.value) : null;
  } catch {
    return null;
  }
}

/** Poll until the (possibly re-initialized) napplet reports `expected`. */
async function expectNappletIdentity(page: Page, expected: string): Promise<void> {
  await expect.poll(async () => {
    if (await page.evaluate(() => window.__KEHTO_PAJA__?.getState().status) !== 'ready') return null;
    return readPublicKeyOnce(nappletFrame(page));
  }, { timeout: 20_000 }).toBe(expected);
}

test('napplets read the connected signer identity and an empty identity after the signer fails', async ({ page }) => {
  test.setTimeout(60_000);
  await installMemoryRelay(page, RELAY_URL);
  const signer = await installKeySigner(page, generateSecretKey(), { installOnLoad: false });
  const frame = await openFlowTarget(page, runtime);
  await expect(page.locator('#signer-status')).toContainText('no signer connected');
  expect(await readPublicKeyOnce(frame)).toBe('');

  await connectKeySigner(page);
  await expect(page.locator('#signer-status')).toContainText(`pubkey ${signer.pubkey}`);
  await expectNappletIdentity(page, signer.pubkey);

  // The extension stops answering: the reconnect attempt fails and the
  // shell-user identity is cleared.
  await page.evaluate(() => {
    (window as unknown as { nostr: { getPublicKey(): Promise<string> } }).nostr.getPublicKey = async () => {
      throw new Error('extension locked');
    };
  });
  await page.locator('#signer-nip07').click();
  await expect(page.locator('#signer-status')).toContainText('NIP-07 error: extension locked');
  await expectNappletIdentity(page, '');
});

test('fresh startup leaves an available extension untouched and None clears identity', async ({ page }) => {
  await installMemoryRelay(page, RELAY_URL);
  await page.addInitScript(() => {
    Object.assign(window, { signerCalls: 0, nostr: {
      getPublicKey: async () => {
        const host = window as unknown as { signerCalls: number };
        host.signerCalls += 1;
        return '7'.repeat(64);
      },
      signEvent: async () => { throw new Error('not used'); },
    } });
  });
  await openFlowTarget(page, runtime);
  expect(await page.evaluate(() => (window as unknown as { signerCalls: number }).signerCalls)).toBe(0);
  await expect(page.locator('#signer-none')).toHaveAttribute('data-active', 'true');
  await expectNappletIdentity(page, '');
  await page.locator('#signer-nip07').click();
  await expectNappletIdentity(page, '7'.repeat(64));
  await page.locator('#signer-none').click();
  await expectNappletIdentity(page, '');
  await page.reload();
  await openFlowTarget(page, runtime);
  await expect(page.locator('#signer-none')).toHaveAttribute('data-active', 'true');
  expect(await page.evaluate(() => (window as unknown as { signerCalls: number }).signerCalls)).toBe(0);
});

test('an explicitly selected NIP-07 signer reconnects after reload', async ({ page }) => {
  test.setTimeout(60_000);
  await installMemoryRelay(page, RELAY_URL);
  const signer = await installKeySigner(page, generateSecretKey());
  await openFlowTarget(page, runtime);
  await page.locator('#signer-nip07').click();
  await expect(page.locator('#signer-status')).toContainText(`NIP-07 connected · pubkey ${signer.pubkey}`);
  await expectNappletIdentity(page, signer.pubkey);

  await page.reload();
  await openFlowTarget(page, runtime);
  await expect(page.locator('#signer-status')).toContainText(`NIP-07 connected · pubkey ${signer.pubkey}`);
  await expectNappletIdentity(page, signer.pubkey);
});

test.fixme('a loaded napplet receives identity.changed for connect and disconnect without being re-initialized', async ({ page }) => {
  // NAP-IDENTITY: "Shells MUST use identity.changed to notify already-loaded
  // napplets when the shell-user identity changes." Paja currently reloads the
  // target instead, so the handler registered below is discarded with its frame.
  await installMemoryRelay(page, RELAY_URL);
  const signer = await installKeySigner(page, generateSecretKey(), { installOnLoad: false });
  const frame = await openFlowTarget(page, runtime);
  const generation = await page.evaluate(() => window.__KEHTO_PAJA__?.getState().generation);
  await frame.locator('body').evaluate(() => {
    const flow = window as unknown as FlowWindow;
    flow.napplet.identity.onChanged((pubkey: string) => flow.__push('identity', pubkey));
  });

  await connectKeySigner(page);
  await expect.poll(() => readLog(frame, 'identity')).toEqual([signer.pubkey]);
  expect(await page.evaluate(() => window.__KEHTO_PAJA__?.getState().generation)).toBe(generation);
});

test('Dev and disconnected Bunker choices survive reload without credentials', async ({ page }) => {
  await installMemoryRelay(page, RELAY_URL);
  await openFlowTarget(page, runtime);
  await page.locator('#signer-dev').click();
  await page.reload();
  await openFlowTarget(page, runtime);
  await expect(page.locator('#signer-dev')).toHaveAttribute('data-active', 'true');
  await page.locator('#signer-bunker-uri').fill('invalid-private-uri');
  await page.locator('#signer-bunker').click();
  await page.reload();
  await openFlowTarget(page, runtime);
  await expect(page.locator('#signer-bunker')).toHaveAttribute('data-active', 'true');
  await expect(page.locator('#signer-bunker-uri')).toHaveValue('');
  await expect(page.locator('#signer-status')).toContainText('no signer connected');
  await expectNappletIdentity(page, '');
});
