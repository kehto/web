/**
 * identity-decrypt Layer-A spec -- E2E-27 Phase 46.
 *
 * Drives identity.decrypt through the harness/runtime path without the full
 * preview UI. Covers all three happy encryption modes and all 8 typed error
 * codes from the reference identity service.
 */
import { test, expect, type Page } from '@playwright/test';
import { aclBeforeEach, waitForNappletReady } from './helpers/index.js';

type ModeName = 'nip04' | 'nip44' | 'nip17';

interface ModeFixture {
  event: Record<string, unknown>;
  expected: { mode: ModeName; id: string };
}

interface DecryptResponse {
  type: 'identity.decrypt.result' | 'identity.decrypt.error';
  id: string;
  rumor?: { content: string; created_at?: number };
  error?: string;
}

const ERROR_CODES = [
  'class-forbidden',
  'signer-denied',
  'signer-unavailable',
  'decrypt-failed',
  'malformed-wrap',
  'impersonation',
  'unsupported-encryption',
  'policy-denied',
] as const;

async function setupDecryptHarness(page: Page): Promise<{
  windowId: string;
  fixtures: Record<ModeName, ModeFixture>;
}> {
  await aclBeforeEach(page);
  const installed = await page.evaluate(() => window.__installIdentityDecryptService__());
  expect(installed).toBe(true);
  const windowId = await page.evaluate(() => window.__loadNapplet__('nub-identity'));
  await waitForNappletReady(page, windowId);
  const fixtures = await page.evaluate(() => window.__makeIdentityDecryptFixtures__());
  return { windowId, fixtures };
}

async function injectDecrypt(
  page: Page,
  windowId: string,
  id: string,
  event: Record<string, unknown>,
): Promise<DecryptResponse> {
  await page.evaluate(
    ([wid, requestId, decryptEvent]) => {
      window.__injectEnvelope__(wid, {
        type: 'identity.decrypt',
        id: requestId,
        event: decryptEvent,
      } as any);
    },
    [windowId, id, event] as const,
  );
  await page.waitForFunction(
    ([wid, requestId]) => {
      const result = window.__getNubMessage__(wid, 'identity.decrypt.result') as { id?: string } | null;
      const error = window.__getNubMessage__(wid, 'identity.decrypt.error') as { id?: string } | null;
      return result?.id === requestId || error?.id === requestId;
    },
    [windowId, id] as const,
    { timeout: 8_000 },
  );
  return page.evaluate(
    ([wid, requestId]) => {
      const result = window.__getNubMessage__(wid, 'identity.decrypt.result') as DecryptResponse | null;
      if (result?.id === requestId) return result;
      const error = window.__getNubMessage__(wid, 'identity.decrypt.error') as DecryptResponse | null;
      if (error?.id === requestId) return error;
      throw new Error(`missing decrypt response ${requestId}`);
    },
    [windowId, id] as const,
  );
}

test.describe.configure({ mode: 'serial' });

for (const mode of ['nip04', 'nip44', 'nip17'] as const) {
  test(`identity.decrypt ${mode} returns expected rumor payload`, async ({ page }) => {
    const { windowId, fixtures } = await setupDecryptHarness(page);
    const response = await injectDecrypt(page, windowId, `happy-${mode}`, fixtures[mode].event);

    expect(response.type).toBe('identity.decrypt.result');
    expect(response.id).toBe(`happy-${mode}`);
    const payload = JSON.parse(response.rumor?.content ?? '{}') as { mode?: string; id?: string };
    expect(payload).toEqual(fixtures[mode].expected);
  });
}

test('identity.decrypt response is delivered only to the requesting napplet', async ({ page }) => {
  const { windowId, fixtures } = await setupDecryptHarness(page);
  const observerWindowId = await page.evaluate(() => window.__loadNapplet__('nub-storage'));
  await waitForNappletReady(page, observerWindowId);

  const response = await injectDecrypt(page, windowId, 'single-target-nip04', fixtures.nip04.event);

  expect(response.type).toBe('identity.decrypt.result');
  const observerMessages = await page.evaluate((wid) => ({
    result: window.__getNubMessage__(wid, 'identity.decrypt.result'),
    error: window.__getNubMessage__(wid, 'identity.decrypt.error'),
  }), observerWindowId);
  expect(observerMessages).toEqual({ result: null, error: null });
});

for (const code of ERROR_CODES) {
  test(`identity.decrypt maps typed error ${code}`, async ({ page }) => {
    const { windowId, fixtures } = await setupDecryptHarness(page);
    await page.evaluate((nextError) => {
      window.__setDecryptBridgeError__(nextError);
    }, code);

    const response = await injectDecrypt(page, windowId, `error-${code}`, fixtures.nip04.event);

    expect(response.type).toBe('identity.decrypt.error');
    expect(response.id).toBe(`error-${code}`);
    expect(response.error).toBe(code);
  });
}
