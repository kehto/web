/**
 * acl-modal.ts — Full-screen ACL policy matrix modal.
 *
 * Displays the system-wide ACL policy as a grid/table: rows are napplets,
 * columns are capabilities, cells show granted (green check), revoked (red cross),
 * or default (gray dash). Opens from the ACL node inspector button.
 */

import { DEMO_CAPABILITY_LABELS } from './acl-panel.js';
import { getAclAdapter, getDemoServiceNames, toggleService, isServiceEnabled } from './shell-host.js';
import { updateServiceNodeVisual } from './topology.js';
import type { Capability } from '@kehto/shell';

const ALL_CAPABILITIES: Capability[] = [
  'relay:read',
  'relay:write',
  'cache:read',
  'cache:write',
  'hotkey:forward',
  'state:read',
  'state:write',
  'identity:read',
  'identity:decrypt',
  'keys:bind',
  'keys:forward',
  'media:control',
  'notify:send',
  'notify:channel',
  'theme:read',
];

const MODAL_ID = 'acl-policy-modal';

type PolicyCellState = 'granted' | 'revoked' | 'default';

interface PolicyRow {
  name: string;
  windowId: string;
  blocked: boolean;
  caps: Map<Capability, PolicyCellState>;
}

type AclAdapter = ReturnType<typeof getAclAdapter>;

function buildPolicyRows(adapter: AclAdapter): PolicyRow[] {
  const rows: PolicyRow[] = [];
  for (const snap of adapter.snapshot()) {
    const caps = new Map<Capability, PolicyCellState>();
    for (const cap of ALL_CAPABILITIES) {
      const allowed = snap.capabilities[cap];
      caps.set(cap, allowed ? 'granted' : 'revoked');
    }
    rows.push({
      name: snap.name,
      windowId: snap.windowId,
      blocked: snap.blocked,
      caps,
    });
  }
  return rows;
}

function createOverlay(): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.id = MODAL_ID;
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(2px)';
  return overlay;
}

function createContainer(): HTMLDivElement {
  const container = document.createElement('div');
  container.style.cssText = 'background:#13141f;border:1px solid #2a2d42;border-radius:12px;padding:24px;max-width:90vw;max-height:80vh;overflow:auto;color:#d0d4e8;font-family:inherit;min-width:600px';
  return container;
}

function createHeader(): HTMLDivElement {
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #1f2235';
  const heading = document.createElement('div');
  const kicker = document.createElement('div');
  kicker.style.cssText = 'font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#7981a0;margin-bottom:2px';
  kicker.textContent = 'system policy';
  const title = document.createElement('div');
  title.style.cssText = 'font-size:18px;color:#f0f6ff';
  title.textContent = 'ACL Capability Matrix';
  heading.append(kicker, title);
  header.appendChild(heading);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'close';
  closeBtn.style.cssText = 'background:transparent;border:1px solid #3a3a4a;color:#7981a0;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:11px;font-family:inherit';
  closeBtn.addEventListener('click', closePolicyModal);
  header.appendChild(closeBtn);
  return header;
}

function createServicesSection(): HTMLDivElement {
  const servicesSection = document.createElement('div');
  servicesSection.style.cssText = 'margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #1f2235';
  const servicesLabel = document.createElement('div');
  servicesLabel.style.cssText = 'font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#7981a0;margin-bottom:8px';
  servicesLabel.textContent = 'services';
  servicesSection.appendChild(servicesLabel);

  const servicesGrid = document.createElement('div');
  servicesGrid.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px';
  for (const name of getDemoServiceNames()) {
    servicesGrid.appendChild(createServiceToggle(name));
  }
  servicesSection.appendChild(servicesGrid);
  return servicesSection;
}

function createServiceToggle(name: string): HTMLDivElement {
  const serviceItem = document.createElement('div');
  serviceItem.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 10px;border-radius:6px;border:1px solid #2a2d42;background:#181926';
  const serviceNameSpan = document.createElement('span');
  serviceNameSpan.textContent = name;
  serviceNameSpan.style.cssText = 'font-size:11px;color:#d0d4e8;font-weight:500';
  serviceItem.appendChild(serviceNameSpan);

  const toggle = document.createElement('button');
  const enabled = isServiceEnabled(name);
  toggle.style.cssText = `appearance:none;-webkit-appearance:none;width:32px;height:16px;border-radius:8px;border:none;cursor:pointer;position:relative;transition:background 0.2s;background:${enabled ? '#39ff14' : '#3a3a4a'}`;
  const knob = document.createElement('span');
  knob.style.cssText = `display:block;width:12px;height:12px;border-radius:50%;background:#fff;position:absolute;top:2px;transition:left 0.2s;left:${enabled ? '18px' : '2px'}`;
  toggle.appendChild(knob);
  toggle.addEventListener('click', () => {
    const newState = !isServiceEnabled(name);
    toggleService(name, newState);
    updateServiceNodeVisual(name, newState);
    toggle.style.background = newState ? '#39ff14' : '#3a3a4a';
    knob.style.left = newState ? '18px' : '2px';
    serviceNameSpan.style.color = newState ? '#d0d4e8' : '#555';
  });

  serviceItem.appendChild(toggle);
  if (!enabled) serviceNameSpan.style.color = '#555';
  return serviceItem;
}

function renderCellState(cell: HTMLElement, cellState: PolicyCellState): void {
  const icon = document.createElement('span');
  if (cellState === 'granted') {
    icon.style.color = '#39ff14';
    icon.title = 'granted — click to revoke';
    icon.textContent = '✓';
  } else if (cellState === 'revoked') {
    icon.style.color = '#ff3b3b';
    icon.title = 'revoked — click to grant';
    icon.textContent = '✗';
  } else {
    icon.style.color = '#555';
    icon.title = 'default (permissive) — click to revoke';
    icon.textContent = '—';
  }
  cell.replaceChildren(icon);
}

function createTableHeader(): HTMLTableSectionElement {
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const nappletTh = document.createElement('th');
  nappletTh.textContent = 'Napplet';
  nappletTh.style.cssText = 'text-align:left;padding:8px 6px;color:#7981a0;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;border-bottom:1px solid #1f2235;white-space:nowrap';
  headerRow.appendChild(nappletTh);

  for (const cap of ALL_CAPABILITIES) {
    const th = document.createElement('th');
    th.textContent = DEMO_CAPABILITY_LABELS[cap];
    th.title = cap;
    th.style.cssText = 'text-align:center;padding:8px 4px;color:#7981a0;font-size:9px;letter-spacing:0.05em;text-transform:uppercase;border-bottom:1px solid #1f2235;white-space:nowrap;max-width:80px;overflow:hidden;text-overflow:ellipsis';
    headerRow.appendChild(th);
  }

  const blockedTh = document.createElement('th');
  blockedTh.textContent = 'Blocked';
  blockedTh.style.cssText = 'text-align:center;padding:8px 4px;color:#7981a0;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;border-bottom:1px solid #1f2235';
  headerRow.appendChild(blockedTh);
  thead.appendChild(headerRow);
  return thead;
}

function createEmptyPolicyRow(): HTMLTableRowElement {
  const emptyRow = document.createElement('tr');
  const emptyTd = document.createElement('td');
  emptyTd.colSpan = ALL_CAPABILITIES.length + 2;
  emptyTd.textContent = 'No identity-bound napplets';
  emptyTd.style.cssText = 'padding:16px;text-align:center;color:#444;font-style:italic';
  emptyRow.appendChild(emptyTd);
  return emptyRow;
}

function createPolicyCell(row: PolicyRow, cap: Capability, adapter: AclAdapter): HTMLTableCellElement {
  const td = document.createElement('td');
  td.style.cssText = 'text-align:center;padding:8px 4px;font-size:14px;cursor:pointer;user-select:none';
  const state = row.caps.get(cap) ?? 'default';
  renderCellState(td, state);
  td.addEventListener('click', () => {
    const isCurrentlyAllowed = row.caps.get(cap) !== 'revoked';
    const newEnabled = !isCurrentlyAllowed;
    if (newEnabled) adapter.grant(row.windowId, cap);
    else adapter.revoke(row.windowId, cap);
    renderCellState(td, newEnabled ? 'granted' : 'revoked');
    row.caps.set(cap, newEnabled ? 'granted' : 'revoked');
  });
  return td;
}

function createBlockedCell(row: PolicyRow): HTMLTableCellElement {
  const blockedTd = document.createElement('td');
  blockedTd.style.cssText = 'text-align:center;padding:8px 4px;font-size:14px';
  const blockedIcon = document.createElement('span');
  if (row.blocked) {
    blockedIcon.style.cssText = 'color:#ff3b3b;font-weight:bold';
    blockedIcon.title = 'blocked';
    blockedIcon.textContent = '●';
  } else {
    blockedIcon.style.color = '#555';
    blockedIcon.title = 'not blocked';
    blockedIcon.textContent = '—';
  }
  blockedTd.appendChild(blockedIcon);
  return blockedTd;
}

function createPolicyRow(row: PolicyRow, adapter: AclAdapter): HTMLTableRowElement {
  const tr = document.createElement('tr');
  tr.style.cssText = 'border-bottom:1px solid #1a1b2e';
  const nameTd = document.createElement('td');
  nameTd.textContent = row.name;
  nameTd.style.cssText = 'padding:8px 6px;color:#d0d4e8;font-weight:600;white-space:nowrap';
  tr.appendChild(nameTd);
  for (const cap of ALL_CAPABILITIES) {
    tr.appendChild(createPolicyCell(row, cap, adapter));
  }
  tr.appendChild(createBlockedCell(row));
  return tr;
}

function createPolicyTable(rows: PolicyRow[], adapter: AclAdapter): HTMLTableElement {
  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;font-size:11px';
  table.appendChild(createTableHeader());
  const tbody = document.createElement('tbody');
  if (rows.length === 0) {
    tbody.appendChild(createEmptyPolicyRow());
  }
  for (const row of rows) {
    tbody.appendChild(createPolicyRow(row, adapter));
  }
  table.appendChild(tbody);
  return table;
}

function createLegend(): HTMLDivElement {
  const legend = document.createElement('div');
  legend.style.cssText = 'margin-top:16px;padding-top:12px;border-top:1px solid #1f2235;display:flex;gap:16px;font-size:10px;color:#7981a0';
  const legendItems: Array<[string, string, string, string?]> = [
    ['✓', '#39ff14', 'granted'],
    ['✗', '#ff3b3b', 'revoked'],
    ['—', '#555', 'default (permissive)'],
    ['●', '#ff3b3b', 'blocked', 'font-weight:bold'],
  ];
  for (const [symbol, color, text, extraStyle] of legendItems) {
    const item = document.createElement('span');
    const icon = document.createElement('span');
    icon.style.cssText = `color:${color};${extraStyle ?? ''}`;
    icon.textContent = symbol;
    item.append(icon, document.createTextNode(` ${text}`));
    legend.appendChild(item);
  }
  return legend;
}

function wireCloseHandlers(overlay: HTMLDivElement): void {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePolicyModal();
  });
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closePolicyModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

/**
 * Open the ACL policy matrix modal.
 * Removes any existing modal first, builds the grid from live ACL state.
 */
export function openPolicyModal(): void {
  closePolicyModal();

  const adapter = getAclAdapter();
  const rows = buildPolicyRows(adapter);
  const overlay = createOverlay();
  const container = createContainer();
  container.append(
    createHeader(),
    createServicesSection(),
    createPolicyTable(rows, adapter),
    createLegend(),
  );
  overlay.appendChild(container);
  document.body.appendChild(overlay);
  wireCloseHandlers(overlay);
}

/** Close the ACL policy modal if open. */
export function closePolicyModal(): void {
  const existing = document.getElementById(MODAL_ID);
  if (existing) existing.remove();
}

/** Check if the policy modal is currently open. */
export function isPolicyModalOpen(): boolean {
  return document.getElementById(MODAL_ID) !== null;
}

/**
 * Refresh the policy modal if it is currently open.
 * Called after external state changes (e.g., inline ACL panel toggle)
 * to keep the modal in sync.
 */
export function refreshPolicyModal(): void {
  if (isPolicyModalOpen()) {
    openPolicyModal(); // close-and-reopen rebuilds from live state
  }
}
