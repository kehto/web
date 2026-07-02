import type { NappletMessage, NostrFilter } from '@napplet/core';

import type { RuntimeAdapter, ServiceRegistry } from './types.js';

type RuntimeCountMessage = NappletMessage & {
  id?: unknown;
  filters?: unknown;
  options?: unknown;
};

type CountHandlerContext = {
  hooks: RuntimeAdapter;
  serviceRegistry: ServiceRegistry;
};

export type CountHandler = (windowId: string, msg: NappletMessage) => void;

export function createCountHandler(context: CountHandlerContext): CountHandler {
  return function handleCountMessage(windowId: string, msg: NappletMessage): void {
    if (msg.type !== 'count.query') return;

    const message = msg as RuntimeCountMessage;
    const id = typeof message.id === 'string' ? message.id : '';
    const filters = message.filters;

    if (!isValidFilterArray(filters)) {
      sendCountError(context.hooks, windowId, id, 'invalid-filter', 'count.query requires a non-empty filters array');
      return;
    }

    if (message.options !== undefined && !isPlainObject(message.options)) {
      sendCountError(context.hooks, windowId, id, 'invalid-filter', 'count.query options must be an object when present');
      return;
    }

    const service = context.serviceRegistry['count'];
    if (!service) {
      sendCountError(
        context.hooks,
        windowId,
        id,
        'count-unavailable',
        'count service unavailable; refusing to emulate counts by fetching event payloads',
      );
      return;
    }

    service.handleMessage(windowId, msg, (resp: NappletMessage) => {
      context.hooks.sendToNapplet(windowId, normalizeCountResult(resp, id));
    });
  };
}

function normalizeCountResult(resp: NappletMessage, id: string): NappletMessage {
  const value = resp as NappletMessage & {
    id?: unknown;
    ok?: unknown;
    count?: unknown;
    approximate?: unknown;
    hll?: unknown;
    relays?: unknown;
    error?: unknown;
    reason?: unknown;
  };

  return {
    type: 'count.query.result',
    id: typeof value.id === 'string' ? value.id : id,
    ok: value.ok === true,
    ...(typeof value.count === 'number' && Number.isFinite(value.count) && value.count >= 0
      ? { count: Math.floor(value.count) }
      : {}),
    ...(typeof value.approximate === 'boolean' ? { approximate: value.approximate } : {}),
    ...(typeof value.hll === 'string' ? { hll: value.hll } : {}),
    ...(Array.isArray(value.relays) ? { relays: value.relays.filter((relay): relay is string => typeof relay === 'string') } : {}),
    ...(typeof value.error === 'string' ? { error: value.error } : {}),
    ...(typeof value.reason === 'string' ? { reason: value.reason } : {}),
  } as NappletMessage;
}

function sendCountError(
  hooks: RuntimeAdapter,
  windowId: string,
  id: string,
  error: string,
  reason: string,
): void {
  hooks.sendToNapplet(windowId, {
    type: 'count.query.result',
    id,
    ok: false,
    error,
    reason,
  } as NappletMessage);
}

function isValidFilterArray(value: unknown): value is NostrFilter[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every((filter) => isPlainObject(filter));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
