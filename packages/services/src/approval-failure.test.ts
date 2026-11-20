/**
 * approval-failure.test.ts — a non-executed approval that is not a policy
 * decision (`capacity`, `busy`, `unavailable`) never reaches the wire as a
 * denial (kehto/web#513). Denials keep each NAP's policy code.
 */

import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage, NostrEvent } from '@napplet/core';
import type { ServiceHandler, ServiceRuntimeContext } from '@kehto/runtime';
import { APPROVAL_BUSY, APPROVAL_CAPACITY, APPROVAL_UNAVAILABLE, approvalFailure } from './approval-failure.js';
import { createCvmService, type CvmTransport } from './cvm-service.js';
import { createCountService } from './count-service.js';
import { createOutboxService, type StreamingOutboxRouter } from './outbox-service.js';
import { createThemeService } from './theme-service.js';
import { createIdentityService } from './identity-service.js';
import { createLinkService } from './link-service.js';
import { createCommonService } from './common-service.js';
import { createSerialService } from './serial-service.js';
import { createResourceService } from './resource-service.js';

const PK = 'a'.repeat(64);
const event: NostrEvent = { id: 'e'.repeat(64), pubkey: PK, kind: 1, tags: [], content: 'hi', created_at: 1, sig: 'f'.repeat(128) };
const HOST = [['capacity', APPROVAL_CAPACITY], ['busy', APPROVAL_BUSY], ['unavailable', APPROVAL_UNAVAILABLE]] as const;

function withStatus(handler: ServiceHandler, status: string): ServiceHandler {
  handler.onRegistered?.({ authorizeOperation: vi.fn(async () => ({ status })) } as unknown as ServiceRuntimeContext);
  return handler;
}

async function reply(handler: ServiceHandler, message: NappletMessage): Promise<Record<string, unknown>> {
  const send = vi.fn();
  handler.handleMessage('w', message, send);
  await vi.waitFor(() => expect(send).toHaveBeenCalled());
  return send.mock.calls[0]![0] as Record<string, unknown>;
}

const transport = {
  discover: vi.fn(async () => []), close: vi.fn(async () => {}), dispose: vi.fn(),
  onEvent: () => ({ close() {} }), request: vi.fn(async () => ({ jsonrpc: '2.0', id: 1, result: {} })),
} as unknown as CvmTransport;
const cvmRequest = { type: 'cvm.request', id: 'r', server: { pubkey: PK, relays: ['wss://relay.example'] }, message: { jsonrpc: '2.0', id: 'r', method: 'tools/list' } } as NappletMessage;

function outboxRouter(): StreamingOutboxRouter {
  const plan = { relays: ['wss://relay.example'], groups: [], unresolvedAuthors: [] };
  return {
    query: vi.fn(async () => ({ events: [] })), subscribe: vi.fn(() => ({ close: vi.fn() })), publish: vi.fn(async () => ({ ok: true })),
    resolveRelays: vi.fn(async () => plan), queryStream: vi.fn(() => ({ result: Promise.resolve({ events: [] }), close: vi.fn() })),
    planRead: vi.fn(async () => plan), queryWithPlan: vi.fn(async () => ({ events: [{ event }] })),
  } as unknown as StreamingOutboxRouter;
}

describe('approvalFailure', () => {
  it.each(HOST)('maps %s to its host reason, never the denial', (status, reason) => {
    expect(approvalFailure(status, { denied: 'policy denied' })).toBe(reason);
  });

  it('keeps the denial for denied and, without a cancel code, cancelled', () => {
    expect(approvalFailure('denied', { denied: 'policy denied', cancelled: 'user cancelled' })).toBe('policy denied');
    expect(approvalFailure('cancelled', { denied: 'policy denied' })).toBe('policy denied');
    expect(approvalFailure('cancelled', { denied: 'policy denied', cancelled: 'user cancelled' })).toBe('user cancelled');
  });
});

describe('capacity, busy and unavailable approvals are not denials on the wire', () => {
  it.each(HOST)('CVM %s: cvm.request.result error is the host reason', async (status, reason) => {
    const service = withStatus(createCvmService({ transport }), status);
    expect(await reply(service, cvmRequest)).toEqual({ type: 'cvm.request.result', id: 'r', error: reason });
  });

  it.each(HOST)('COUNT %s: count-unavailable with the approval reason', async (status, reason) => {
    const service = withStatus(createCountService({ count: () => 1 }), status);
    expect(await reply(service, { type: 'count.query', id: 'c', filters: [{ kinds: [1] }] } as NappletMessage))
      .toMatchObject({ type: 'count.query.result', id: 'c', ok: false, error: 'count-unavailable', reason });
  });

  it.each(HOST)('OUTBOX %s: outbox.query.result error is the host reason', async (status, reason) => {
    const service = withStatus(createOutboxService({ router: outboxRouter() }), status);
    expect(await reply(service, { type: 'outbox.query', id: 'q', filters: [{ authors: [PK] }] } as NappletMessage))
      .toEqual({ type: 'outbox.query.result', id: 'q', events: [], error: reason });
  });

  it.each(HOST)('THEME %s: theme.get.result error is the host reason', async (status, reason) => {
    const service = withStatus(createThemeService().handler, status);
    expect(await reply(service, { type: 'theme.get', id: 't' } as NappletMessage)).toEqual({ type: 'theme.get.result', id: 't', error: reason });
  });

  it.each(HOST)('IDENTITY %s: keeps the safe default and carries the host reason', async (status, reason) => {
    const service = withStatus(createIdentityService({ getSigner: () => null } as never), status);
    expect(await reply(service, { type: 'identity.getFollows', id: 'i' } as NappletMessage))
      .toEqual({ type: 'identity.getFollows.result', id: 'i', pubkeys: [], error: reason });
  });

  it.each([
    ['CVM', () => createCvmService({ transport }), cvmRequest, { error: 'policy denied' }],
    ['COUNT', () => createCountService({ count: () => 1 }), { type: 'count.query', id: 'c', filters: [{ kinds: [1] }] }, { ok: false, error: 'policy-denied' }],
    ['THEME', () => createThemeService().handler, { type: 'theme.get', id: 't' }, { error: 'policy denied' }],
  ] as const)('%s denied keeps the policy code', async (_name, make, message, expected) => {
    expect(await reply(withStatus(make(), 'denied'), message as NappletMessage)).toMatchObject(expected);
  });

  it.each([
    ['LINK', () => createLinkService({ open: vi.fn(() => ({ status: 'opened' as const })) }), { type: 'link.open', id: 'l', url: 'https://example.com/' },
      { type: 'link.open.result', id: 'l', status: 'denied', error: APPROVAL_CAPACITY }],
    ['COMMON', () => createCommonService(), { type: 'common.encodeNip19', id: 'n', input: { type: 'npub', pubkey: PK } },
      { type: 'common.encodeNip19.result', id: 'n', ok: false, error: APPROVAL_CAPACITY }],
    ['SERIAL', () => createSerialService({ open: vi.fn() as never }), { type: 'serial.open', id: 's', request: { options: { baudRate: 9600 } } },
      { type: 'serial.open.result', id: 's', error: APPROVAL_CAPACITY }],
  ] as const)('%s capacity surfaces the host reason', async (_name, make, message, expected) => {
    expect(await reply(withStatus(make(), 'capacity'), message as unknown as NappletMessage)).toEqual(expected);
  });

  it('RESOURCE capacity is a network-error, not blocked-by-policy (spec gap, NAP-RESOURCE #80 @ ae5b9c64)', async () => {
    const make = () => createResourceService({ fetch: vi.fn() as never });
    const capacity = await reply(withStatus(make(), 'capacity'), { type: 'resource.bytes', id: 'r', url: 'https://example.com/a' } as NappletMessage);
    expect(JSON.stringify(capacity)).toContain('network-error');
    expect(JSON.stringify(capacity)).toContain(APPROVAL_CAPACITY);
    expect(JSON.stringify(capacity)).not.toContain('blocked-by-policy');
    const denied = await reply(withStatus(make(), 'denied'), { type: 'resource.bytes', id: 'r', url: 'https://example.com/a' } as NappletMessage);
    expect(JSON.stringify(denied)).toContain('blocked-by-policy');
  });
});
