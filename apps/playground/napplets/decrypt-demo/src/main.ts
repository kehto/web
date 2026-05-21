/**
 * decrypt-demo napplet -- exercises identity.decrypt (v1.8 Phase 46).
 *
 * The pinned @napplet/sdk@^0.2.1 namespace surface does not expose
 * identity.decrypt yet, so this demo sends the canonical envelope directly
 * while still using @napplet/shim for shell.ready / shell.init.
 */
import '@napplet/shim';

interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

type ModeName = 'nip04' | 'nip44' | 'nip17';

interface ModeFixture {
  event: NostrEvent;
  expected: { mode: ModeName; id: string };
}

interface DecryptFixtures {
  nip04: ModeFixture;
  nip44: ModeFixture;
  nip17: ModeFixture;
}

type DecryptResponse =
  | { type: 'identity.decrypt.result'; id: string; rumor: { content: string } }
  | { type: 'identity.decrypt.error'; id: string; error: string };

const statusEl = document.getElementById('decrypt-demo-status')!;
const nip04El = document.getElementById('decrypt-nip04-status')!;
const nip44El = document.getElementById('decrypt-nip44-status')!;
const nip17El = document.getElementById('decrypt-nip17-status')!;
const class2El = document.getElementById('decrypt-class2-status')!;
const class2Btn = document.getElementById('decrypt-class2-run') as HTMLButtonElement;
const logEl = document.getElementById('decrypt-demo-log')!;

let fixtures: DecryptFixtures | null = null;
let requestCounter = 0;
const pending = new Map<string, (response: DecryptResponse) => void>();

function setText(el: Element, text: string, ok = false): void {
  el.textContent = text;
  (el as HTMLElement).style.color = ok ? '#39ff14' : text.startsWith('error:') ? '#ff3b3b' : '#b0b0c0';
}

function log(text: string): void {
  const div = document.createElement('div');
  const time = new Date().toLocaleTimeString('en', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  div.textContent = `${time} ${text}`;
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}

function parsePayload(content: string): { mode?: string; id?: string } {
  try {
    return JSON.parse(content) as { mode?: string; id?: string };
  } catch {
    return {};
  }
}

function decrypt(event: NostrEvent, prefix: string): Promise<DecryptResponse> {
  const id = `${prefix}-${Date.now()}-${++requestCounter}`;
  const promise = new Promise<DecryptResponse>((resolve) => {
    pending.set(id, resolve);
  });
  window.parent.postMessage({ type: 'identity.decrypt', id, event }, '*');
  return promise;
}

async function runMode(name: ModeName, fixture: ModeFixture, el: Element): Promise<void> {
  setText(el, 'requesting');
  const response = await decrypt(fixture.event, `decrypt-${name}`);
  if (response.type === 'identity.decrypt.error') {
    setText(el, `error:${response.error}`);
    log(`${name} error ${response.error}`);
    return;
  }

  const payload = parsePayload(response.rumor.content);
  if (payload.mode === fixture.expected.mode && payload.id === fixture.expected.id) {
    setText(el, `ok:${payload.mode}:${payload.id}`, true);
    log(`${name} ok ${payload.id}`);
  } else {
    setText(el, `error:payload:${response.rumor.content}`);
    log(`${name} payload mismatch`);
  }
}

async function runHappyPath(next: DecryptFixtures): Promise<void> {
  fixtures = next;
  class2Btn.disabled = false;
  setText(statusEl, 'decrypting');
  await runMode('nip04', next.nip04, nip04El);
  await runMode('nip44', next.nip44, nip44El);
  await runMode('nip17', next.nip17, nip17El);
  setText(statusEl, 'done', true);
}

async function runClass2Probe(): Promise<void> {
  if (!fixtures) {
    setText(class2El, 'error:no-fixtures');
    return;
  }
  setText(class2El, 'requesting');
  const response = await decrypt(fixtures.nip04.event, 'decrypt-class2');
  if (response.type === 'identity.decrypt.error') {
    setText(class2El, `error:${response.error}`, response.error === 'class-forbidden');
    log(`class2 ${response.error}`);
    return;
  }
  setText(class2El, 'error:unexpected-result');
  log('class2 unexpected result');
}

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window.parent) return;
  const msg = event.data as { type?: string; id?: string; fixtures?: DecryptFixtures };
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'demo.decrypt.fixtures' && msg.fixtures) {
    void runHappyPath(msg.fixtures);
    return;
  }

  if (
    (msg.type === 'identity.decrypt.result' || msg.type === 'identity.decrypt.error') &&
    typeof msg.id === 'string'
  ) {
    const resolve = pending.get(msg.id);
    if (!resolve) return;
    pending.delete(msg.id);
    resolve(msg as DecryptResponse);
  }
});

class2Btn.addEventListener('click', () => {
  void runClass2Probe();
});
