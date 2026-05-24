import type { NappletDebugger } from './debugger.js';
import {
  disconnectSigner,
  getSigner as getSignerFromConnection,
  onStateChange,
  recordSignerRequest,
} from './signer-connection.js';
import { initSignerModal, openSignerModal } from './signer-modal.js';
import { getServiceNodeId, type SignerConnectionStateView } from './topology.js';

export interface SignerNodeUiController {
  handleDocumentClick(event: MouseEvent): boolean;
}

function createMeta(className: string, text: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = `topology-node-meta ${className}`;
  el.textContent = text;
  return el;
}

function createBaseNodes(): [HTMLDivElement, HTMLDivElement] {
  const kicker = document.createElement('div');
  kicker.className = 'topology-node-kicker';
  kicker.textContent = 'service';
  const title = document.createElement('div');
  title.className = 'topology-node-title';
  title.textContent = 'signer';
  return [kicker, title];
}

function removeDynamicSignerContent(contentWrapper: Element): Element | null {
  const nodeSummary = contentWrapper.querySelector('.node-summary');
  const toRemove: Element[] = [];
  for (const child of contentWrapper.children) {
    if (!child.classList.contains('node-summary')) {
      toRemove.push(child);
    }
  }
  for (const el of toRemove) el.remove();
  return nodeSummary;
}

function createConnectedStateNodes(state: SignerConnectionStateView): HTMLElement[] {
  const dynamicNodes: HTMLElement[] = [];
  const truncatedPubkey = state.pubkey
    ? `${state.pubkey.substring(0, 8)}...${state.pubkey.substring(state.pubkey.length - 4)}`
    : '';

  const connected = document.createElement('div');
  connected.className = 'topology-node-meta signer-status-connected';
  const method = document.createElement('span');
  method.className = 'signer-method-badge';
  method.textContent = state.method === 'nip07' ? 'nip-07' : 'nip-46';
  const pubkey = document.createElement('span');
  pubkey.className = 'signer-pubkey';
  pubkey.textContent = truncatedPubkey;
  connected.append(method, pubkey);
  if (state.relay) {
    const relay = document.createElement('span');
    relay.className = 'signer-relay';
    relay.textContent = state.relay;
    connected.appendChild(relay);
  }
  dynamicNodes.push(connected);

  const recent = document.createElement('div');
  recent.className = 'signer-recent-requests';
  const recentLabel = document.createElement('div');
  recentLabel.className = 'signer-recent-label';
  recentLabel.textContent = 'recent';
  recent.appendChild(recentLabel);
  const recentSlice = [...state.recentRequests].reverse().slice(0, 5);
  if (recentSlice.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'signer-no-requests';
    empty.textContent = 'no requests yet';
    recent.appendChild(empty);
  } else {
    for (const request of recentSlice) {
      const row = document.createElement('div');
      row.className = `signer-request-row ${request.success ? 'ok' : 'err'}`;
      const methodEl = document.createElement('span');
      methodEl.className = 'signer-req-method';
      methodEl.textContent = request.method;
      row.appendChild(methodEl);
      if (request.kind !== undefined) {
        const kind = document.createElement('span');
        kind.className = 'signer-req-kind';
        kind.textContent = `k${request.kind}`;
        row.appendChild(kind);
      }
      const status = document.createElement('span');
      status.className = 'signer-req-status';
      status.textContent = request.success ? '✓' : '✗';
      row.appendChild(status);
      recent.appendChild(row);
    }
  }
  dynamicNodes.push(recent);

  const actions = document.createElement('div');
  actions.className = 'signer-action-row';
  const testBtn = document.createElement('button');
  testBtn.className = 'signer-test-sign-btn';
  testBtn.dataset.action = 'signer-test-sign';
  testBtn.textContent = 'test sign';
  const disconnectBtn = document.createElement('button');
  disconnectBtn.className = 'signer-disconnect-btn';
  disconnectBtn.dataset.action = 'disconnect-signer';
  disconnectBtn.textContent = 'disconnect';
  actions.append(testBtn, disconnectBtn);
  dynamicNodes.push(actions);

  return dynamicNodes;
}

function createSignerContent(state: SignerConnectionStateView): HTMLElement[] {
  const dynamicNodes: HTMLElement[] = [];
  dynamicNodes.push(...createBaseNodes());

  if (state.isConnecting) {
    dynamicNodes.push(createMeta('signer-status-connecting', 'connecting...'));
    return dynamicNodes;
  }

  if (state.method === 'none') {
    if (state.error) dynamicNodes.push(createMeta('signer-status-error', state.error));
    dynamicNodes.push(createMeta('signer-status-disconnected', 'not connected'));
    const button = document.createElement('button');
    button.className = 'signer-connect-btn';
    button.dataset.action = 'open-signer-connect';
    button.textContent = 'Connect Signer';
    dynamicNodes.push(button);
    return dynamicNodes;
  }

  dynamicNodes.push(...createConnectedStateNodes(state));
  return dynamicNodes;
}

function updateSignerNodeDisplay(signerNodeId: string, state: SignerConnectionStateView): void {
  const signerNode = document.getElementById(signerNodeId);
  if (!signerNode) return;

  const contentWrapper = signerNode.querySelector('.topology-node-content') ?? signerNode;
  const nodeSummary = removeDynamicSignerContent(contentWrapper);
  const dynamicNodes = createSignerContent(state);

  if (nodeSummary) {
    for (const child of dynamicNodes) contentWrapper.insertBefore(child, nodeSummary);
  } else {
    contentWrapper.replaceChildren(...dynamicNodes);
  }
}

async function runTestSign(debuggerEl: NappletDebugger | null): Promise<void> {
  const signer = getSignerFromConnection();
  if (!signer) {
    debuggerEl?.addSystemMessage('test-sign: no signer connected');
    return;
  }

  try {
    const t = Math.floor(Date.now() / 1000);
    const pubkey = await signer.getPublicKey();
    const template = {
      kind: 1,
      pubkey,
      created_at: t,
      tags: [],
      content: 'demo test-sign from kehto shell',
    };
    const signed = await signer.signEvent(template as Parameters<NonNullable<typeof signer.signEvent>>[0]);
    const eventId = (signed as { id?: string }).id ?? 'unknown';
    debuggerEl?.addSystemMessage(`test-sign: OK, event id ${eventId.substring(0, 16)}...`);
    recordSignerRequest({
      timestamp: Date.now(),
      method: 'signEvent',
      kind: 1,
      success: true,
    });
  } catch (err) {
    debuggerEl?.addSystemMessage(`test-sign: error ${(err as Error).message}`);
    recordSignerRequest({
      timestamp: Date.now(),
      method: 'signEvent',
      kind: 1,
      success: false,
    });
  }
}

export function initSignerNodeUi(debuggerEl: NappletDebugger | null): SignerNodeUiController {
  const signerNodeId = getServiceNodeId('signer');

  onStateChange((state) => {
    updateSignerNodeDisplay(signerNodeId, state);

    if (state.method !== 'none' && !state.isConnecting && !state.error) {
      debuggerEl?.addSystemMessage(`signer connected via ${state.method}: ${state.pubkey?.substring(0, 16)}...`);
    }
    if (state.error) {
      debuggerEl?.addSystemMessage(`signer connection error: ${state.error}`);
    }
  });

  initSignerModal();

  return {
    handleDocumentClick(event) {
      const target = event.target as HTMLElement;
      if (target.closest('[data-action="open-signer-connect"]')) {
        event.stopPropagation();
        openSignerModal();
        return true;
      }

      if (target.closest('[data-action="disconnect-signer"]')) {
        event.stopPropagation();
        disconnectSigner();
        debuggerEl?.addSystemMessage('signer disconnected');
        return true;
      }

      if (target.closest('[data-action="signer-test-sign"]')) {
        event.stopPropagation();
        void runTestSign(debuggerEl);
        return true;
      }

      return false;
    },
  };
}
