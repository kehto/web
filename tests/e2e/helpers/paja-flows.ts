/**
 * Shared Paja e2e harness for napplet service flows (relay, storage, ACL,
 * identity, CVM).
 *
 * The target is a minimal napplet served from a local HTTP server. It only
 * calls the injected `window.napplet.*` namespace — never `postMessage` — so
 * these flows exercise the same API real napplets use, independent of the
 * envelope transport underneath. In-frame calls are tracked by key and polled
 * from the test so host confirmation dialogs can be answered while a call is
 * pending.
 */
import { createServer } from 'node:http';
import { expect, type FrameLocator, type Page } from '@playwright/test';
import * as nip44 from 'nostr-tools/nip44';
import { finalizeEvent, getPublicKey, type EventTemplate } from 'nostr-tools/pure';
import { startPajaServer, type PajaServer } from '../../../packages/paja/dist/index.js';

/** Settled outcome of one tracked in-frame napplet call. */
export type TrackedResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: string };

/** Window globals installed by the flow target napplet. */
export interface FlowWindow {
  napplet: Record<string, any>;
  __track(key: string, promise: Promise<unknown>): void;
  __results: Record<string, TrackedResult>;
  __log: Record<string, unknown[]>;
  __push(channel: string, value: unknown): void;
}

/** Local HTTP server hosting the flow target napplet. */
export interface FlowTarget {
  readonly url: string;
  close(): Promise<void>;
}

const FLOW_TARGET_HTML = `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Kehto Paja flow target</title></head>
  <body>
    <output id="flow-status">booting</output>
    <script>
      window.__results = {};
      window.__log = {};
      window.__push = (channel, value) => { (window.__log[channel] ??= []).push(value); };
      window.__track = (key, promise) => {
        Promise.resolve(promise).then(
          (value) => { window.__results[key] = { ok: true, value: value === undefined ? null : value }; },
          (error) => { window.__results[key] = { ok: false, error: error instanceof Error ? error.message : String(error) }; },
        );
      };
      window.napplet.shell.ready().then(() => {
        document.getElementById('flow-status').textContent = 'ready';
      });
    </script>
  </body>
</html>`;

/**
 * Start the HTTP server that serves the flow target napplet.
 *
 * @returns Target URL and a close handle.
 * @example
 * ```ts
 * const target = await startFlowTarget();
 * ```
 */
export async function startFlowTarget(): Promise<FlowTarget> {
  const server = createServer((request, response) => {
    if ((request.url ?? '/').split('?')[0] !== '/') {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    response.writeHead(200, {
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
      'content-type': 'text/html; charset=utf-8',
    });
    response.end(FLOW_TARGET_HTML);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (typeof address !== 'object' || address === null) throw new Error('Flow target did not bind a TCP port.');
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

/**
 * Start a Paja runtime hosting the flow target against one live relay URL.
 *
 * @param target - Flow target server.
 * @param relayUrl - Relay URL Paja treats as its live relay set.
 * @returns The running Paja server.
 * @example
 * ```ts
 * const runtime = await startFlowRuntime(target, 'wss://flows-relay.example');
 * ```
 */
export async function startFlowRuntime(target: FlowTarget, relayUrl: string): Promise<PajaServer> {
  return startPajaServer({
    options: {
      targetUrl: target.url,
      port: 0,
      simulation: { relay: { mode: 'live', urls: [relayUrl] } },
    },
    now: new Date('2026-11-01T00:00:00.000Z'),
  });
}

/** Locator for the hosted napplet frame. */
export function nappletFrame(page: Page): FrameLocator {
  return page.frameLocator('#napplet-frame');
}

/**
 * Open the Paja runtime and wait until the napplet has completed NAP-SHELL readiness.
 *
 * @param page - Playwright page.
 * @param runtime - Paja server to open.
 * @returns The napplet frame locator.
 */
export async function openFlowTarget(page: Page, runtime: PajaServer): Promise<FrameLocator> {
  await page.goto(runtime.url);
  await expect.poll(() => page.evaluate(() => window.__KEHTO_PAJA__?.getState().status)).toBe('ready');
  const frame = nappletFrame(page);
  await expect(frame.locator('#flow-status')).toHaveText('ready', { timeout: 15_000 });
  return frame;
}

/** Read one tracked call result, or `null` while it is pending. */
export async function readTracked(frame: FrameLocator, key: string): Promise<TrackedResult | null> {
  return frame.locator('body').evaluate((_body, name) => (window as unknown as FlowWindow).__results[name] ?? null, key);
}

/** Read a napplet-side push log channel (events, EOSE, identity changes). */
export async function readLog(frame: FrameLocator, channel: string): Promise<unknown[]> {
  return frame.locator('body').evaluate((_body, name) => (window as unknown as FlowWindow).__log[name] ?? [], channel);
}

/**
 * Wait for a tracked call to settle, approving every host confirmation it raises.
 *
 * @param page - Playwright page hosting Paja.
 * @param frame - Napplet frame.
 * @param key - Tracked call key.
 * @returns The settled result and the confirmation titles that were approved.
 */
export async function settleApproving(
  page: Page,
  frame: FrameLocator,
  key: string,
): Promise<{ result: TrackedResult; approved: string[] }> {
  const approved: string[] = [];
  const dialog = page.locator('#paja-confirmation-dialog');
  await expect.poll(async () => {
    if (await readTracked(frame, key)) return true;
    if (await dialog.isVisible()) {
      approved.push((await page.locator('#paja-confirmation-title').textContent()) ?? '');
      await page.locator('#paja-confirmation-approve').click();
    }
    return false;
  }, { timeout: 20_000, intervals: [100, 200, 300] }).toBe(true);
  const result = await readTracked(frame, key);
  if (!result) throw new Error(`tracked call ${key} did not settle`);
  return { result, approved };
}

/** Secret-key backed NIP-07 signer exposed to the Paja host page. */
export interface KeySigner {
  readonly pubkey: string;
  /** Event templates the host asked the extension to sign. */
  readonly signed: EventTemplate[];
}

/**
 * Expose a real secret-key NIP-07 signer (signEvent + NIP-44) to the Paja host.
 *
 * @param page - Playwright page, before navigation.
 * @param secretKey - Signer secret key.
 * @param options - `installOnLoad: false` exposes the signer functions without
 *   defining `window.nostr`, so a spec can connect it later with {@link connectKeySigner}.
 * @returns Signer pubkey and the signing log.
 */
export async function installKeySigner(
  page: Page,
  secretKey: Uint8Array,
  options: { installOnLoad?: boolean } = {},
): Promise<KeySigner> {
  const pubkey = getPublicKey(secretKey);
  const signed: EventTemplate[] = [];
  await page.exposeFunction('__flowSignEvent', (template: EventTemplate) => {
    signed.push(template);
    return finalizeEvent(template, secretKey);
  });
  await page.exposeFunction('__flowNip44Encrypt', (peer: string, plaintext: string) =>
    nip44.encrypt(plaintext, nip44.getConversationKey(secretKey, peer)));
  await page.exposeFunction('__flowNip44Decrypt', (peer: string, ciphertext: string) =>
    nip44.decrypt(ciphertext, nip44.getConversationKey(secretKey, peer)));
  await page.addInitScript(({ signerPubkey, installOnLoad }) => {
    const host = window as unknown as Record<string, any>;
    host.__flowInstallNostr = () => {
      host.nostr = {
        getPublicKey: async () => signerPubkey,
        getRelays: async () => ({}),
        signEvent: (template: unknown) => host.__flowSignEvent(template),
        nip44: {
          encrypt: (peer: string, plaintext: string) => host.__flowNip44Encrypt(peer, plaintext),
          decrypt: (peer: string, ciphertext: string) => host.__flowNip44Decrypt(peer, ciphertext),
        },
      };
    };
    if (installOnLoad) host.__flowInstallNostr();
  }, { signerPubkey: pubkey, installOnLoad: options.installOnLoad ?? true });
  return { pubkey, signed };
}

/**
 * Define `window.nostr` after load and connect it through Paja's NIP-07 control.
 *
 * @param page - Playwright page hosting Paja.
 */
export async function connectKeySigner(page: Page): Promise<void> {
  await page.evaluate(() => (window as unknown as { __flowInstallNostr(): void }).__flowInstallNostr());
  await page.locator('#signer-nip07').click();
  await expect(page.locator('#signer-status')).toContainText('NIP-07 connected');
}
