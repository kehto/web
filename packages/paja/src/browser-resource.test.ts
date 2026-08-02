import type { NappletMessage } from '@napplet/core';
import { describe, expect, it } from 'vitest';
import { createPajaAdapter } from './browser-adapter.js';
import {
  createPajaDataResourceFetch,
  PAJA_RESOURCE_MAX_BYTES,
  PAJA_RESOURCE_MAX_URLS,
  pajaResourceInfo,
} from './browser-resource.js';
import type { PajaHostConfig } from './options.js';
import { normalizePajaSimulation } from './simulation.js';

const CONFIG = {
  window: { id: 'resource-window', dTag: 'resource-napplet', aggregateHash: 'resource-hash' },
} as PajaHostConfig;

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('Paja resource backend', () => {
  it('discloses only the real data URL backend and its enforced limits', () => {
    expect(pajaResourceInfo()).toEqual({
      schemes: [{ scheme: 'data', enabled: true }],
      maxBytes: PAJA_RESOURCE_MAX_BYTES,
      maxUrls: PAJA_RESOURCE_MAX_URLS,
    });
  });

  it('classifies decoded bytes instead of trusting the declared media type', async () => {
    const fetchResource = createPajaDataResourceFetch();
    const response = await fetchResource(
      'data:image/png,%7B%22actual%22%3A%22json%22%7D',
      { signal: new AbortController().signal },
    );

    expect(response.headers.get('content-type')).toBe('application/json');
    expect(await response.text()).toBe('{"actual":"json"}');
  });

  it('rejects raw SVG and network schemes at the host boundary', async () => {
    const fetchResource = createPajaDataResourceFetch();
    const signal = new AbortController().signal;

    await expect(fetchResource('data:image/svg+xml,%3Csvg%3E%3C/svg%3E', { signal }))
      .rejects.toMatchObject({ code: 'decode-failed' });
    await expect(fetchResource('https://example.com/image.png', { signal }))
      .rejects.toMatchObject({ code: 'unsupported-scheme' });
  });

  it('routes data bytes through the service and denies HTTPS without network access', async () => {
    const adapter = createPajaAdapter(
      CONFIG,
      () => normalizePajaSimulation({ relay: { mode: 'disabled' } }),
      () => {},
      () => {},
      () => true,
    );
    const service = adapter.services?.resource;
    expect(service?.descriptor.name).toBe('resource');

    const sent: NappletMessage[] = [];
    service?.handleMessage('resource-window', {
      type: 'resource.bytes',
      id: 'data-1',
      url: 'data:text/html,hello%20world',
    } as NappletMessage, (message) => sent.push(message));
    await flushPromises();

    const result = sent[0] as NappletMessage & { blob: Blob; mime: string };
    expect(result).toMatchObject({
      type: 'resource.bytes.result',
      id: 'data-1',
      mime: 'text/plain',
    });
    expect(await result.blob.text()).toBe('hello world');

    service?.handleMessage('resource-window', {
      type: 'resource.bytes',
      id: 'https-1',
      url: 'https://example.com/tracker.png',
    } as NappletMessage, (message) => sent.push(message));
    await flushPromises();
    expect(sent[1]).toMatchObject({
      type: 'resource.bytes.error',
      id: 'https-1',
      error: 'unsupported-scheme',
    });

    (adapter.relayPool.getRelayPool() as unknown as { close(): void }).close();
  });
});
