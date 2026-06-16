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
  'config:read': 'Config Read',
  'resource:fetch': 'Resource Fetch',
  'keys:bind': 'Keys Bind',
  'keys:forward': 'Keys Forward',
  'media:control': 'Media Control',
  'notify:send': 'Notify Send',
  'notify:channel': 'Notify Channel',
  'theme:read': 'Theme Read',
  'cvm:call': 'CVM Call',
  'outbox:read': 'Outbox Read',
  'outbox:write': 'Outbox Write',
  'upload:write': 'Upload Write',
  'intent:read': 'Intent Read',
  'intent:write': 'Intent Write',
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
  'config:read': 'read shell-managed config',
  'resource:fetch': 'fetch shell-mediated resources',
  'keys:bind': 'bind keyboard shortcut',
  'keys:forward': 'forward key events',
  'media:control': 'media session control',
  'notify:send': 'send notifications',
  'notify:channel': 'subscribe to notification channel',
  'theme:read': 'read active theme',
  'cvm:call': 'call ContextVM (MCP-over-Nostr) servers',
  'outbox:read': 'outbox read (relay results)',
  'outbox:write': 'outbox publish',
  'upload:write': 'upload write',
  'intent:read': 'intent read',
  'intent:write': 'intent dispatch',
};

const DEMO_CAPABILITIES: { cap: Capability; label: string }[] = [
  { cap: 'relay:read', label: DEMO_CAPABILITY_LABELS['relay:read'] },
  { cap: 'relay:write', label: DEMO_CAPABILITY_LABELS['relay:write'] },
  { cap: 'state:read', label: DEMO_CAPABILITY_LABELS['state:read'] },
  { cap: 'state:write', label: DEMO_CAPABILITY_LABELS['state:write'] },
  { cap: 'identity:read', label: DEMO_CAPABILITY_LABELS['identity:read'] },
  { cap: 'notify:send', label: DEMO_CAPABILITY_LABELS['notify:send'] },
  { cap: 'theme:read', label: DEMO_CAPABILITY_LABELS['theme:read'] },
];

let debugger_: NappletDebugger | null = null;

const ACL_EXPANSION_STORAGE_KEY = 'kehto.playground.aclExpansion.v1';

interface AclExpansionState {
  defaultExpanded: boolean;
  panels: Record<string, boolean>;
}

function readAclExpansionState(): AclExpansionState {
  try {
    if (typeof localStorage === 'undefined') return { defaultExpanded: false, panels: {} };
    const raw = localStorage.getItem(ACL_EXPANSION_STORAGE_KEY);
    if (!raw) return { defaultExpanded: false, panels: {} };
    const parsed = JSON.parse(raw) as Partial<AclExpansionState>;
    const panels = typeof parsed.panels === 'object' && parsed.panels !== null
      ? Object.fromEntries(
        Object.entries(parsed.panels).filter(([, value]) => typeof value === 'boolean'),
      ) as Record<string, boolean>
      : {};
    return {
      defaultExpanded: parsed.defaultExpanded === true,
      panels,
    };
  } catch {
    return { defaultExpanded: false, panels: {} };
  }
}

function writeAclExpansionState(): void {
  try {
    localStorage.setItem(ACL_EXPANSION_STORAGE_KEY, JSON.stringify(aclExpansionState));
  } catch {
    // Storage can be unavailable; keep expansion controls usable for this session.
  }
}

const aclExpansionState = readAclExpansionState();
let defaultAclExpanded = aclExpansionState.defaultExpanded;

export function setDebugger(dbg: NappletDebugger): void {
  debugger_ = dbg;
}

function applyBtnStyle(btn: HTMLButtonElement, on: boolean): void {
  btn.className = 'acl-btn px-2 py-0.5 rounded text-[10px] font-semibold border cursor-pointer ' +
    (on ? 'acl-btn-on' : 'acl-btn-off');
}

function emitAclExpansionChange(): void {
  window.dispatchEvent(new CustomEvent('acl-panels:expansion-changed'));
}

function getInitialPanelExpanded(name: string): boolean {
  return aclExpansionState.panels[name] ?? defaultAclExpanded;
}

function setPanelExpanded(
  panel: HTMLElement,
  expanded: boolean,
  options: { persist?: boolean; emit?: boolean } = {},
): void {
  const persist = options.persist ?? true;
  const emit = options.emit ?? true;
  panel.dataset.expanded = String(expanded);
  const nappletName = panel.dataset.aclNapplet;
  if (persist && nappletName) {
    aclExpansionState.panels[nappletName] = expanded;
    writeAclExpansionState();
  }
  const toggle = panel.querySelector<HTMLButtonElement>('.acl-summary-toggle');
  if (toggle) {
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.title = expanded ? 'Collapse ACL controls' : 'Expand ACL controls';
  }
  if (emit) emitAclExpansionChange();
}

function updateAclSummary(panel: HTMLElement): void {
  const capButtons = [
    ...panel.querySelectorAll<HTMLButtonElement>('[data-acl-capability]'),
  ];
  const blockBtn = panel.querySelector<HTMLButtonElement>('[data-acl-block]');
  const blockedWhole = blockBtn?.dataset.blocked === 'true';
  const enabledCount = capButtons.filter((btn) => btn.dataset.enabled === 'true').length;
  const allowedCount = blockedWhole ? 0 : enabledCount;
  const blockedCount = blockedWhole ? capButtons.length : capButtons.length - enabledCount;

  const allowedEl = panel.querySelector<HTMLElement>('[data-acl-summary-allowed]');
  if (allowedEl) allowedEl.textContent = `${allowedCount} allowed`;

  const blockedEl = panel.querySelector<HTMLElement>('[data-acl-summary-blocked]');
  if (blockedEl) {
    blockedEl.textContent = `${blockedCount} blocked`;
    blockedEl.classList.toggle('empty', blockedCount === 0);
  }
}

function renderNappletAcl(containerId: string, windowId: string, info: { name: string; identityBound: boolean }): void {
  const container = document.getElementById(containerId);
  if (!container || !info.identityBound) return;

  container.replaceChildren();

  const panel = document.createElement('div');
  panel.className = 'acl-panel';
  panel.dataset.aclNapplet = info.name;
  const initialExpanded = getInitialPanelExpanded(info.name);
  panel.dataset.expanded = String(initialExpanded);

  const summaryToggle = document.createElement('button');
  summaryToggle.type = 'button';
  summaryToggle.className = 'acl-summary-toggle';
  summaryToggle.setAttribute('aria-expanded', String(initialExpanded));
  summaryToggle.setAttribute('aria-controls', `${containerId}-controls`);
  summaryToggle.title = initialExpanded ? 'Collapse ACL controls' : 'Expand ACL controls';

  const summaryLeft = document.createElement('span');
  summaryLeft.className = 'acl-summary-left';

  const summaryTitle = document.createElement('span');
  summaryTitle.className = 'acl-summary-title';
  summaryTitle.textContent = 'acl';

  const allowedPill = document.createElement('span');
  allowedPill.className = 'acl-summary-pill acl-summary-allowed';
  allowedPill.dataset.aclSummaryAllowed = 'true';

  const blockedPill = document.createElement('span');
  blockedPill.className = 'acl-summary-pill acl-summary-blocked empty';
  blockedPill.dataset.aclSummaryBlocked = 'true';

  summaryLeft.append(summaryTitle, allowedPill, blockedPill);

  const chevron = document.createElement('span');
  chevron.className = 'acl-summary-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.textContent = '›';

  summaryToggle.append(summaryLeft, chevron);
  summaryToggle.addEventListener('click', () => {
    setPanelExpanded(panel, panel.dataset.expanded !== 'true');
  });

  const row = document.createElement('div');
  row.id = `${containerId}-controls`;
  row.className = 'acl-controls';
  const adapter = getAclAdapter();
  const aclSnapshot = adapter.snapshot().find((entry) => entry.windowId === windowId);

  for (const { cap, label } of DEMO_CAPABILITIES) {
    const toggle = document.createElement('button');
    const initialEnabled = aclSnapshot?.capabilities[cap] ?? adapter.check(windowId, cap);
    applyBtnStyle(toggle, initialEnabled);
    toggle.textContent = label;
    toggle.title = `${cap} (${DEMO_CAPABILITY_HINTS[cap]}) — click to ${initialEnabled ? 'revoke' : 'grant'}`;
    toggle.dataset.aclCapability = cap;
    toggle.dataset.enabled = String(initialEnabled);

    toggle.addEventListener('click', () => {
      const enabled = toggle.dataset.enabled === 'true';
      const newState = !enabled;
      toggle.dataset.enabled = String(newState);
      applyBtnStyle(toggle, newState);
      toggle.title = `${cap} (${DEMO_CAPABILITY_HINTS[cap]}) — click to ${newState ? 'revoke' : 'grant'}`;

      if (newState) adapter.grant(windowId, cap);
      else adapter.revoke(windowId, cap);
      debugger_?.addSystemMessage(
        `${newState ? 'GRANT' : 'REVOKE'} ${cap} (${DEMO_CAPABILITY_HINTS[cap]}) on ${info.name}`
      );
      updateAclSummary(panel);
      // Sync policy modal if open
      refreshPolicyModal();
    });

    row.appendChild(toggle);
  }

  // Block button
  const blockBtn = document.createElement('button');
  const initialBlocked = aclSnapshot?.blocked ?? false;
  blockBtn.className = 'acl-btn px-2 py-0.5 rounded text-[10px] font-semibold border cursor-pointer ' +
    (initialBlocked ? 'acl-btn-blocked' : 'acl-btn-block');
  blockBtn.textContent = initialBlocked ? 'Blocked' : 'Block';
  blockBtn.dataset.aclBlock = 'true';
  blockBtn.dataset.blocked = String(initialBlocked);

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
    updateAclSummary(panel);
  });

  row.appendChild(blockBtn);
  panel.append(summaryToggle, row);
  container.appendChild(panel);
  updateAclSummary(panel);
}

const rendered = new Set<string>();

export function setAllAclPanelsExpanded(expanded: boolean): void {
  defaultAclExpanded = expanded;
  aclExpansionState.defaultExpanded = expanded;
  const panels = document.querySelectorAll<HTMLElement>('.acl-panel');
  for (const panel of panels) {
    const nappletName = panel.dataset.aclNapplet;
    if (nappletName) aclExpansionState.panels[nappletName] = expanded;
    setPanelExpanded(panel, expanded, { persist: false, emit: false });
  }
  writeAclExpansionState();
  emitAclExpansionChange();
}

export function areAllAclPanelsExpanded(): boolean {
  const panels = [...document.querySelectorAll<HTMLElement>('.acl-panel')];
  if (panels.length === 0) return defaultAclExpanded;
  return panels.every((panel) => panel.dataset.expanded === 'true');
}

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
      // Feed napplet ACL panel: identity:read for pubkey lookup, relay:read for relay.subscribe.
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

  emitAclExpansionChange();
}
