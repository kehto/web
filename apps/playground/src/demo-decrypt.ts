import type { NostrEvent } from '@kehto/shell';
import type { HostDecryptBridge } from '@kehto/services';
import { nip04, nip44, nip17 } from 'nostr-tools';
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

const DEMO_DECRYPT_SECRET_KEY = hexToBytes('11'.repeat(32));
export const DEMO_DECRYPT_PUBKEY = getPublicKey(DEMO_DECRYPT_SECRET_KEY);
const DEMO_DECRYPT_SENDER_SECRET_KEY = hexToBytes('22'.repeat(32));

export interface DemoDecryptModeFixture {
  event: NostrEvent;
  expected: { mode: 'nip04' | 'nip44' | 'nip17'; id: string };
}

export interface DemoDecryptFixtures {
  nip04: DemoDecryptModeFixture;
  nip44: DemoDecryptModeFixture;
  nip17: DemoDecryptModeFixture;
}

let demoDecryptBridgeCallCount = 0;

function recordDemoDecryptBridgeCall(): void {
  demoDecryptBridgeCallCount++;
}

export function getDemoDecryptBridgeCallCount(): number {
  return demoDecryptBridgeCallCount;
}

export function resetDemoDecryptBridgeCallCount(): void {
  demoDecryptBridgeCallCount = 0;
}

function finalizeDemoDecryptEvent(kind: number, content: string, createdAt: number): NostrEvent {
  return finalizeEvent({
    kind,
    content,
    tags: [['p', DEMO_DECRYPT_PUBKEY]],
    created_at: createdAt,
  }, DEMO_DECRYPT_SENDER_SECRET_KEY) as NostrEvent;
}

export async function createDemoDecryptFixtures(): Promise<DemoDecryptFixtures> {
  const payloads = {
    nip04: { mode: 'nip04' as const, id: 'fixture-nip04' },
    nip44: { mode: 'nip44' as const, id: 'fixture-nip44' },
    nip17: { mode: 'nip17' as const, id: 'fixture-nip17' },
  };
  const nip04Content = await nip04.encrypt(
    DEMO_DECRYPT_SENDER_SECRET_KEY,
    DEMO_DECRYPT_PUBKEY,
    JSON.stringify(payloads.nip04),
  );
  const conversationKey = nip44.v2.utils.getConversationKey(
    DEMO_DECRYPT_SENDER_SECRET_KEY,
    DEMO_DECRYPT_PUBKEY,
  );
  const nip44Content = nip44.v2.encrypt(JSON.stringify(payloads.nip44), conversationKey);
  const nip17Event = nip17.wrapEvent(
    DEMO_DECRYPT_SENDER_SECRET_KEY,
    { publicKey: DEMO_DECRYPT_PUBKEY },
    JSON.stringify(payloads.nip17),
  ) as NostrEvent;

  return {
    nip04: {
      event: finalizeDemoDecryptEvent(4, nip04Content, 1_700_000_004),
      expected: payloads.nip04,
    },
    nip44: {
      event: finalizeDemoDecryptEvent(14, nip44Content, 1_700_000_014),
      expected: payloads.nip44,
    },
    nip17: {
      event: nip17Event,
      expected: payloads.nip17,
    },
  };
}

export function createDemoDecryptBridge(): HostDecryptBridge {
  return {
    async nip04Decrypt(senderPubkey: string, ciphertext: string): Promise<string> {
      recordDemoDecryptBridgeCall();
      return nip04.decrypt(DEMO_DECRYPT_SECRET_KEY, senderPubkey, ciphertext);
    },
    async nip44Decrypt(senderPubkey: string, ciphertext: string): Promise<string> {
      recordDemoDecryptBridgeCall();
      const conversationKey = nip44.v2.utils.getConversationKey(DEMO_DECRYPT_SECRET_KEY, senderPubkey);
      return nip44.v2.decrypt(ciphertext, conversationKey);
    },
    async unwrapGiftWrap(wrap: NostrEvent) {
      recordDemoDecryptBridgeCall();
      const rumor = nip17.unwrapEvent(
        wrap as Parameters<typeof nip17.unwrapEvent>[0],
        DEMO_DECRYPT_SECRET_KEY,
      );
      const seal: NostrEvent = {
        ...wrap,
        id: `${wrap.id}:seal`,
        kind: 13,
        pubkey: rumor.pubkey,
        content: '',
        tags: [],
        created_at: rumor.created_at,
        sig: '',
      };
      return { seal, rumor };
    },
  };
}
