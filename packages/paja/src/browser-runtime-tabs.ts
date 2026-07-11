import { originRegistry, type ShellBridge, type ShellCapabilities } from '@kehto/shell';

import { PAJA_DEV_SIGNER_PUBKEY } from './browser-adapter.js';
import {
  appendPajaMessageLog,
  renderPajaDevtools,
  type PajaDevtoolsState,
} from './browser-devtools.js';
import type { PajaHostConfig } from './options.js';
import type { PajaResolvedPointer } from './runtime-resolver.js';
import type { PajaSimulation } from './simulation.js';

type PajaRuntimeStatus = 'booting' | 'ready' | 'reloading' | 'error';

export const PAJA_RUNTIME_TABS_STORAGE_KEY = 'kehto:paja:runtime-tabs:v1';

export interface PajaRuntimeTabsSnapshot {
  readonly version: 1;
  readonly pointers: readonly string[];
  readonly activeIndex: number;
}

export interface PajaRuntimeTabsSnapshotState {
  readonly activeTabId: string | null;
  readonly tabs: readonly Pick<PajaRuntimeTab, 'id' | 'pointerValue'>[];
}

export interface PajaRuntimeTab {
  id: string;
  title: string;
  key: string;
  pointerValue: string;
  pointerStatus: string;
  resolvedTarget: PajaResolvedPointer;
  frame: HTMLIFrameElement;
  generation: number;
  windowId: string | null;
  status: PajaRuntimeStatus;
}

export interface PajaRuntimeTabState extends PajaDevtoolsState {
  resolvedTarget: PajaResolvedPointer | null;
  pointerValue: string;
  pointerStatus: string;
  tabs: PajaRuntimeTab[];
  activeTabId: string | null;
  generation: number;
  status: PajaRuntimeStatus;
  activateTab(tabId: string): void;
  closeTab(tabId: string): void;
}

export interface PajaRuntimeTabRuntime {
  currentSimulation: PajaSimulation;
  currentWindowId: string | null;
  readyWindowIds: Set<string>;
}

export interface PajaRuntimeTabContext {
  config: PajaHostConfig;
  stage: HTMLElement;
  bridge: ShellBridge;
  capabilities: ShellCapabilities;
  runtime: PajaRuntimeTabRuntime;
  navigateFrame(
    bridge: ShellBridge,
    frame: HTMLIFrameElement,
    config: PajaHostConfig,
    generation: number,
    capabilities: ShellCapabilities,
    simulation: PajaSimulation,
    resolvedTarget: PajaResolvedPointer,
    windowId: string,
  ): Promise<string | null>;
  registerFrameForGeneration(
    bridge: ShellBridge,
    frame: HTMLIFrameElement,
    config: PajaHostConfig,
    generation: number,
    resolvedTarget: PajaResolvedPointer,
    windowId: string,
  ): string | null;
  renderTargetErrorHtml(error: unknown): string;
  setPointerStatus(state: PajaRuntimeTabState, message: string): void;
  setStatus(state: PajaRuntimeTabState, status: PajaRuntimeStatus): void;
}

export type PajaDuplicateChoice = 'load-again' | 'open-tab' | 'cancel';

export function resolvedTargetKey(target: PajaResolvedPointer): string {
  return [
    target.event.kind,
    target.event.pubkey,
    target.dTag,
    target.aggregateHash,
  ].join(':');
}

export function getActiveTab(state: PajaRuntimeTabState): PajaRuntimeTab | null {
  return state.tabs.find((tab) => tab.id === state.activeTabId) ?? null;
}

export function setEmptyStageVisible(visible: boolean): void {
  const empty = document.getElementById('empty-runtime-stage');
  if (empty instanceof HTMLElement) empty.hidden = !visible;
}

export function createPajaShareUrl(pointerValue: string, href = window.location.href): string {
  const pointer = pointerValue.trim();
  const url = new URL(href);
  url.search = '';
  url.hash = '';
  url.searchParams.set(getPointerParamName(pointer), pointer);
  return url.href;
}

export function snapshotRuntimeTabs(state: PajaRuntimeTabsSnapshotState): PajaRuntimeTabsSnapshot | null {
  const pointers = state.tabs
    .map((tab) => tab.pointerValue.trim())
    .filter((pointer) => pointer.length > 0);
  if (pointers.length === 0) return null;
  const activeIndex = Math.max(
    0,
    state.tabs.findIndex((tab) => tab.id === state.activeTabId),
  );
  return {
    version: 1,
    pointers,
    activeIndex: Math.min(activeIndex, pointers.length - 1),
  };
}

export function parseRuntimeTabsSnapshot(value: string | null): PajaRuntimeTabsSnapshot | null {
  if (!value) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const candidate = parsed as {
    readonly version?: unknown;
    readonly pointers?: unknown;
    readonly activeIndex?: unknown;
  };
  if (candidate.version !== 1 || !Array.isArray(candidate.pointers)) return null;
  const pointers = candidate.pointers
    .filter((pointer): pointer is string => typeof pointer === 'string')
    .map((pointer) => pointer.trim())
    .filter((pointer) => pointer.length > 0);
  if (pointers.length === 0) return null;
  const rawActiveIndex = typeof candidate.activeIndex === 'number' && Number.isInteger(candidate.activeIndex)
    ? candidate.activeIndex
    : 0;
  return {
    version: 1,
    pointers,
    activeIndex: Math.max(0, Math.min(rawActiveIndex, pointers.length - 1)),
  };
}

export function renderRuntimeTabs(state: PajaRuntimeTabState): void {
  const tabsEl = document.getElementById('napplet-tabs');
  if (!(tabsEl instanceof HTMLElement)) return;
  tabsEl.replaceChildren(...state.tabs.map((tab) => renderTab(state, tab)));
}

export function activateRuntimeTab(
  state: PajaRuntimeTabState,
  context: PajaRuntimeTabContext,
  tabId: string,
): void {
  const tab = state.tabs.find((entry) => entry.id === tabId);
  if (!tab) return;
  state.activeTabId = tab.id;
  state.resolvedTarget = tab.resolvedTarget;
  state.pointerValue = tab.pointerValue;
  state.pointerStatus = tab.pointerStatus;
  context.runtime.currentWindowId = tab.windowId;

  const input = document.getElementById('runtime-pointer-input');
  if (input instanceof HTMLInputElement) input.value = tab.pointerValue;
  context.setPointerStatus(state, tab.pointerStatus);
  context.setStatus(state, tab.status);
  setEmptyStageVisible(false);
  for (const entry of state.tabs) entry.frame.hidden = entry.id !== tab.id;
  renderRuntimeTabs(state);
  renderPajaDevtools(state, { bridge: context.bridge, devSignerPubkey: PAJA_DEV_SIGNER_PUBKEY });
}

export function closeRuntimeTab(
  state: PajaRuntimeTabState,
  context: PajaRuntimeTabContext,
  tabId: string,
): void {
  const index = state.tabs.findIndex((tab) => tab.id === tabId);
  if (index < 0) return;
  const [tab] = state.tabs.splice(index, 1);
  destroyRuntimeTab(tab, context);
  if (state.activeTabId !== tabId) {
    renderRuntimeTabs(state);
    setEmptyStageVisible(state.tabs.length === 0);
    return;
  }
  const next = state.tabs[Math.min(index, state.tabs.length - 1)] ?? null;
  if (next) {
    activateRuntimeTab(state, context, next.id);
    return;
  }
  state.activeTabId = null;
  state.resolvedTarget = null;
  context.runtime.currentWindowId = null;
  state.pointerStatus = 'idle';
  context.setPointerStatus(state, 'idle');
  context.setStatus(state, 'ready');
  setEmptyStageVisible(true);
  renderRuntimeTabs(state);
}

export function addRuntimeTab(
  state: PajaRuntimeTabState,
  context: PajaRuntimeTabContext,
  pointerValue: string,
  resolvedTarget: PajaResolvedPointer,
): PajaRuntimeTab {
  state.generation += 1;
  const tab: PajaRuntimeTab = {
    id: `tab-${state.generation}`,
    title: resolvedTargetTitle(resolvedTarget),
    key: resolvedTargetKey(resolvedTarget),
    pointerValue,
    pointerStatus: `${resolvedTarget.dTag}:${resolvedTarget.aggregateHash.slice(0, 12)}`,
    resolvedTarget,
    frame: document.createElement('iframe'),
    generation: state.generation,
    windowId: null,
    status: 'booting',
  };
  tab.frame = createRuntimeTabFrame(tab, state, context);
  context.stage.append(tab.frame);
  state.tabs.push(tab);
  activateRuntimeTab(state, context, tab.id);
  startRuntimeTabNavigation(tab, state, context);
  return tab;
}

export function reloadActiveRuntimeTab(
  state: PajaRuntimeTabState,
  context: PajaRuntimeTabContext,
): void {
  const tab = getActiveTab(state);
  if (!tab) return;
  destroyRuntimeTab(tab, context);
  tab.generation = ++state.generation;
  tab.windowId = null;
  tab.status = 'reloading';
  tab.frame = createRuntimeTabFrame(tab, state, context);
  context.stage.append(tab.frame);
  activateRuntimeTab(state, context, tab.id);
  startRuntimeTabNavigation(tab, state, context);
}

export function showDuplicatePointerDialog(): Promise<PajaDuplicateChoice> {
  const backdrop = document.getElementById('duplicate-pointer-dialog');
  const loadAgain = document.getElementById('duplicate-load-again');
  const openTab = document.getElementById('duplicate-open-tab');
  const cancel = document.getElementById('duplicate-cancel');
  if (
    !(backdrop instanceof HTMLElement)
    || !(loadAgain instanceof HTMLButtonElement)
    || !(openTab instanceof HTMLButtonElement)
    || !(cancel instanceof HTMLButtonElement)
  ) {
    return Promise.resolve('cancel');
  }

  return new Promise((resolve) => {
    const cleanup = (choice: PajaDuplicateChoice) => {
      backdrop.hidden = true;
      loadAgain.removeEventListener('click', onLoadAgain);
      openTab.removeEventListener('click', onOpenTab);
      cancel.removeEventListener('click', onCancel);
      backdrop.removeEventListener('keydown', onKeydown);
      resolve(choice);
    };
    const onLoadAgain = () => cleanup('load-again');
    const onOpenTab = () => cleanup('open-tab');
    const onCancel = () => cleanup('cancel');
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cleanup('cancel');
    };
    loadAgain.addEventListener('click', onLoadAgain);
    openTab.addEventListener('click', onOpenTab);
    cancel.addEventListener('click', onCancel);
    backdrop.addEventListener('keydown', onKeydown);
    backdrop.hidden = false;
    loadAgain.focus();
  });
}

function renderTab(state: PajaRuntimeTabState, tab: PajaRuntimeTab): HTMLElement {
  const tabButton = document.createElement('div');
  tabButton.className = 'tab';
  tabButton.dataset.tabId = tab.id;
  tabButton.dataset.active = String(tab.id === state.activeTabId);
  tabButton.setAttribute('role', 'tab');
  tabButton.setAttribute('aria-selected', String(tab.id === state.activeTabId));
  tabButton.tabIndex = 0;
  tabButton.title = tab.pointerValue;
  tabButton.addEventListener('click', () => state.activateTab(tab.id));
  tabButton.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    state.activateTab(tab.id);
  });

  const label = document.createElement('span');
  label.className = 'tab-label';
  label.textContent = tab.title;
  tabButton.append(label, renderShareButton(tab), renderCloseButton(state, tab));
  return tabButton;
}

function renderShareButton(tab: PajaRuntimeTab): HTMLButtonElement {
  const share = document.createElement('button');
  share.type = 'button';
  share.className = 'tab-share';
  share.setAttribute('aria-label', `Copy share link for ${tab.title}`);
  share.title = 'Copy share link';
  share.textContent = '↗';
  share.addEventListener('click', (event) => {
    event.stopPropagation();
    void shareRuntimeTab(tab, share).catch((error) => console.error(error));
  });
  share.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    void shareRuntimeTab(tab, share).catch((error) => console.error(error));
  });
  return share;
}

function renderCloseButton(state: PajaRuntimeTabState, tab: PajaRuntimeTab): HTMLButtonElement {
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'tab-close';
  close.setAttribute('aria-label', `Close ${tab.title}`);
  close.textContent = 'x';
  close.addEventListener('click', (event) => {
    event.stopPropagation();
    state.closeTab(tab.id);
  });
  close.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    state.closeTab(tab.id);
  });
  return close;
}

async function shareRuntimeTab(tab: PajaRuntimeTab, button: HTMLButtonElement): Promise<void> {
  const shareUrl = createPajaShareUrl(tab.pointerValue);
  const clipboard = navigator.clipboard;
  if (!clipboard) {
    window.prompt('Copy Paja share link', shareUrl);
    return;
  }
  try {
    await clipboard.writeText(shareUrl);
  } catch {
    window.prompt('Copy Paja share link', shareUrl);
    return;
  }
  button.title = 'Share link copied';
  window.setTimeout(() => {
    button.title = 'Copy share link';
  }, 1200);
}

function getPointerParamName(pointer: string): 'naddr' | 'nevent' | 'pointer' {
  if (pointer.startsWith('naddr')) return 'naddr';
  if (pointer.startsWith('nevent')) return 'nevent';
  return 'pointer';
}

function resolvedTargetTitle(target: PajaResolvedPointer): string {
  const titleTag = target.event.tags.find((tag) => tag[0] === 'title')?.[1];
  const title = typeof target.manifest.title === 'string' && target.manifest.title.trim().length > 0
    ? target.manifest.title.trim()
    : titleTag?.trim();
  return title && title.length > 0 ? title : target.dTag || target.aggregateHash.slice(0, 12);
}

function destroyRuntimeTab(tab: PajaRuntimeTab, context: PajaRuntimeTabContext): void {
  if (tab.windowId) {
    context.bridge.runtime.destroyWindow(tab.windowId);
    context.bridge.runtime.sessionRegistry.unregister(tab.windowId);
    originRegistry.unregister(tab.windowId);
    context.runtime.readyWindowIds.delete(tab.windowId);
  }
  tab.frame.remove();
}

function createRuntimeTabFrame(
  tab: PajaRuntimeTab,
  state: PajaRuntimeTabState,
  context: PajaRuntimeTabContext,
): HTMLIFrameElement {
  const frame = document.createElement('iframe');
  frame.id = `napplet-frame-${tab.id}`;
  frame.className = 'tab-panel';
  frame.title = `Napplet runtime target: ${tab.title}`;
  frame.sandbox.add('allow-scripts');
  frame.sandbox.remove('allow-same-origin');
  frame.dataset.tabId = tab.id;
  frame.dataset.targetUrl = tab.pointerValue;
  frame.hidden = true;
  frame.addEventListener('load', () => {
    if (tab.status !== 'booting' && tab.status !== 'reloading') return;
    tab.windowId = context.registerFrameForGeneration(
      context.bridge,
      frame,
      context.config,
      tab.generation,
      tab.resolvedTarget,
      runtimeTabWindowId(context.config, tab),
    );
    if (state.activeTabId === tab.id) context.runtime.currentWindowId = tab.windowId;
  });
  frame.addEventListener('error', () => {
    tab.status = 'error';
    if (state.activeTabId === tab.id) context.setStatus(state, 'error');
    renderRuntimeTabs(state);
  });
  return frame;
}

function startRuntimeTabNavigation(
  tab: PajaRuntimeTab,
  state: PajaRuntimeTabState,
  context: PajaRuntimeTabContext,
): void {
  const generation = tab.generation;
  tab.status = 'booting';
  context.setStatus(state, 'booting');
  renderRuntimeTabs(state);
  void context.navigateFrame(
    context.bridge,
    tab.frame,
    context.config,
    generation,
    context.capabilities,
    context.runtime.currentSimulation,
    tab.resolvedTarget,
    runtimeTabWindowId(context.config, tab),
  ).then((windowId) => {
    if (tab.generation !== generation) return;
    tab.windowId = windowId;
    if (state.activeTabId === tab.id) context.runtime.currentWindowId = windowId;
  }).catch((error) => {
    if (tab.generation !== generation) return;
    tab.frame.removeAttribute('src');
    tab.frame.srcdoc = context.renderTargetErrorHtml(error);
    tab.status = 'error';
    if (state.activeTabId === tab.id) context.setStatus(state, 'error');
    appendPajaMessageLog(state, 'paja', {
      type: 'paja.target.error',
      error: error instanceof Error ? error.message : String(error),
    }, tab.windowId ?? undefined);
    renderRuntimeTabs(state);
    console.error(error);
  });
}

function runtimeTabWindowId(config: PajaHostConfig, tab: PajaRuntimeTab): string {
  return `${config.window.id}:${tab.id}:${tab.generation}`;
}
