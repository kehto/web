/**
 * consent-modal.ts -- NUB-CONNECT consent flow UI (CONNECT-03, v1.7 Phase 39).
 *
 * Custom shell DOM modal (plain HTML+CSS, no framework) per D5. Extends the
 * existing bridge.registerConsentHandler pattern -- dispatches on
 * request.type === 'connect' to render the modal, falling through for
 * other consent types (existing destructive-signing auto-approve is preserved
 * as a fallthrough parameter to registerWith).
 *
 * Design contract (per 39-CONTEXT.md decisions):
 *   D6: Fixed center overlay, z-index 10000 (above iframe sandbox layer).
 *   D7: 60-second auto-dismiss timer -> resolves as deny.
 *   D8: Full verbatim origin list; cleartext warning row for any origin
 *       not matching /^(https|wss):\/\//.
 *   M-04: dismiss (Escape / outside-click) = deny. No implicit allow.
 *
 * NOTE: The full connect.request wire message (napplet -> shell) is NOT
 * routed to this modal in Phase 39 -- upstream NUB-CONNECT types are still
 * provisional. This file ships the modal DOM + registration surface so the
 * shell is ready when connect.request lands; the E2E specs in Plan 39-05
 * exercise grant/revoke directly via window.__grantConnectOrigin__ and
 * window.__revokeConnect__ test hooks, bypassing the modal for automation.
 */

import type { ShellBridge } from '@kehto/shell';
import type { ConsentRequest } from '@kehto/shell';

/** Extended ConsentRequest shape for connect-type requests (D5). */
interface ConnectConsentRequest extends ConsentRequest {
  type: 'connect';
  dTag: string;
  aggregateHash: string;
  requestedOrigins: readonly string[];
}

function isConnectRequest(req: ConsentRequest): req is ConnectConsentRequest {
  return (req as Partial<ConnectConsentRequest>).type === 'connect';
}

function isCleartext(origin: string): boolean {
  return !/^(https|wss):\/\//i.test(origin);
}

/** D7: 60 seconds (ms). Timeout -> deny per M-04. */
const CONSENT_TIMEOUT_MS = 60_000;

export interface ConsentModal {
  /**
   * Register this modal's consent handler with the ShellBridge.
   * Must be called once after bootShell. Non-connect consent requests
   * are re-delegated to the fallthrough handler if provided (or denied).
   */
  registerWith(bridge: ShellBridge, fallthrough?: (request: ConsentRequest) => void): void;
}

/**
 * Factory for the NUB-CONNECT consent modal. Returns an object whose
 * `registerWith(bridge, fallthrough?)` method installs the handler.
 *
 * The modal DOM is created lazily on first `type: 'connect'` request
 * and reused across subsequent requests (one instance at a time; a
 * second concurrent connect request while one is open is denied
 * immediately per M-04 safety default).
 */
export function createConsentModal(): ConsentModal {
  let activeRequest: ConnectConsentRequest | null = null;
  let activeTimer: number | null = null;
  let overlayEl: HTMLDivElement | null = null;

  function closeModal(outcome: 'approve' | 'deny' | 'dismiss' | 'timeout'): void {
    if (!activeRequest) return;
    const req = activeRequest;
    activeRequest = null;
    if (activeTimer !== null) {
      clearTimeout(activeTimer);
      activeTimer = null;
    }
    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null;
    }
    document.removeEventListener('keydown', onEscape);
    // Resolve: approve -> true; everything else -> false (D7, M-04, D8).
    req.resolve(outcome === 'approve');
  }

  function onEscape(e: KeyboardEvent): void {
    if (e.key === 'Escape') closeModal('dismiss');
  }

  function renderModal(req: ConnectConsentRequest): void {
    overlayEl = document.createElement('div');
    overlayEl.setAttribute('data-testid', 'connect-consent-modal');
    overlayEl.style.cssText = [
      'position: fixed',
      'top: 0', 'left: 0', 'right: 0', 'bottom: 0',
      'display: flex', 'align-items: center', 'justify-content: center',
      'z-index: 10000',                                   // D6
      'background: rgba(0, 0, 0, 0.6)',
      'font-family: JetBrains Mono, monospace',
      'font-size: 12px',
      'color: #e0e0e0',
    ].join('; ');

    // Outside-click dismiss (M-04) -- only when the click hits the overlay, not inner dialog.
    overlayEl.addEventListener('click', (e) => {
      if (e.target === overlayEl) closeModal('dismiss');
    });

    const dialog = document.createElement('div');
    dialog.style.cssText = [
      'background: #0d0d14',
      'border: 1px solid #1e1e2e',
      'padding: 16px',
      'max-width: 500px',
      'min-width: 360px',
      'border-radius: 4px',
    ].join('; ');

    const title = document.createElement('h2');
    title.textContent = `Allow network connections?`;
    title.style.cssText = 'font-size: 14px; margin-bottom: 6px; color: #7aa2f7;';
    dialog.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.textContent = `${req.dTag} is requesting permission to connect to:`;
    subtitle.style.cssText = 'margin-bottom: 8px; color: #b0b0c0; font-size: 11px;';
    dialog.appendChild(subtitle);

    // D8: verbatim origin list + cleartext warning row.
    const list = document.createElement('ul');
    list.style.cssText = 'list-style: none; padding: 0; margin: 0 0 12px 0; border: 1px solid #1e1e2e; background: #0a0a0f;';
    for (const origin of req.requestedOrigins) {
      const li = document.createElement('li');
      li.setAttribute('data-testid', 'connect-consent-origin');
      li.style.cssText = 'padding: 4px 8px; border-bottom: 1px solid #1a1a2a; word-break: break-all;';
      li.textContent = origin;
      if (isCleartext(origin)) {
        const warn = document.createElement('span');
        warn.textContent = ' warning: cleartext';
        warn.style.cssText = 'color: #ff6b6b; margin-left: 6px; font-size: 10px;';
        warn.setAttribute('data-testid', 'connect-consent-cleartext-warning');
        li.appendChild(warn);
      }
      list.appendChild(li);
    }
    dialog.appendChild(list);

    const timerEl = document.createElement('div');
    timerEl.textContent = `Auto-deny in ${CONSENT_TIMEOUT_MS / 1000}s (Escape or click outside = deny)`;
    timerEl.style.cssText = 'font-size: 10px; color: #888; margin-bottom: 12px;';
    dialog.appendChild(timerEl);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end;';

    const denyBtn = document.createElement('button');
    denyBtn.textContent = 'Deny';
    denyBtn.setAttribute('data-testid', 'connect-consent-deny');
    denyBtn.type = 'button';
    denyBtn.style.cssText = 'padding: 6px 14px; background: #1a1a2a; color: #e0e0e0; border: 1px solid #333; cursor: pointer; font-family: inherit;';
    denyBtn.addEventListener('click', () => closeModal('deny'));

    const allowBtn = document.createElement('button');
    allowBtn.textContent = 'Allow';
    allowBtn.setAttribute('data-testid', 'connect-consent-allow');
    allowBtn.type = 'button';
    allowBtn.style.cssText = 'padding: 6px 14px; background: #7aa2f7; color: #000; border: 1px solid #7aa2f7; cursor: pointer; font-family: inherit;';
    allowBtn.addEventListener('click', () => closeModal('approve'));

    btnRow.appendChild(denyBtn);
    btnRow.appendChild(allowBtn);
    dialog.appendChild(btnRow);

    overlayEl.appendChild(dialog);
    document.body.appendChild(overlayEl);

    document.addEventListener('keydown', onEscape);
  }

  return {
    registerWith(bridge, fallthrough) {
      bridge.registerConsentHandler((request) => {
        if (!isConnectRequest(request)) {
          // Fall through to existing shell-host destructive-signing handler if provided.
          if (fallthrough) fallthrough(request);
          else request.resolve(false);  // Safe default if no fallthrough -- deny.
          return;
        }
        if (activeRequest !== null) {
          // Concurrent connect request while one is open: deny immediately (M-04 safety).
          request.resolve(false);
          return;
        }
        activeRequest = request;
        renderModal(request);
        activeTimer = window.setTimeout(() => closeModal('timeout'), CONSENT_TIMEOUT_MS);
      });
    },
  };
}
