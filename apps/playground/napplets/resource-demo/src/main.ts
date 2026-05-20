/**
 * resource-demo napplet -- exercises NUB-RESOURCE (RESOURCE-04, v1.7 Phase 40 / D1..D6).
 *
 * On init:
 *   1. Dispatches resource.bytes to http://localhost:4174/demo-data.json (granted at
 *      demo boot via __grantConnectOrigin__ — D3). Shell proxies the fetch and returns
 *      resource.bytes.result with base64-encoded body.
 *   2. Dispatches resource.bytes to https://untrusted.example/ (D4: RFC-2606 reserved
 *      domain). Shell rejects without fetching and returns resource.bytes.error
 *      with code='denied'.
 *
 * Sentinels:
 *   - #resource-demo-status   -- 'connecting...' -> 'dispatched 2 requests' -> 'done'
 *   - #resource-demo-granted  -- decoded JSON from granted fetch (E2E-25 assertion target)
 *   - #resource-demo-denied   -- canonical error code + message from denied fetch (E2E-25)
 *   - #resource-demo-log      -- timestamped event log for diagnostics
 *
 * Dispatch strategy:
 *   @napplet/sdk does not yet expose a resource namespace (pending @napplet/nub/resource
 *   publish at ^0.2.2). Provisional strategy: wire types from @kehto/shell barrel re-exports;
 *   outbound = window.parent.postMessage; inbound listener mirrors @napplet/shim's pattern
 *   (checks event.source === window.parent, type prefix 'resource.'). This is consistent
 *   with the provisional strategy for all three unpublished NUB domains (CLASS, CONNECT,
 *   RESOURCE). When @napplet/nub/resource ships, swap to sdk.resource.bytes() and remove
 *   the raw listener.
 *
 * Anti-features (v1.3 discipline):
 *   - NO <meta http-equiv="Content-Security-Policy"> in index.html (C-03)
 *   - NO raw window.addEventListener('message') for non-resource domains
 *   - NO window.nostr lookups (forbidden everywhere under NIP-5D)
 *   - NO resource.cancel wire message in this napplet (cancel path is Wave 3 scope)
 *
 * Wire types: ResourceBytesRequest, ResourceBytesResult, ResourceBytesError re-exported
 * from @kehto/shell barrel (packages/shell/src/index.ts — Phase 40 Plan 40-01 Task 3).
 */
import '@napplet/shim';

// ─── DOM sentinel references ──────────────────────────────────────────────────

const statusEl = document.getElementById('resource-demo-status')!;
const grantedEl = document.getElementById('resource-demo-granted')!;
const deniedEl = document.getElementById('resource-demo-denied')!;
const logEl = document.getElementById('resource-demo-log')!;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setStatus(text: string, color: 'gray' | 'green' | 'red' = 'gray'): void {
  statusEl.textContent = text;
  statusEl.style.color = color === 'green' ? '#39ff14' : color === 'red' ? '#ff3b3b' : '#888';
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

// ─── Request ID factory ────────────────────────────────────────────────────────

function newRequestId(): string {
  return `res-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Provisional resource wire types (mirrors @kehto/shell re-exports) ───────
// These are inlined here to avoid a cross-package import in a napplet context
// where @kehto/shell is not a declared dependency. When @napplet/nub/resource
// publishes, swap to `import type { ... } from '@napplet/nub-resource'`.

type ResourceErrorCode = 'denied' | 'canceled' | 'network-error' | 'invalid-url' | 'class-forbidden';

interface ResourceBytesResult {
  type: 'resource.bytes.result';
  requestId: string;
  status: number;
  headers: Readonly<Record<string, string>>;
  bodyBase64: string;
}

interface ResourceBytesError {
  type: 'resource.bytes.error';
  requestId: string;
  code: ResourceErrorCode;
  message: string;
}

type ResourceOutbound = ResourceBytesResult | ResourceBytesError;

// ─── Inbound resource message listener (provisional) ─────────────────────────
// Mirrors @napplet/shim's handleEnvelopeMessage pattern. Checks source is
// window.parent and type prefix is 'resource.'. When @napplet/nub/resource
// ships and installResourceShim is added to @napplet/shim, this block is removed.

type ResourceEnvelopeCallback = (envelope: ResourceOutbound) => void;
const _resourceCallbacks: ResourceEnvelopeCallback[] = [];

function onResourceEnvelope(callback: ResourceEnvelopeCallback): () => void {
  _resourceCallbacks.push(callback);
  return () => {
    const idx = _resourceCallbacks.indexOf(callback);
    if (idx !== -1) _resourceCallbacks.splice(idx, 1);
  };
}

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window.parent) return;
  const msg = event.data as { type?: string };
  if (typeof msg !== 'object' || msg === null || typeof msg.type !== 'string') return;
  if (!msg.type.startsWith('resource.')) return;
  const envelope = msg as unknown as ResourceOutbound;
  for (const cb of _resourceCallbacks) {
    try { cb(envelope); } catch { /* isolate per-callback errors */ }
  }
});

// ─── Outbound dispatch (provisional) ─────────────────────────────────────────
// Uses window.parent.postMessage to send resource.bytes envelopes to the shell.
// Mirror of how @napplet/shim NUB packages work (e.g., storageSetItem calls
// window.parent.postMessage with the wire envelope). Origin '*' is consistent
// with the shim's send pattern for napplet-to-shell messages.

function dispatchResourceBytes(requestId: string, url: string): void {
  window.parent.postMessage(
    { type: 'resource.bytes', requestId, url },
    '*',
  );
}

// ─── URL constants (D1, D4) ───────────────────────────────────────────────────

const GRANTED_URL = 'http://localhost:4174/demo-data.json';
const DENIED_URL = 'https://untrusted.example/';  // D4: RFC-2606 reserved — never resolves

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  setStatus('requesting...', 'gray');

  const grantedId = newRequestId();
  const deniedId = newRequestId();

  let grantedDone = false;
  let deniedDone = false;

  function maybeAllDone(): void {
    if (grantedDone && deniedDone) {
      setStatus('done', 'green');
    }
  }

  // Install envelope listener BEFORE dispatching so we catch both outcomes.
  const unsub = onResourceEnvelope((envelope) => {
    if (envelope.type === 'resource.bytes.result' && envelope.requestId === grantedId) {
      // Decode base64 → Uint8Array → UTF-8 → JSON parse for display.
      try {
        const binary = atob(envelope.bodyBase64);
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        const text = new TextDecoder('utf-8').decode(bytes);
        const parsed = JSON.parse(text) as unknown;
        grantedEl.textContent = JSON.stringify(parsed, null, 2);
        log(`granted status=${envelope.status} bytes=${bytes.length}`);
      } catch (err) {
        grantedEl.textContent = `decode error: ${(err as Error).message}`;
        log(`granted decode error: ${(err as Error).message}`);
      }
      grantedDone = true;
      maybeAllDone();
    }

    if (envelope.type === 'resource.bytes.error' && envelope.requestId === grantedId) {
      grantedEl.textContent = `unexpected error on granted fetch: code=${envelope.code} message=${envelope.message}`;
      log(`granted error ${envelope.code}`);
      grantedDone = true;
      maybeAllDone();
    }

    if (envelope.type === 'resource.bytes.error' && envelope.requestId === deniedId) {
      deniedEl.textContent = `code=${envelope.code} message=${envelope.message}`;
      log(`denied ${envelope.code}`);
      deniedDone = true;
      maybeAllDone();
    }

    if (envelope.type === 'resource.bytes.result' && envelope.requestId === deniedId) {
      // Should never happen — denied origin MUST NOT reach fetch (RESOURCE-01 H-03).
      deniedEl.textContent = `PROTOCOL VIOLATION: denied origin returned ${envelope.status}`;
      log(`PROTOCOL VIOLATION: denied origin returned result`);
      deniedDone = true;
      maybeAllDone();
    }

    // Clean up listener once both responses arrive.
    if (grantedDone && deniedDone) {
      unsub();
    }
  });

  dispatchResourceBytes(grantedId, GRANTED_URL);
  dispatchResourceBytes(deniedId, DENIED_URL);
  setStatus('dispatched 2 requests', 'gray');
  log(`dispatched granted requestId=${grantedId}`);
  log(`dispatched denied requestId=${deniedId}`);
}

init().catch((err) => {
  setStatus('init failed', 'red');
  log(`unhandled init error -- ${err instanceof Error ? err.message : String(err)}`);
});
