import type { NostrEvent } from '@napplet/core';
import type {
  OutboxResult,
  OutboxRouter,
  OutboxRouterSubscription,
  OutboxSubscriptionSink,
} from '@kehto/services';
import type { RelayEventResult } from '@kehto/runtime';
import { describe, expect, it, vi } from 'vitest';

import {
  BLOSSOM_SERVER_LIST_KIND,
  createPajaBlossomEventResolver,
} from './browser-blossom-events.js';

const PUBLISHER = 'a'.repeat(64);
const HINTED_AUTHOR = 'b'.repeat(64);
const SHELL_SIGNER = 'd'.repeat(64);
const HASH = 'c'.repeat(64);
const SECOND_HASH = 'e'.repeat(64);
const RESOURCE_URL = `blossom:sha256:${HASH}`;
const SECOND_RESOURCE_URL = `blossom:sha256:${SECOND_HASH}`;

function event(
  id: string,
  pubkey: string,
  kind: number,
  tags: string[][],
  content = '',
  createdAt = 1,
): NostrEvent {
  return {
    id: id.repeat(64).slice(0, 64),
    pubkey,
    kind,
    tags,
    content,
    created_at: createdAt,
    sig: 'd'.repeat(128),
  };
}

function result(value: NostrEvent): RelayEventResult {
  return { event: value };
}

function router(
  query: (filters: Parameters<OutboxRouter['query']>[0]) => Promise<OutboxResult>,
): OutboxRouter {
  return {
    query,
    subscribe: (
      _filters: Parameters<OutboxRouter['subscribe']>[0],
      _options: Parameters<OutboxRouter['subscribe']>[1],
      _sink: OutboxSubscriptionSink,
    ): OutboxRouterSubscription => ({ close() {} }),
    publish: async () => ({ ok: true }),
    resolveRelays: async () => ({ relays: [], source: 'fallback' }),
  };
}

describe('createPajaBlossomEventResolver', () => {
  it('prioritizes ROM-event hints and publisher lists before the shell signer fallback', async () => {
    const rom = event(
      '1',
      PUBLISHER,
      32_560,
      [
        ['resource', `blossom:${HASH}.gbc?xs=tag.example&as=${HINTED_AUTHOR}`, 'blossom'],
        ['server', 'https://event-wide.example'],
      ],
      JSON.stringify({
        sources: [{
          type: 'blossom',
          uri: RESOURCE_URL,
          servers: ['https://content.example', 'http://private.example'],
        }],
      }),
    );
    const lists = new Map([
      [HINTED_AUTHOR, event('2', HINTED_AUTHOR, BLOSSOM_SERVER_LIST_KIND, [
        ['server', 'https://hinted-author.example'],
      ])],
      [PUBLISHER, event('3', PUBLISHER, BLOSSOM_SERVER_LIST_KIND, [
        ['server', 'https://publisher.example'],
        ['server', 'https://localhost'],
      ])],
      [SHELL_SIGNER, event('4', SHELL_SIGNER, BLOSSOM_SERVER_LIST_KIND, [
        ['server', 'https://shell-signer.example'],
      ])],
    ]);
    const query = vi.fn(async (filters: Parameters<OutboxRouter['query']>[0]) => {
      const filter = filters[0];
      if (filter?.kinds?.includes(BLOSSOM_SERVER_LIST_KIND)) {
        const list = filter.authors?.[0] ? lists.get(filter.authors[0]) : undefined;
        return { events: list ? [result(list)] : [] };
      }
      return { events: [result(rom)] };
    });
    const baseRouter = router(query);
    const resolver = createPajaBlossomEventResolver({
      baseRouter,
      getDefaultAuthors: () => [SHELL_SIGNER],
      getConfiguredServers: () => ['https://runtime.example'],
    });

    await resolver.decorate(baseRouter, 'rom-window').query([{ kinds: [32_560] }]);

    await expect(resolver.getServers(RESOURCE_URL, 'rom-window')).resolves.toEqual([
      'https://tag.example',
      'https://event-wide.example',
      'https://content.example',
      'https://hinted-author.example',
      'https://publisher.example',
      'https://shell-signer.example',
      'https://runtime.example',
    ]);
    expect(query).toHaveBeenCalledWith(
      [{ kinds: [BLOSSOM_SERVER_LIST_KIND], authors: [PUBLISHER], limit: 1 }],
      { authors: [PUBLISHER], limit: 1 },
    );
  });

  it('uses the active shell user list without event context or Blossom upload mode', async () => {
    const serverList = event('b', SHELL_SIGNER, BLOSSOM_SERVER_LIST_KIND, [
      ['server', 'https://shell-signer.example'],
    ]);
    const query = vi.fn(async () => ({ events: [result(serverList)] }));
    const resolver = createPajaBlossomEventResolver({
      baseRouter: router(query),
      getDefaultAuthors: () => [SHELL_SIGNER],
      getConfiguredServers: () => [],
    });

    await expect(resolver.getServers(RESOURCE_URL, 'rom-window')).resolves.toEqual([
      'https://shell-signer.example',
    ]);
    expect(query).toHaveBeenCalledWith(
      [{ kinds: [BLOSSOM_SERVER_LIST_KIND], authors: [SHELL_SIGNER], limit: 1 }],
      { authors: [SHELL_SIGNER], limit: 1 },
    );
  });

  it('uses a canonical resource event publisher when no event-local hint exists', async () => {
    const rom = event('4', PUBLISHER, 32_560, [['resource', RESOURCE_URL, 'blossom']]);
    const serverList = event('5', PUBLISHER, BLOSSOM_SERVER_LIST_KIND, [
      ['server', 'https://publisher.example'],
    ]);
    const query = vi.fn(async (filters: Parameters<OutboxRouter['query']>[0]) => ({
      events: filters[0]?.kinds?.includes(BLOSSOM_SERVER_LIST_KIND)
        ? [result(serverList)]
        : [result(rom)],
    }));
    const baseRouter = router(query);
    const resolver = createPajaBlossomEventResolver({
      baseRouter,
      getConfiguredServers: () => [],
    });

    await resolver.decorate(baseRouter, 'rom-window').query([{ kinds: [32_560] }]);
    await expect(resolver.getServers(RESOURCE_URL, 'rom-window')).resolves.toEqual([
      'https://publisher.example',
    ]);
    await resolver.getServers(RESOURCE_URL, 'rom-window');

    expect(query.mock.calls.filter(([filters]) =>
      filters[0]?.kinds?.includes(BLOSSOM_SERVER_LIST_KIND))).toHaveLength(1);
  });

  it('observes single-event and subscription results for the authenticated window', async () => {
    const single = event('9', PUBLISHER, 32_560, [
      ['resource', `${RESOURCE_URL}?xs=single.example`, 'blossom'],
    ]);
    const streamed = event('a', PUBLISHER, 32_560, [
      ['resource', `${SECOND_RESOURCE_URL}?xs=stream.example`, 'blossom'],
    ]);
    let subscriptionSink: OutboxSubscriptionSink | undefined;
    const baseRouter = router(async () => ({ events: [] }));
    baseRouter.getEvent = vi.fn(async () => ({ result: result(single) }));
    baseRouter.subscribe = vi.fn((_filters, _options, sink) => {
      subscriptionSink = sink;
      return { close() {} };
    });
    const resolver = createPajaBlossomEventResolver({
      baseRouter,
      getConfiguredServers: () => [],
    });
    const decorated = resolver.decorate(baseRouter, 'rom-window');

    await decorated.getEvent?.(single.id);
    decorated.subscribe([{ kinds: [32_560] }], undefined, {
      event() {},
      closed() {},
    });
    subscriptionSink?.event(result(streamed));

    await expect(resolver.getServers(RESOURCE_URL, 'rom-window')).resolves.toEqual([
      'https://single.example',
    ]);
    await expect(resolver.getServers(SECOND_RESOURCE_URL, 'rom-window')).resolves.toEqual([
      'https://stream.example',
    ]);
  });

  it('keeps event-derived locations window-scoped and clears them on teardown', async () => {
    const rom = event('6', PUBLISHER, 32_560, [
      ['resource', `blossom:${HASH}.gb?xs=https%3A%2F%2Fevent.example`, 'blossom'],
    ]);
    const baseRouter = router(async () => ({ events: [result(rom)] }));
    const resolver = createPajaBlossomEventResolver({
      baseRouter,
      getConfiguredServers: () => ['https://runtime.example'],
    });

    resolver.setWindowServers('first-window', ['https://pointer.example']);
    await resolver.decorate(baseRouter, 'first-window').query([{ kinds: [32_560] }]);
    await expect(resolver.getServers(RESOURCE_URL, 'first-window')).resolves.toEqual([
      'https://event.example',
      'https://pointer.example',
      'https://runtime.example',
    ]);
    await expect(resolver.getServers(RESOURCE_URL, 'second-window')).resolves.toEqual([
      'https://runtime.example',
    ]);
    resolver.clearWindow('first-window');
    await expect(resolver.getServers(RESOURCE_URL, 'first-window')).resolves.toEqual([
      'https://runtime.example',
    ]);
  });

  it('does not cache an incomplete publisher-list miss', async () => {
    const rom = event('7', PUBLISHER, 32_560, [['resource', RESOURCE_URL, 'blossom']]);
    let listAttempts = 0;
    const query = vi.fn(async (filters: Parameters<OutboxRouter['query']>[0]) => {
      if (!filters[0]?.kinds?.includes(BLOSSOM_SERVER_LIST_KIND)) {
        return { events: [result(rom)] };
      }
      listAttempts += 1;
      if (listAttempts === 1) return { events: [], incomplete: true };
      return {
        events: [result(event('8', PUBLISHER, BLOSSOM_SERVER_LIST_KIND, [
          ['server', 'https://publisher.example'],
        ]))],
      };
    });
    const baseRouter = router(query);
    const resolver = createPajaBlossomEventResolver({
      baseRouter,
      getConfiguredServers: () => [],
    });
    await resolver.decorate(baseRouter, 'rom-window').query([{ kinds: [32_560] }]);

    await expect(resolver.getServers(RESOURCE_URL, 'rom-window')).resolves.toEqual([]);
    await expect(resolver.getServers(RESOURCE_URL, 'rom-window')).resolves.toEqual([
      'https://publisher.example',
    ]);
  });
});
