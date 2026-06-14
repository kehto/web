/**
 * cvm-relatr napplet — calls the Relatr ContextVM server (MCP over Nostr)
 * through the shell's NAP-CVM bridge and renders a Nostr trust score.
 *
 * Uses raw NIP-5D envelopes over postMessage (`cvm.discover`, `cvm.request`)
 * — the shell owns all ContextVM transport, signing, encryption, and relay
 * access; this napplet never touches keys or sockets.
 */
import '@napplet/shim';
import { applyNapTheme, installNapTheme, onNapThemeChanged } from '../../shared-theme';

const REQUIRED_NAPS = ['cvm', 'theme'] as const;
const CAPABILITY_WAIT_MS = 5_000;
const CAPABILITY_WAIT_INTERVAL_MS = 25;
const REQUEST_TIMEOUT_MS = 30_000;

/** Relatr ContextVM server identity (social-graph trust scores). */
const RELATR_PUBKEY = '750682303c9f0ddad75941b49edc9d46e3ed306b9ee3335338a21a3e404c5fa3';
const RELATR_RELAYS = ['wss://relay.contextvm.org', 'wss://relay2.contextvm.org', 'wss://relay.primal.net'];
/** Default target: a well-known Nostr pubkey (fiatjaf). */
const DEFAULT_TARGET = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';

const statusEl = document.getElementById('cvm-status')!;
const serverEl = document.getElementById('cvm-server')!;
const scoreEl = document.getElementById('cvm-score')!;
const targetInput = document.getElementById('cvm-target') as HTMLInputElement;
const runButton = document.getElementById('cvm-run') as HTMLButtonElement;

type McpMessage = {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { message?: string } | unknown;
};

type CvmServer = { pubkey: string; name?: string; description?: string; capabilities?: string[] };

function setStatus(text: string, color: 'gray' | 'green' | 'red' = 'gray'): void {
  statusEl.textContent = text;
  statusEl.style.color =
    color === 'green'
      ? 'var(--nap-theme-success, #39ff14)'
      : color === 'red'
        ? 'var(--nap-theme-danger, #ff3b3b)'
        : 'var(--nap-theme-muted, #888)';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getMissingRequiredNaps(): string[] {
  const supports = window.napplet.shell.supports;
  return REQUIRED_NAPS.filter((capability) => !supports(capability));
}

async function waitForRequiredNaps(): Promise<void> {
  const deadline = Date.now() + CAPABILITY_WAIT_MS;
  let missing = getMissingRequiredNaps();
  while (missing.length > 0 && Date.now() < deadline) {
    await sleep(CAPABILITY_WAIT_INTERVAL_MS);
    missing = getMissingRequiredNaps();
  }
  if (missing.length > 0) throw new Error(`unsupported NAP capability: ${missing.join(', ')}`);
}

let envelopeCounter = 0;
function newEnvelopeId(): string {
  envelopeCounter += 1;
  return `cvm-${Date.now()}-${envelopeCounter}`;
}

// Phase 58 raw-envelope allowlist: the cvm domain has no @napplet/shim helper
// at this SDK version, so the demo posts cvm.* envelopes directly and listens
// for the correlated result. The listener is source-bound to the parent shell.
/** Resolve the correlated `*.result` envelope for a posted CVM request `id`. */
function awaitCvmResult<T>(id: string, resultType: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('timed out'));
    }, REQUEST_TIMEOUT_MS);

    function onMessage(event: MessageEvent): void {
      if (event.source !== window.parent) return;
      const data = event.data as (Record<string, unknown> & { type?: string; id?: string }) | null;
      if (!data || data.type !== resultType || data.id !== id) return;
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      if (typeof data.error === 'string') {
        reject(new Error(data.error));
        return;
      }
      resolve(data as T);
    }

    window.addEventListener('message', onMessage);
  });
}

async function discoverRelatr(): Promise<void> {
  try {
    const id = newEnvelopeId();
    const pending = awaitCvmResult<{ servers: CvmServer[] }>(id, 'cvm.discover.result');
    window.parent.postMessage(
      { type: 'cvm.discover', id, query: { search: 'relatr', relays: RELATR_RELAYS, limit: 5 } },
      '*',
    );
    const result = await pending;
    const relatr = result.servers.find((s) => s.pubkey === RELATR_PUBKEY) ?? result.servers[0];
    if (relatr) {
      const name = document.createElement('strong');
      name.textContent = relatr.name ?? 'ContextVM server';
      const rest = document.createTextNode(relatr.description ? ` — ${relatr.description}` : '');
      serverEl.replaceChildren(name, rest);
    } else {
      serverEl.textContent = 'Relatr (direct)';
    }
  } catch {
    // Discovery is best-effort; the request below uses the known server ref.
    serverEl.textContent = 'Relatr (direct)';
  }
}

async function computeTrustScore(targetPubkey: string): Promise<void> {
  runButton.disabled = true;
  scoreEl.textContent = '…';
  setStatus('computing trust score over MCP/Nostr', 'gray');
  try {
    const id = newEnvelopeId();
    const pending = awaitCvmResult<{ message?: McpMessage }>(id, 'cvm.request.result');
    window.parent.postMessage(
      {
        type: 'cvm.request',
        id,
        server: { pubkey: RELATR_PUBKEY, relays: RELATR_RELAYS },
        message: {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'calculate_trust_score', arguments: { targetPubkey } },
        },
        options: { initialize: true, timeoutMs: REQUEST_TIMEOUT_MS },
      },
      '*',
    );
    const result = await pending;

    const mcp = result.message;
    if (!mcp) throw new Error('empty response');
    if (mcp.error) {
      const message = (mcp.error as { message?: string }).message ?? 'tool error';
      throw new Error(message);
    }
    const score = readScore(mcp.result);
    if (score === null) throw new Error('no trust score in response');
    scoreEl.textContent = score.toFixed(2);
    setStatus(`trust score for ${targetPubkey.slice(0, 12)}…`, 'green');
  } catch (err) {
    scoreEl.textContent = '—';
    setStatus(err instanceof Error ? err.message : 'request failed', 'red');
  } finally {
    runButton.disabled = false;
  }
}

function readScore(result: unknown): number | null {
  const structured = (result as { structuredContent?: { trustScore?: { score?: unknown } } } | undefined)?.structuredContent;
  const score = structured?.trustScore?.score;
  return typeof score === 'number' ? score : null;
}

async function runDemo(target: string): Promise<void> {
  await discoverRelatr();
  await computeTrustScore(target);
}

async function init(): Promise<void> {
  installNapTheme();
  onNapThemeChanged((theme) => applyNapTheme(theme));
  await waitForRequiredNaps();

  targetInput.value = DEFAULT_TARGET;
  // Click-driven: the shell owns ContextVM transport/relay access, so the
  // demo only reaches the network on explicit user action (keeps automated
  // playground loads free of live relay traffic).
  runButton.addEventListener('click', () => {
    const target = targetInput.value.trim();
    if (/^[0-9a-f]{64}$/.test(target)) void runDemo(target);
    else setStatus('enter a 64-char hex pubkey', 'red');
  });

  setStatus('ready — click "trust score" to query Relatr', 'green');
}

init().catch((err) => {
  setStatus('init failed', 'red');
  serverEl.textContent = err instanceof Error ? err.message : String(err);
});
