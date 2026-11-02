/**
 * Paja's Language models sidebar panel and NAP-LLM dialogs.
 *
 * The panel edits connection metadata, routes API keys to the encrypted vault
 * (or a session-only tier) and renders the saved list. Two modal dialogs serve
 * the runtime host: the connection chooser used by `llm.select`, and the vault
 * password prompt. Nothing here reads prompt content; credentials are read
 * from the form once and handed straight to the vault.
 */

import { LLM_PROVIDER_PRESETS, type LlmProviderPreset } from '@kehto/services';
import type { PajaConfirmationHandler } from './browser-adapter.js';
import { fetchPajaLlmModels, PajaLlmModelsError } from './browser-llm-models.js';
import {
  createPajaLlmConnectionStore,
  createPajaLlmHost,
  normalizePajaLlmBaseUrl,
  type PajaLlmConnectionRecord,
  type PajaLlmConnectionStore,
  type PajaLlmHost,
  type PajaLlmChooserContext,
  type PajaLlmRequestIdentity,
} from './browser-llm-connections.js';
import { createPajaLlmVault, validatePajaLlmVaultPassword, type PajaLlmCredentialStorage, type PajaLlmVault } from './browser-llm-vault.js';

/** Panel controller exposed to the host page. */
export interface PajaLlmPanel {
  /** Show the chooser for one `llm.select`; resolves null when the user declines. */
  chooseConnection(candidates: readonly PajaLlmConnectionRecord[], context: PajaLlmChooserContext): Promise<PajaLlmConnectionRecord | null>;
  /** Prompt for the vault password until it unlocks, the user cancels or `signal` aborts. */
  requestUnlock(signal?: AbortSignal): Promise<boolean>;
  /** Expand the panel and focus its first field. */
  open(): void;
  /** Re-render the connection list and vault controls. */
  render(): void;
  dispose(): void;
}

/** Page wiring for {@link installPajaLlmPanel}. */
export interface PajaLlmPanelOptions {
  store: PajaLlmConnectionStore;
  vault: PajaLlmVault;
  /** Called after connections or vault state change. */
  onChange?: () => void;
  /** Id factory for new connections. */
  createId?: () => string;
}

function byId<T extends HTMLElement>(id: string, ctor: new () => T): T | null {
  const element = document.getElementById(id);
  return element instanceof ctor ? element : null;
}

function presetById(id: string): LlmProviderPreset | undefined {
  return LLM_PROVIDER_PRESETS.find((preset) => preset.id === id);
}

function defaultId(): string {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID().slice(0, 8) : Math.random().toString(16).slice(2, 10);
  return `conn-${random}`;
}

/** Close a dialog prompt when its request is withdrawn; returns a detach function. */
function withdrawOnAbort(signal: AbortSignal | undefined, withdraw: () => void): () => void {
  if (!signal) return () => undefined;
  signal.addEventListener('abort', withdraw, { once: true });
  return () => signal.removeEventListener('abort', withdraw);
}

interface PasswordDialog {
  prompt(mode: 'create' | 'unlock', signal?: AbortSignal): Promise<string | null>;
  dispose(): void;
}

function createPasswordDialog(): PasswordDialog {
  const dialog = byId('paja-llm-vault-dialog', HTMLDialogElement);
  const title = byId('paja-llm-vault-title', HTMLElement);
  const copy = byId('paja-llm-vault-copy', HTMLElement);
  const input = byId('paja-llm-vault-password', HTMLInputElement);
  const error = byId('paja-llm-vault-error', HTMLElement);
  const confirm = byId('paja-llm-vault-confirm', HTMLButtonElement);
  const cancel = byId('paja-llm-vault-cancel', HTMLButtonElement);
  if (!dialog || !title || !copy || !input || !error || !confirm || !cancel) return { prompt: async () => null, dispose: () => undefined };
  let settle: ((value: string | null) => void) | null = null;
  const finish = (value: string | null): void => {
    const current = settle; settle = null;
    input.value = ''; error.textContent = '';
    if (dialog.open) dialog.close();
    current?.(value);
  };
  const onConfirm = (): void => {
    if (dialog.dataset.mode === 'create') {
      const problem = validatePajaLlmVaultPassword(input.value);
      if (problem) { error.textContent = problem; input.focus(); return; }
    }
    finish(input.value);
  };
  const onCancel = (event: Event): void => { event.preventDefault(); finish(null); };
  confirm.addEventListener('click', onConfirm);
  cancel.addEventListener('click', onCancel);
  dialog.addEventListener('cancel', onCancel);
  return {
    prompt(mode, signal) {
      if (settle) finish(null);
      if (signal?.aborted) return Promise.resolve(null);
      dialog.dataset.mode = mode;
      title.textContent = mode === 'create' ? 'Create a credential vault password' : 'Unlock the credential vault';
      copy.textContent = mode === 'create'
        ? `Paja encrypts remembered API keys with this password (PBKDF2-SHA-256 and AES-GCM). It is never stored or sent anywhere; use at least ${String(12)} characters.`
        : 'Enter the vault password to use a remembered API key for this session.';
      confirm.textContent = mode === 'create' ? 'Create vault' : 'Unlock';
      return new Promise<string | null>((resolve) => {
        const mine = (value: string | null): void => { detach(); resolve(value); };
        const detach = withdrawOnAbort(signal, () => { if (settle === mine) finish(null); });
        settle = mine;
        dialog.showModal();
        input.focus();
      });
    },
    dispose() {
      finish(null);
      confirm.removeEventListener('click', onConfirm);
      cancel.removeEventListener('click', onCancel);
      dialog.removeEventListener('cancel', onCancel);
    },
  };
}

interface ChooserDialog {
  choose: PajaLlmPanel['chooseConnection'];
  dispose(): void;
}

function createChooserDialog(): ChooserDialog {
  const dialog = byId('paja-llm-select-dialog', HTMLDialogElement);
  const copy = byId('paja-llm-select-copy', HTMLElement);
  const select = byId('paja-llm-select-options', HTMLSelectElement);
  const use = byId('paja-llm-select-use', HTMLButtonElement);
  const deny = byId('paja-llm-select-deny', HTMLButtonElement);
  if (!dialog || !copy || !select || !use || !deny) return { choose: async () => null, dispose: () => undefined };
  let settle: ((value: string | null) => void) | null = null;
  const finish = (value: string | null): void => {
    const current = settle; settle = null;
    if (dialog.open) dialog.close();
    current?.(value);
  };
  const onUse = (): void => finish(select.value || null);
  const onDeny = (event: Event): void => { event.preventDefault(); finish(null); };
  use.addEventListener('click', onUse);
  deny.addEventListener('click', onDeny);
  dialog.addEventListener('cancel', onDeny);
  return {
    choose(candidates, context) {
      if (settle) finish(null);
      if (context.signal?.aborted) return Promise.resolve(null);
      const wanted = [context.requirements.model ? `model ${context.requirements.model}` : null, context.requirements.images ? 'image input' : null, context.requirements.json ? 'JSON output' : null].filter(Boolean).join(', ');
      copy.textContent = `${context.napplet.dTag} (${context.windowId}) asks to use a language model${wanted ? ` with ${wanted}` : ''}. Selecting does not send anything yet; each generation asks for consent.`;
      select.replaceChildren(...candidates.map((record) => {
        const option = document.createElement('option');
        option.value = record.id;
        option.textContent = `${record.name} — ${record.model} (${new URL(record.baseUrl).origin})`;
        return option;
      }));
      // A sized list box starts with no selection; default to the first compatible connection.
      select.selectedIndex = candidates.length > 0 ? 0 : -1;
      return new Promise<PajaLlmConnectionRecord | null>((resolve) => {
        const mine = (value: string | null): void => { detach(); resolve(candidates.find((record) => record.id === value) ?? null); };
        const detach = withdrawOnAbort(context.signal, () => { if (settle === mine) finish(null); });
        settle = mine;
        dialog.showModal();
        select.focus();
      });
    },
    dispose() {
      finish(null);
      use.removeEventListener('click', onUse);
      deny.removeEventListener('click', onDeny);
      dialog.removeEventListener('cancel', onDeny);
    },
  };
}

interface FormElements {
  form: HTMLFormElement; preset: HTMLSelectElement; name: HTMLInputElement; baseUrl: HTMLInputElement; model: HTMLInputElement;
  modelField: HTMLElement; modelSelect: HTMLSelectElement; modelSelectField: HTMLElement; modelStatus: HTMLElement;
  examples: HTMLDataListElement; credential: HTMLInputElement; remember: HTMLInputElement; images: HTMLInputElement; json: HTMLInputElement;
  list: HTMLElement; status: HTMLElement; lock: HTMLButtonElement; section: HTMLDetailsElement | null;
}

function readForm(): FormElements | null {
  const form = byId('paja-llm-form', HTMLFormElement);
  const preset = byId('paja-llm-preset', HTMLSelectElement);
  const name = byId('paja-llm-name', HTMLInputElement);
  const baseUrl = byId('paja-llm-base-url', HTMLInputElement);
  const model = byId('paja-llm-model', HTMLInputElement);
  const modelField = byId('paja-llm-model-field', HTMLElement);
  const modelSelect = byId('paja-llm-model-select', HTMLSelectElement);
  const modelSelectField = byId('paja-llm-model-select-field', HTMLElement);
  const modelStatus = byId('paja-llm-model-status', HTMLElement);
  const examples = byId('paja-llm-model-examples', HTMLDataListElement);
  const credential = byId('paja-llm-credential', HTMLInputElement);
  const remember = byId('paja-llm-remember', HTMLInputElement);
  const images = byId('paja-llm-images', HTMLInputElement);
  const json = byId('paja-llm-json', HTMLInputElement);
  const list = byId('paja-llm-connections', HTMLElement);
  const status = byId('paja-llm-status', HTMLElement);
  const lock = byId('paja-llm-vault-lock', HTMLButtonElement);
  if (!form || !preset || !name || !baseUrl || !model || !modelField || !modelSelect || !modelSelectField || !modelStatus || !examples || !credential || !remember || !images || !json || !list || !status || !lock) return null;
  return {
    form, preset, name, baseUrl, model, modelField, modelSelect, modelSelectField, modelStatus, examples, credential, remember, images, json, list, status, lock,
    section: byId('paja-section-llm', HTMLDetailsElement),
  };
}

/** Model dropdown states shown under the field. */
type ModelStatusState = 'idle' | 'busy' | 'ready' | 'error';

/**
 * Attach the Language models panel to the host page.
 *
 * @param options - Store, vault and change callback.
 * @returns Panel controller with the chooser and unlock prompts the runtime host uses.
 * @example const panel = installPajaLlmPanel({ store, vault, onChange: rerender });
 */
export function installPajaLlmPanel(options: PajaLlmPanelOptions): PajaLlmPanel {
  const { store, vault } = options;
  const createId = options.createId ?? defaultId;
  const password = createPasswordDialog();
  const chooser = createChooserDialog();
  const elements = readForm();
  const disposers: Array<() => void> = [password.dispose, chooser.dispose];

  const setStatus = (text: string, invalid = false): void => {
    if (!elements) return;
    elements.status.textContent = text;
    elements.form.setAttribute('aria-invalid', String(invalid));
  };

  async function ensureVaultUnlocked(): Promise<boolean> {
    if (vault.isUnlocked()) return true;
    if (!vault.hasStoredSecrets()) {
      const created = await password.prompt('create');
      if (created === null) return false;
      await vault.create(created);
      return true;
    }
    return requestUnlock();
  }

  async function requestUnlock(signal?: AbortSignal): Promise<boolean> {
    for (;;) {
      if (vault.isUnlocked()) return true;
      const entered = await password.prompt('unlock', signal);
      if (entered === null) return false;
      if (await vault.unlock(entered)) return true;
      setStatus('Wrong vault password. Try again or clear the vault to start over.', true);
    }
  }

  /** Abort handle for the in-flight model listing; a newer request cancels an older one. */
  let modelListing: AbortController | null = null;

  function setModelStatus(text: string, state: ModelStatusState = 'idle'): void {
    if (!elements) return;
    elements.modelStatus.textContent = text;
    if (state === 'idle') delete elements.modelStatus.dataset.state;
    else elements.modelStatus.dataset.state = state;
  }

  /**
   * Show either the model dropdown or free-text entry. The hidden control is also
   * disabled so it cannot block submit or leak into form validation.
   */
  function setModelMode(mode: 'text' | 'select'): void {
    if (!elements) return;
    const listing = mode === 'select';
    elements.modelField.hidden = listing;
    elements.modelSelectField.hidden = !listing;
    elements.model.disabled = listing;
    elements.modelSelect.disabled = !listing;
  }

  /** The model id from whichever control is active. */
  function currentModel(): string {
    if (!elements) return '';
    return (elements.modelSelectField.hidden ? elements.model.value : elements.modelSelect.value).trim();
  }

  /**
   * Populate the dropdown for a preset that declares a listing path. A failure
   * falls back to free-text entry so a connection can still be saved, and says
   * why: the usual cause is a server that omits CORS headers on its listing.
   */
  async function refreshModels(): Promise<void> {
    if (!elements) return;
    modelListing?.abort();
    modelListing = null;
    const preset = presetById(elements.preset.value);
    const modelsPath = preset?.modelsPath;
    if (!modelsPath) {
      setModelMode('text');
      setModelStatus('');
      return;
    }
    setModelMode('select');
    elements.modelSelect.replaceChildren();
    let baseUrl: string;
    try {
      baseUrl = normalizePajaLlmBaseUrl(elements.baseUrl.value);
    } catch (error) {
      setModelMode('text');
      setModelStatus(error instanceof Error ? error.message : 'Enter an absolute API base URL.', 'error');
      return;
    }
    const controller = new AbortController();
    modelListing = controller;
    setModelStatus('Connecting…', 'busy');
    try {
      const models = await fetchPajaLlmModels({
        baseUrl,
        modelsPath,
        ...(elements.credential.value.trim() ? { credential: elements.credential.value.trim() } : {}),
        signal: controller.signal,
      });
      if (modelListing !== controller || !elements) return;
      elements.modelSelect.replaceChildren(...models.map((id) => Object.assign(document.createElement('option'), { value: id, textContent: id })));
      setModelStatus(`Connected ✓ — ${String(models.length)} model${models.length === 1 ? '' : 's'}`, 'ready');
    } catch (error) {
      if (modelListing !== controller || !elements) return;
      if (error instanceof PajaLlmModelsError && error.failure === 'aborted') return;
      setModelMode('text');
      setModelStatus(`${error instanceof Error ? error.message : 'Could not list models.'} Type the model id instead.`, 'error');
    } finally {
      if (modelListing === controller) modelListing = null;
    }
  }

  let appliedPreset: LlmProviderPreset | undefined;

  function applyPreset(): void {
    if (!elements) return;
    const preset = presetById(elements.preset.value);
    if (!preset) return;
    // A key entered for one provider must never follow an automatic URL change.
    if (appliedPreset && appliedPreset.id !== preset.id) elements.credential.value = '';
    if (!elements.name.value || elements.name.value === appliedPreset?.label) elements.name.value = preset.label;
    appliedPreset = preset;
    if (preset.baseUrl) elements.baseUrl.value = preset.baseUrl;
    elements.examples.replaceChildren(...preset.exampleModels.map((value) => Object.assign(document.createElement('option'), { value })));
    elements.credential.placeholder = preset.requiresCredential ? 'API key (sent only to this base URL)' : 'Optional for local servers';
    void refreshModels();
  }

  function renderList(): void {
    if (!elements) return;
    const rows = store.list().map((record) => {
      const item = document.createElement('li');
      item.className = 'llm-connection';
      item.dataset.llmConnection = record.id;
      const label = document.createElement('span');
      label.className = 'llm-connection-label';
      const tier = record.credentialStorage === 'vault' ? (vault.isUnlocked() ? 'key unlocked' : 'key encrypted, locked')
        : record.credentialStorage === 'session' ? (vault.getCredential(record.id) ? 'key for this session' : 'key missing') : 'no key';
      label.textContent = `${record.name} · ${record.model} · ${new URL(record.baseUrl).origin} · ${tier}`;
      label.title = `${record.protocol}${record.images ? ' · images' : ''}${record.json ? ' · json' : ''}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove connection ${record.name}`);
      remove.addEventListener('click', () => { void removeConnection(record); });
      item.append(label, remove);
      return item;
    });
    elements.list.replaceChildren(...rows);
    elements.lock.hidden = !vault.isUnlocked();
    if (rows.length === 0) setStatus('No model connections yet. Napplets asking for a model see an explicit unsupported result until you add one.');
  }

  async function removeConnection(record: PajaLlmConnectionRecord): Promise<void> {
    if (record.credentialStorage === 'vault' && !vault.isUnlocked() && vault.hasStoredSecrets()) {
      if (!await requestUnlock()) { setStatus('Unlock the vault to remove a connection with a remembered key.', true); return; }
    }
    await vault.removeCredential(record.id);
    store.remove(record.id);
    setStatus(`Removed ${record.name}.`);
    renderList();
    options.onChange?.();
  }

  async function submit(event: Event): Promise<void> {
    event.preventDefault();
    if (!elements) return;
    const credential = elements.credential.value;
    const storage: PajaLlmCredentialStorage = credential ? (elements.remember.checked ? 'vault' : 'session') : 'none';
    const preset = presetById(elements.preset.value);
    const model = currentModel();
    if (!model) {
      setModelStatus('Choose or type a model id.', 'error');
      return;
    }
    let record: PajaLlmConnectionRecord;
    try {
      record = {
        id: createId(), name: elements.name.value, presetId: preset?.id ?? 'custom', protocol: preset?.protocol ?? 'openai-chat',
        baseUrl: normalizePajaLlmBaseUrl(elements.baseUrl.value), model, images: elements.images.checked, json: elements.json.checked,
        credentialStorage: storage, ...(preset?.credentialHeader ? { credentialHeader: preset.credentialHeader } : {}),
      };
      if (storage === 'vault' && !await ensureVaultUnlocked()) { setStatus('The key was not saved: the vault stayed locked.', true); return; }
      if (storage !== 'none') await vault.setCredential(record.id, credential, storage);
      store.save(record);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save the connection.', true);
      return;
    }
    elements.credential.value = '';
    elements.name.value = '';
    elements.model.value = '';
    setStatus(storage === 'vault' ? `Saved ${record.name}; its key is encrypted in the vault.` : storage === 'session' ? `Saved ${record.name}; its key lasts until this page closes.` : `Saved ${record.name} without a key.`);
    renderList();
    options.onChange?.();
  }

  if (elements) {
    elements.preset.replaceChildren(...LLM_PROVIDER_PRESETS.map((preset) => Object.assign(document.createElement('option'), { value: preset.id, textContent: preset.label })));
    applyPreset();
    const onPreset = (): void => applyPreset();
    // Editing the API root re-lists the models, which is also how a loopback
    // server on another port (or a fixed value) is retried without re-selecting.
    const onBaseUrl = (): void => {
      if (!presetById(elements.preset.value)?.modelsPath) return;
      void refreshModels();
    };
    const onSubmit = (event: Event): void => { void submit(event); };
    const onLock = (): void => { vault.lock(); renderList(); setStatus('Vault locked for this session.'); options.onChange?.(); };
    elements.preset.addEventListener('change', onPreset);
    elements.baseUrl.addEventListener('change', onBaseUrl);
    elements.form.addEventListener('submit', onSubmit);
    elements.lock.addEventListener('click', onLock);
    disposers.push(() => {
      modelListing?.abort();
      elements.preset.removeEventListener('change', onPreset);
      elements.baseUrl.removeEventListener('change', onBaseUrl);
      elements.form.removeEventListener('submit', onSubmit);
      elements.lock.removeEventListener('click', onLock);
    });
    renderList();
  }
  disposers.push(vault.subscribe(() => renderList()));

  return {
    chooseConnection: chooser.choose,
    requestUnlock,
    open() {
      if (!elements) return;
      if (elements.section) elements.section.open = true;
      elements.section?.scrollIntoView?.({ block: 'nearest' });
      elements.name.focus();
    },
    render: renderList,
    dispose() { for (const dispose of disposers.splice(0)) dispose(); },
  };
}

/** Host-page wiring for {@link installPajaLlm}. */
export interface PajaLlmInstallOptions {
  /** Shared Paja confirmation dialog. */
  confirm: PajaConfirmationHandler;
  /** Resolve the napplet identity bound to a runtime window. */
  getIdentity(windowId: string): PajaLlmRequestIdentity;
  /** Called after connections or vault state change so the Interfaces panel re-renders. */
  onChange?: () => void;
}

/** Installed Paja NAP-LLM wiring. */
export interface PajaLlmInstallation {
  /** Host to hand to `createPajaAdapter`. */
  readonly host: PajaLlmHost;
  readonly panel: PajaLlmPanel;
  dispose(): void;
}

/**
 * Create the store, vault, panel and runtime host together.
 *
 * @param options - Confirmation dialog, identity resolver and change callback.
 * @returns The host for the shell adapter plus a disposer for page teardown.
 * @example const llm = installPajaLlm({ confirm, getIdentity, onChange });
 */
export function installPajaLlm(options: PajaLlmInstallOptions): PajaLlmInstallation {
  const store = createPajaLlmConnectionStore();
  const vault = createPajaLlmVault();
  const panel = installPajaLlmPanel({ store, vault, onChange: options.onChange });
  const host = createPajaLlmHost({
    store,
    vault,
    confirm: options.confirm,
    chooseConnection: panel.chooseConnection,
    requestUnlock: panel.requestUnlock,
    openPanel: panel.open,
    getIdentity: options.getIdentity,
  });
  return { host, panel, dispose: panel.dispose };
}
