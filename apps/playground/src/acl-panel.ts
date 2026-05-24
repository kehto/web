/**
 * acl-panel.ts -- Per-napplet ACL control panel.
 *
 * Renders toggle buttons above each napplet using inline styles
 * (UnoCSS can't detect dynamically-assigned classes).
 */

import { getNapplets, getAclAdapter } from './shell-host.js';
import { refreshPolicyModal } from './acl-modal.js';
import type { NappletDebugger } from './debugger.js';
import type { Capability } from '@kehto/shell';

export const DEMO_CAPABILITY_LABELS: Record<Capability, string> = {
  'relay:read': 'Relay Subscribe',
  'relay:write': 'Relay Publish / IFC Send',
  'cache:read': 'Cache Read',
  'cache:write': 'Cache Write',
  'hotkey:forward': 'Hotkey Forward',
  'state:read': 'State Read',
  'state:write': 'State Write',
  'identity:read': 'Identity Read',
  'identity:decrypt': 'Identity Decrypt',
  'keys:bind': 'Keys Bind',
  'keys:forward': 'Keys Forward',
  'media:control': 'Media Control',
  'notify:send': 'Notify Send',
  'notify:channel': 'Notify Channel',
  'theme:read': 'Theme Read',
};

export const DEMO_CAPABILITY_HINTS: Record<Capability, string> = {
  'relay:read': 'relay subscribe / ifc receive',
  'relay:write': 'relay publish / ifc send',
  'cache:read': 'cache read access',
  'cache:write': 'cache write access',
  'hotkey:forward': 'hotkey forward',
  'state:read': 'state read',
  'state:write': 'state write',
  'identity:read': 'identity read (pubkey, profile)',
  'identity:decrypt': 'identity decrypt (class-1 only)',
  'keys:bind': 'bind keyboard shortcut',
  'keys:forward': 'forward key events',
  'media:control': 'media session control',
  'notify:send': 'send notifications',
  'notify:channel': 'subscribe to notification channel',
  'theme:read': 'read active theme',
};

const DEMO_CAPABILITIES: { cap: Capability; label: string }[] = [
  { cap: 'relay:read', label: DEMO_CAPABILITY_LABELS['relay:read'] },
  { cap: 'relay:write', label: DEMO_CAPABILITY_LABELS['relay:write'] },
  { cap: 'state:read', label: DEMO_CAPABILITY_LABELS['state:read'] },
  { cap: 'state:write', label: DEMO_CAPABILITY_LABELS['state:write'] },
  { cap: 'identity:read', label: DEMO_CAPABILITY_LABELS['identity:read'] },
  { cap: 'identity:decrypt', label: DEMO_CAPABILITY_LABELS['identity:decrypt'] },
  // Phase 19 (Plan 19-04): add notify:send so the toaster's ACL panel exposes the toggle.
  // Existing napplets (chat/bot) also get this toggle; they use ifcEmit gated on
  // relay:write, not notify:send — the extra toggle is visible but no-op for them.
  { cap: 'notify:send', label: DEMO_CAPABILITY_LABELS['notify:send'] },
  // Phase 20 (Plan 20-06): add theme:read for theme-switcher/preferences observer visibility.
  // In v1.3, theme.changed fan-out via shell-bridge.publishTheme bypasses ACL (shell-initiated
  // push, not napplet-originated request). The toggle is exposed for capability surface
  // documentation; disabling it has no functional effect in v1.3.
  { cap: 'theme:read', label: DEMO_CAPABILITY_LABELS['theme:read'] },
];

let debugger_: NappletDebugger | null = null;

export function setDebugger(dbg: NappletDebugger): void {
  debugger_ = dbg;
}

function applyBtnStyle(btn: HTMLButtonElement, on: boolean): void {
  btn.className = 'acl-btn px-2 py-0.5 rounded text-[10px] font-semibold border cursor-pointer ' +
    (on ? 'acl-btn-on' : 'acl-btn-off');
}

function renderNappletAcl(containerId: string, windowId: string, info: { name: string; identityBound: boolean }): void {
  const container = document.getElementById(containerId);
  if (!container || !info.identityBound) return;

  container.replaceChildren();

  const row = document.createElement('div');
  row.className = 'flex flex-wrap gap-1.5';

  for (const { cap, label } of DEMO_CAPABILITIES) {
    const toggle = document.createElement('button');
    applyBtnStyle(toggle, true);
    toggle.textContent = label;
    toggle.title = `${cap} (${DEMO_CAPABILITY_HINTS[cap]}) — click to revoke`;
    toggle.dataset.enabled = 'true';

    toggle.addEventListener('click', () => {
      const enabled = toggle.dataset.enabled === 'true';
      const newState = !enabled;
      toggle.dataset.enabled = String(newState);
      applyBtnStyle(toggle, newState);
      toggle.title = `${cap} (${DEMO_CAPABILITY_HINTS[cap]}) — click to ${newState ? 'revoke' : 'grant'}`;

      const adapter = getAclAdapter();
      if (newState) adapter.grant(windowId, cap);
      else adapter.revoke(windowId, cap);
      debugger_?.addSystemMessage(
        `${newState ? 'GRANT' : 'REVOKE'} ${cap} (${DEMO_CAPABILITY_HINTS[cap]}) on ${info.name}`
      );
      // Sync policy modal if open
      refreshPolicyModal();
    });

    row.appendChild(toggle);
  }

  // Block button
  const blockBtn = document.createElement('button');
  blockBtn.className = 'acl-btn px-2 py-0.5 rounded text-[10px] font-semibold border cursor-pointer acl-btn-block';
  blockBtn.textContent = 'Block';
  blockBtn.dataset.blocked = 'false';

  blockBtn.addEventListener('click', () => {
    const blocked = blockBtn.dataset.blocked === 'true';
    const newState = !blocked;
    blockBtn.dataset.blocked = String(newState);

    if (newState) {
      blockBtn.className = 'acl-btn px-2 py-0.5 rounded text-[10px] font-semibold border cursor-pointer acl-btn-blocked';
      blockBtn.textContent = 'Blocked';
    } else {
      blockBtn.className = 'acl-btn px-2 py-0.5 rounded text-[10px] font-semibold border cursor-pointer acl-btn-block';
      blockBtn.textContent = 'Block';
    }

    const adapter = getAclAdapter();
    if (newState) adapter.block(windowId);
    else adapter.unblock(windowId);
    debugger_?.addSystemMessage(`${newState ? 'BLOCK' : 'UNBLOCK'} ${info.name}`);
  });

  row.appendChild(blockBtn);
  container.appendChild(row);
}

const rendered = new Set<string>();

export function renderAclPanels(onlyFor?: Set<string>): void {
  const napplets = getNapplets();

  for (const [windowId, info] of napplets) {
    // Skip if already rendered (don't wipe user's toggle state)
    if (rendered.has(info.name)) continue;
    // Skip if not in the target set
    if (onlyFor && !onlyFor.has(info.name)) continue;

    if (info.name === 'chat') {
      renderNappletAcl('chat-acl', windowId, info);
      rendered.add('chat');
    } else if (info.name === 'bot') {
      renderNappletAcl('bot-acl', windowId, info);
      rendered.add('bot');
    } else if (info.name === 'composer') {
      // Phase 19 (Plan 19-04): composer ACL panel exposes relay:write + notify:send toggles
      renderNappletAcl('composer-acl', windowId, info);
      rendered.add('composer');
    } else if (info.name === 'preferences') {
      // Phase 19 (Plan 19-04): preferences ACL panel exposes state:read + state:write toggles
      renderNappletAcl('preferences-acl', windowId, info);
      rendered.add('preferences');
    } else if (info.name === 'toaster') {
      // Phase 19 (Plan 19-04): toaster ACL panel exposes notify:send toggle (Plan 19-06 revoke spec)
      renderNappletAcl('toaster-acl', windowId, info);
      rendered.add('toaster');
    } else if (info.name === 'feed') {
      // Phase 20 (Plan 20-06): feed napplet ACL panel (relay:read for relay.subscribe)
      renderNappletAcl('feed-acl', windowId, info);
      rendered.add('feed');
    } else if (info.name === 'profile-viewer') {
      // Phase 20 (Plan 20-06): profile-viewer napplet ACL panel (identity:read)
      renderNappletAcl('profile-viewer-acl', windowId, info);
      rendered.add('profile-viewer');
    } else if (info.name === 'theme-switcher') {
      // Phase 20 (Plan 20-06): theme-switcher napplet ACL panel (theme:read for visibility)
      renderNappletAcl('theme-switcher-acl', windowId, info);
      rendered.add('theme-switcher');
    }
  }
}
