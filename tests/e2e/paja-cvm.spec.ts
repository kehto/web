/**
 * Paja NAP-CVM browser flow against an in-test ContextVM server.
 *
 * Spec check: NAP-CVM napplet/naps#31@28cf1bd (`discover` returns CvmServer
 * records from announcements; `request` relays one MCP message and resolves
 * with the correlated response; client keys and transport stay shell-owned).
 * This flow exercises discovery plus one correlated `tools/call`; the draft's
 * payment and multi-session isolation rules stay covered by unit tests.
 *
 * The fake server speaks the real wire: CEP-6 announcements (kinds 11316 and
 * 11317), and CEP-4 gift-wrapped (kind 21059, NIP-44) kind-25910 MCP messages.
 */
import { expect, test } from '@playwright/test';
import * as nip44 from 'nostr-tools/nip44';
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent, type NostrEvent } from 'nostr-tools/pure';
import type { PajaServer } from '../../packages/paja/dist/index.js';
import { installMemoryRelay, type MemoryRelay } from './helpers/memory-relay.js';
import {
  openFlowTarget,
  readTracked,
  settleApproving,
  startFlowRuntime,
  startFlowTarget,
  type FlowTarget,
  type FlowWindow,
} from './helpers/paja-flows.js';
import { installPajaApprovalDriver } from './paja-approval-driver.js';

test.beforeEach(async ({ page }) => { await installPajaApprovalDriver(page); });

const RELAY_URL = 'wss://paja-cvm-flows.example';
const KIND_CVM = 25910;
const KIND_GIFT_WRAP_EPHEMERAL = 21059;
const TRUST_SCORE = '0.87';

let target: FlowTarget;
let runtime: PajaServer;

test.beforeAll(async () => {
  target = await startFlowTarget(['cvm']);
  runtime = await startFlowRuntime(target, RELAY_URL);
});

test.afterAll(async () => {
  await runtime.close();
  await target.close();
});

interface McpMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: Record<string, unknown>;
}

/** Install a Relatr-shaped ContextVM server behind the memory relay. */
function installCvmServer(relay: MemoryRelay, options: { holdToolCalls?: boolean } = {}): {
  pubkey: string; received: McpMessage[]; clients: Set<string>; releaseToolCall(): void;
} {
  const held: Array<() => void> = [];
  const serverKey = generateSecretKey();
  const pubkey = getPublicKey(serverKey);
  const received: McpMessage[] = [];
  const clients = new Set<string>();
  const now = () => Math.floor(Date.now() / 1000);

  relay.store(finalizeEvent({
    kind: 11316,
    created_at: now(),
    tags: [['name', 'Relatr Fixture'], ['about', 'Trust scores over the social graph']],
    content: '{}',
  }, serverKey));
  relay.store(finalizeEvent({
    kind: 11317,
    created_at: now(),
    tags: [['i', '0'.repeat(64), 'calculate_trust_score']],
    content: '{}',
  }, serverKey));

  const respond = (clientPubkey: string, message: McpMessage): void => {
    const inner = finalizeEvent({
      kind: KIND_CVM,
      created_at: now(),
      tags: [['p', clientPubkey]],
      content: JSON.stringify(message),
    }, serverKey);
    const wrapKey = generateSecretKey();
    relay.store(finalizeEvent({
      kind: KIND_GIFT_WRAP_EPHEMERAL,
      created_at: now(),
      tags: [['p', clientPubkey]],
      content: nip44.encrypt(JSON.stringify(inner), nip44.getConversationKey(wrapKey, clientPubkey)),
    }, wrapKey));
  };

  relay.onPublish((wrap: NostrEvent) => {
    if (wrap.kind !== KIND_GIFT_WRAP_EPHEMERAL && wrap.kind !== 1059) return;
    if (!wrap.tags.some((tag) => tag[0] === 'p' && tag[1] === pubkey)) return;
    const inner = JSON.parse(nip44.decrypt(wrap.content, nip44.getConversationKey(serverKey, wrap.pubkey))) as NostrEvent;
    if (!verifyEvent(inner) || inner.kind !== KIND_CVM) return;
    clients.add(inner.pubkey);
    const message = JSON.parse(inner.content) as McpMessage;
    received.push(message);
    if (message.id === undefined) return;
    if (message.method === 'initialize') {
      respond(inner.pubkey, {
        jsonrpc: '2.0',
        id: message.id,
        result: { protocolVersion: '2025-11-25', capabilities: { tools: {} }, serverInfo: { name: 'relatr-fixture', version: '1.0.0' } },
      } as McpMessage);
      return;
    }
    if (message.method === 'tools/call') {
      const answer = () => respond(inner.pubkey, {
        jsonrpc: '2.0',
        id: message.id,
        result: { content: [{ type: 'text', text: TRUST_SCORE }], structuredContent: { trustScore: Number(TRUST_SCORE) } },
      } as McpMessage);
      if (options.holdToolCalls) held.push(answer);
      else answer();
      return;
    }
    respond(inner.pubkey, { jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'method not found' } } as McpMessage);
  });

  return { pubkey, received, clients, releaseToolCall: () => { held.shift()?.(); } };
}

test('discovers a ContextVM server and returns a trust score through a gift-wrapped tools/call', async ({ page }) => {
  test.setTimeout(60_000);
  const relay = await installMemoryRelay(page, RELAY_URL);
  const server = installCvmServer(relay);
  const frame = await openFlowTarget(page, runtime);
  const subject = getPublicKey(generateSecretKey());

  await frame.locator('body').evaluate(() => {
    const flow = window as unknown as FlowWindow;
    flow.__track('discover', flow.napplet.cvm.discover({ search: 'relatr' }));
  });
  const discovered = await settleApproving(page, frame, 'discover');
  expect(discovered.result.ok).toBe(true);
  const servers = (discovered.result as { value: Array<Record<string, unknown>> }).value;
  expect(servers).toEqual([expect.objectContaining({
    pubkey: server.pubkey,
    name: 'Relatr Fixture',
    capabilities: ['calculate_trust_score'],
  })]);

  await frame.locator('body').evaluate((_body, input) => {
    const flow = window as unknown as FlowWindow;
    flow.__track('trust', flow.napplet.cvm.callTool(
      { pubkey: input.server },
      'calculate_trust_score',
      { targetPubkey: input.subject },
    ));
  }, { server: server.pubkey, subject });
  const called = await settleApproving(page, frame, 'trust');
  expect(called.result).toEqual({
    ok: true,
    value: { content: [{ type: 'text', text: TRUST_SCORE }], structuredContent: { trustScore: 0.87 } },
  });

  const toolCall = server.received.find((message) => message.method === 'tools/call');
  expect(toolCall?.params).toMatchObject({ name: 'calculate_trust_score', arguments: { targetPubkey: subject } });
  // The client key is shell-owned and ephemeral: never the napplet's or the user's.
  expect(server.clients.size).toBe(1);
  expect(relay.published.every((event) => event.kind !== KIND_CVM)).toBe(true);
  await expect(page.locator('#message-log [data-message-type="cvm.request"]')).not.toHaveCount(0);
});

/**
 * Spec check: NAP-CVM napplet/naps#31@28cf1bd, Security Considerations (shells
 * SHOULD apply per-napplet concurrency limits) and Timeouts (queueing spends
 * the accepted duration). The draft has no load-shedding error, so a full
 * queue is refused with `policy denied`; see kehto/web#355.
 */
test('admits one tool call at a time, queues the next, and refuses the overflow', async ({ page }) => {
  test.setTimeout(60_000);
  const limited = await startFlowRuntime(target, RELAY_URL, { cvm: { concurrency: { maxInFlight: 1, maxQueued: 1 } } });
  try {
    const relay = await installMemoryRelay(page, RELAY_URL);
    const server = installCvmServer(relay, { holdToolCalls: true });
    const frame = await openFlowTarget(page, limited);
    const toolCalls = () => server.received.filter((message) => message.method === 'tools/call');
    const approveUntil = (done: () => boolean) => expect.poll(async () => {
      if (done()) return true;
      if (await page.locator('#paja-confirmation-dialog').isVisible()) await page.locator('#paja-confirmation-approve').click();
      return false;
    }, { timeout: 20_000, intervals: [100, 200, 300] }).toBe(true);

    await frame.locator('body').evaluate((_body, pubkey) => {
      const flow = window as unknown as FlowWindow;
      for (const key of ['first', 'second', 'overflow']) {
        flow.__track(key, flow.napplet.cvm.callTool({ pubkey }, 'calculate_trust_score', { targetPubkey: key }));
      }
    }, server.pubkey);

    // The overflow is refused at receipt, while the first call is still unanswered.
    const overflow = await settleApproving(page, frame, 'overflow');
    expect(overflow.result).toEqual({ ok: false, error: expect.stringContaining('policy denied') });
    await approveUntil(() => toolCalls().length === 1);
    expect(await readTracked(frame, 'first')).toBeNull();
    expect(await readTracked(frame, 'second')).toBeNull();

    // Finishing the first call hands its slot to the queued one, which only now reaches the server.
    server.releaseToolCall();
    expect((await settleApproving(page, frame, 'first')).result.ok).toBe(true);
    await approveUntil(() => toolCalls().length === 2);
    server.releaseToolCall();
    expect((await settleApproving(page, frame, 'second')).result.ok).toBe(true);
    expect(toolCalls().map((message) => (message.params as { arguments: { targetPubkey: string } }).arguments.targetPubkey))
      .toEqual(['first', 'second']);
  } finally {
    await limited.close();
  }
});
