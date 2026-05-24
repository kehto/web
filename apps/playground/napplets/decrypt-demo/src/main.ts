/**
 * decrypt-demo napplet -- exercises identityDecrypt over the identity.decrypt wire path.
 */
import '@napplet/shim';
import { identityDecrypt } from '@napplet/nub/identity/sdk';

const REQUIRED_NUBS = ['identity'] as const;

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

type DecryptResult =
  | { ok: true; rumor: { content: string } }
  | { ok: false; error: string };

const statusEl = document.getElementById('decrypt-demo-status')!;
const nip04El = document.getElementById('decrypt-nip04-status')!;
const nip44El = document.getElementById('decrypt-nip44-status')!;
const nip17El = document.getElementById('decrypt-nip17-status')!;
const class2El = document.getElementById('decrypt-class2-status')!;
const class2Btn = document.getElementById('decrypt-class2-run') as HTMLButtonElement;
const logEl = document.getElementById('decrypt-demo-log')!;

let fixtures: DecryptFixtures | null = null;

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

function getMissingRequiredNubs(): string[] {
  const supports = window.napplet.shell.supports;
  return REQUIRED_NUBS.filter((capability) => !supports(capability));
}

function parsePayload(content: string): { mode?: string; id?: string } {
  try {
    return JSON.parse(content) as { mode?: string; id?: string };
  } catch {
    return {};
  }
}

async function decrypt(event: NostrEvent): Promise<DecryptResult> {
  const missing = getMissingRequiredNubs();
  if (missing.length > 0) {
    return { ok: false, error: `unsupported NUB capability: ${missing.join(', ')}` };
  }

  try {
    const { rumor } = await identityDecrypt(event);
    return { ok: true, rumor };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function runMode(name: ModeName, fixture: ModeFixture, el: Element): Promise<void> {
  setText(el, 'requesting');
  const response = await decrypt(fixture.event);
  if (!response.ok) {
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
  const response = await decrypt(fixtures.nip04.event);
  if (!response.ok) {
    setText(class2El, `error:${response.error}`, response.error === 'class-forbidden');
    log(`class2 ${response.error}`);
    return;
  }
  setText(class2El, 'error:unexpected-result');
  log('class2 unexpected result');
}

// Phase 58 raw-envelope allowlist: demo/test-only fixture injection. The
// handler is source-bound to the parent shell and never dispatches a NUB action.
window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window.parent) return;
  const msg = event.data as { type?: string; fixtures?: DecryptFixtures };
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'demo.decrypt.fixtures' && msg.fixtures) {
    void runHappyPath(msg.fixtures);
  }
});

class2Btn.addEventListener('click', () => {
  void runClass2Probe();
});
