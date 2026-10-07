import { appendPajaMessageLog } from './browser-devtools.js';
import {
  activateRuntimeTab,
  addRuntimeTab,
  getActiveTab,
  resolvedTargetKey,
  showDuplicatePointerDialog,
  type PajaRuntimeTabContext,
  type PajaRuntimeTabState,
} from './browser-runtime-tabs.js';
import {
  createPajaLocalTarget,
  isPajaLocalHtmlFile,
  PAJA_LOCAL_SINGLE_FILE_HINT,
  type PajaLocalFileInput,
} from './local-target.js';

/** Host effects owned by `browser-host.ts`. */
export interface PajaLocalLoaderEffects {
  /** Persist pointer tabs after the active tab changes. */
  persistTabs(state: PajaRuntimeTabState): void;
}

/**
 * Open a local `index.html` file in a new runtime tab.
 *
 * The local target never enters the installed napplet catalog: that catalog
 * holds resolver-verified artifacts only. The tab gets an empty pointer value,
 * so it is not persisted and is not restored after a reload.
 *
 * @param state - Live Paja runtime-tab state.
 * @param context - Live Paja runtime-tab context.
 * @param file - Picked or dropped file.
 * @param effects - Host-owned persistence effects.
 * @returns Resolves once the tab is added, reused, or the error is reported.
 *
 * @example
 * ```ts
 * await loadLocalRuntimeFile(state, context, input.files[0], { persistTabs });
 * ```
 */
export async function loadLocalRuntimeFile(
  state: PajaRuntimeTabState,
  context: PajaRuntimeTabContext,
  file: PajaLocalFileInput,
  effects: PajaLocalLoaderEffects,
): Promise<void> {
  if (context.config.target.mode !== 'runtime-pointer') return;
  const fileName = file.name;
  context.setPointerStatus(state, `reading ${fileName}`);
  context.setStatus(state, 'booting');
  appendPajaMessageLog(state, 'paja', { type: 'paja.local.load', fileName });
  try {
    const target = await createPajaLocalTarget(file);
    const identityStatus = `local ${target.dTag}:${target.aggregateHash.slice(0, 12)}`;
    const loadedStatus = target.relativeAssets.length > 0
      ? `${identityStatus}; ${target.relativeAssets.length} relative asset(s) will not load. ${PAJA_LOCAL_SINGLE_FILE_HINT}`
      : identityStatus;
    context.setPointerStatus(state, loadedStatus);
    appendPajaMessageLog(state, 'paja', {
      type: 'paja.local.loaded',
      fileName: target.fileName,
      dTag: target.dTag,
      aggregateHash: target.aggregateHash,
      ...(target.relativeAssets.length > 0 ? { relativeAssets: [...target.relativeAssets] } : {}),
    });
    const key = resolvedTargetKey(target);
    const duplicate = state.tabs.find((tab) => tab.key === key);
    if (duplicate) {
      const choice = await showDuplicatePointerDialog();
      if (choice === 'cancel') {
        context.setStatus(state, getActiveTab(state)?.status ?? 'ready');
        context.setPointerStatus(state, `already running: ${duplicate.title}`);
        appendPajaMessageLog(state, 'paja', { type: 'paja.local.duplicate.cancelled', tabId: duplicate.id });
        return;
      }
      if (choice === 'open-tab') {
        activateRuntimeTab(state, context, duplicate.id);
        effects.persistTabs(state);
        appendPajaMessageLog(state, 'paja', { type: 'paja.local.duplicate.opened', tabId: duplicate.id });
        return;
      }
    }
    const tab = addRuntimeTab(state, context, '', target);
    // Keep the local identity and any single-file warning on the tab so the
    // status line shows it again whenever the tab is re-activated.
    tab.pointerStatus = loadedStatus;
    context.setPointerStatus(state, loadedStatus);
    effects.persistTabs(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    context.setPointerStatus(state, message);
    context.setStatus(state, getActiveTab(state)?.status ?? 'error');
    appendPajaMessageLog(state, 'paja', { type: 'paja.local.error', fileName, error: message });
  }
}

/**
 * Pick the file to open from a drop: the first HTML file, else the first file
 * so the loader can report why it was rejected.
 *
 * @param files - Dropped or picked files.
 * @returns The chosen file, or `null` when the list is empty.
 *
 * @example
 * ```ts
 * const file = pickLocalHtmlFile(event.dataTransfer?.files ?? []);
 * ```
 */
export function pickLocalHtmlFile<T extends { readonly name: string; readonly type?: string }>(
  files: ArrayLike<T> | Iterable<T>,
): T | null {
  const list = Array.from(files);
  return list.find((file) => isPajaLocalHtmlFile(file)) ?? list[0] ?? null;
}

/**
 * Wire the "Open file…" button, hidden file input, and page-wide drag and drop
 * to a local-file loader. Only runtime-pointer mode renders these controls.
 *
 * @param load - Loads one picked or dropped file.
 * @returns Removes every listener this function installed.
 *
 * @example
 * ```ts
 * const dispose = installLocalFileControls((file) => state.loadLocalFile(file));
 * ```
 */
export function installLocalFileControls(load: (file: File) => Promise<void>): () => void {
  const input = document.getElementById('runtime-local-file');
  const open = document.getElementById('runtime-local-open');
  const stage = document.getElementById('napplet-stage');
  if (!(input instanceof HTMLInputElement) || !(open instanceof HTMLButtonElement)) return disposeNothing;

  let dragDepth = 0;
  const setDropActive = (active: boolean) => stage?.classList.toggle('drop-active', active);
  const carriesFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') === true;

  const onOpen = () => input.click();
  const onChange = () => {
    const file = pickLocalHtmlFile(input.files ?? []);
    input.value = '';
    if (file) void load(file);
  };
  const onDragEnter = (event: DragEvent) => {
    if (!carriesFiles(event)) return;
    dragDepth += 1;
    setDropActive(true);
  };
  const onDragOver = (event: DragEvent) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  };
  const onDragLeave = (event: DragEvent) => {
    if (!carriesFiles(event)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) setDropActive(false);
  };
  const onDrop = (event: DragEvent) => {
    if (!carriesFiles(event)) return;
    // Prevent the browser from navigating the Paja host to the dropped file.
    event.preventDefault();
    dragDepth = 0;
    setDropActive(false);
    const file = pickLocalHtmlFile(event.dataTransfer?.files ?? []);
    if (file) void load(file);
  };

  open.addEventListener('click', onOpen);
  input.addEventListener('change', onChange);
  document.addEventListener('dragenter', onDragEnter);
  document.addEventListener('dragover', onDragOver);
  document.addEventListener('dragleave', onDragLeave);
  document.addEventListener('drop', onDrop);
  return () => {
    open.removeEventListener('click', onOpen);
    input.removeEventListener('change', onChange);
    document.removeEventListener('dragenter', onDragEnter);
    document.removeEventListener('dragover', onDragOver);
    document.removeEventListener('dragleave', onDragLeave);
    document.removeEventListener('drop', onDrop);
  };
}

function disposeNothing(): void {
  // Nothing was installed: the host page rendered no local-file controls.
}
