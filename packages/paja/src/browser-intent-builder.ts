import { naddrEncode } from 'nostr-tools/nip19';

import {
  createPajaIntentLink,
  parsePajaIntentLink,
  type ParsedPajaIntentLink,
} from './intent-link.js';
import type { PajaResolvedPointer } from './runtime-resolver.js';

let nextBuilderId = 0;

interface ParameterRow {
  readonly nameValue: string;
  readonly included: HTMLInputElement;
  readonly name: HTMLInputElement | null;
  readonly value: HTMLInputElement;
}

/** Configuration for a native Paja intent-link builder. */
export interface PajaIntentLinkBuilderOptions {
  /** Receive a validated link only after the user explicitly chooses Test intent. */
  onTest(link: ParsedPajaIntentLink): void | Promise<void>;
  /** Return the Paja location used as the share-link base. */
  href?: () => string;
}

/** Native builder controls owned by the host integration. */
export interface PajaIntentLinkBuilder {
  /** Open the builder from an already verified target; this never fetches or runs it. */
  open(target: PajaResolvedPointer): void;
  /** Remove the dialog and listeners created by this builder. */
  dispose(): void;
}

function element<K extends keyof HTMLElementTagNameMap>(name: K, className?: string): HTMLElementTagNameMap[K] {
  const result = document.createElement(name);
  if (className) result.className = className;
  return result;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to create this intent link.';
}

/**
 * Create a native dialog that turns verified manifest contracts into Paja intent links.
 *
 * @param options - Explicit test callback and optional URL-base resolver.
 * @returns Controls for opening and disposing the builder.
 * @example
 * ```ts
 * const builder = createPajaIntentLinkBuilder({ onTest: (link) => launch(link) });
 * builder.open(verifiedTarget);
 * ```
 */
export function createPajaIntentLinkBuilder(options: PajaIntentLinkBuilderOptions): PajaIntentLinkBuilder {
  const id = `paja-intent-builder-${++nextBuilderId}`;
  const href = options.href ?? (() => window.location.href);
  const dialog = element('dialog', 'config-dialog');
  dialog.id = `${id}-dialog`;
  dialog.setAttribute('aria-labelledby', `${id}-title`);
  dialog.setAttribute('aria-describedby', `${id}-status`);
  const form = element('div', 'dialog');
  const title = element('div', 'dialog-title');
  title.id = `${id}-title`;
  title.textContent = 'Create intent link';
  const fields = element('div', 'config-fields');
  const status = element('div', 'config-error');
  status.id = `${id}-status`;
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const actions = element('div', 'dialog-actions');
  const cancel = element('button') as HTMLButtonElement;
  cancel.type = 'button';
  cancel.id = `${id}-cancel`;
  cancel.textContent = 'Cancel';
  const copy = element('button') as HTMLButtonElement;
  copy.type = 'button';
  copy.id = `${id}-copy`;
  copy.textContent = 'Copy link';
  const test = element('button') as HTMLButtonElement;
  test.type = 'button';
  test.id = `${id}-test`;
  test.textContent = 'Test intent';
  actions.append(cancel, copy, test);
  form.append(title, fields, status, actions);
  dialog.append(form);
  (document.body ?? document.documentElement).append(dialog);

  let opener: HTMLElement | null = null;
  let target: PajaResolvedPointer | null = null;
  let contracts: PajaResolvedPointer['manifest']['archetypes'] = [];
  let rows: ParameterRow[] = [];
  let disposed = false;

  const convention = createSelect('Convention', `${id}-convention`);
  const routing = createSelect('Routing', `${id}-routing`);
  const payloadMode = createSelect('Payload mode', `${id}-payload-mode`);
  const parameterGroup = element('fieldset', 'config-group');
  const parameterLegend = element('legend');
  parameterLegend.textContent = 'Parameters';
  const parameterRows = element('div');
  parameterRows.id = `${id}-parameters`;
  const addParameter = element('button') as HTMLButtonElement;
  addParameter.type = 'button';
  addParameter.id = `${id}-add-parameter`;
  addParameter.textContent = 'Add parameter';
  parameterGroup.append(parameterLegend, parameterRows, addParameter);
  const jsonField = element('label', 'config-field');
  const jsonLabel = element('span', 'config-field-label');
  jsonLabel.textContent = 'JSON payload';
  const json = element('textarea') as HTMLTextAreaElement;
  json.id = `${id}-json-payload`;
  json.rows = 5;
  json.spellcheck = false;
  jsonField.htmlFor = json.id;
  jsonField.append(jsonLabel, json);
  const previewField = element('label', 'config-field');
  const previewLabel = element('span', 'config-field-label');
  previewLabel.textContent = 'Decoded preview';
  const preview = element('output');
  preview.id = `${id}-preview`;
  previewField.append(previewLabel, preview);
  const linkField = element('label', 'config-field');
  const linkLabel = element('span', 'config-field-label');
  linkLabel.textContent = 'Copyable URL';
  const link = element('textarea') as HTMLTextAreaElement;
  link.id = `${id}-url`;
  link.readOnly = true;
  link.rows = 3;
  link.spellcheck = false;
  linkField.htmlFor = link.id;
  linkField.append(linkLabel, link);
  fields.append(convention.field, routing.field, payloadMode.field, parameterGroup, jsonField, previewField, linkField);

  function close(restoreFocus = true): void {
    if (dialog.open) dialog.close();
    if (restoreFocus) opener?.focus();
    opener = null;
  }

  function createSelect(label: string, controlId: string): { field: HTMLLabelElement; control: HTMLSelectElement } {
    const field = element('label', 'config-field') as HTMLLabelElement;
    const labelText = element('span', 'config-field-label');
    labelText.textContent = label;
    const control = element('select') as HTMLSelectElement;
    control.id = controlId;
    field.htmlFor = control.id;
    field.append(labelText, control);
    return { field, control };
  }

  function addOption(select: HTMLSelectElement, value: string, label: string, disabled = false): void {
    const option = element('option') as HTMLOptionElement;
    option.value = value;
    option.textContent = label;
    option.disabled = disabled;
    select.append(option);
  }

  function addRow(name: string, custom: boolean): void {
    const container = element('div', 'config-field');
    const included = element('input') as HTMLInputElement;
    included.type = 'checkbox';
    included.checked = false;
    included.id = `${id}-include-${rows.length}`;
    included.setAttribute('aria-label', `Include ${name || 'custom parameter'}`);
    const inclusionLabel = element('label');
    inclusionLabel.htmlFor = included.id;
    inclusionLabel.textContent = `Include ${name || 'custom parameter'}`;
    const nameInput = custom ? element('input') as HTMLInputElement : null;
    if (nameInput) {
      nameInput.type = 'text';
      nameInput.value = name;
      nameInput.placeholder = 'Parameter name';
      nameInput.setAttribute('aria-label', 'Parameter name');
    } else {
      const fixedName = element('span', 'config-field-label');
      fixedName.textContent = name;
      container.append(fixedName);
    }
    const value = element('input') as HTMLInputElement;
    value.type = 'text';
    value.id = `${id}-value-${rows.length}`;
    value.placeholder = 'Text value';
    value.setAttribute('aria-label', `${name || 'Custom'} value`);
    const valueLabel = element('label', 'config-field-label');
    valueLabel.htmlFor = value.id;
    valueLabel.textContent = `Value for ${name || 'custom parameter'}`;
    container.append(included, inclusionLabel);
    if (nameInput) container.append(nameInput);
    container.append(valueLabel, value);
    parameterRows.append(container);
    value.addEventListener('input', () => {
      if (value.value.length > 0) included.checked = true;
      updatePreview();
    });
    nameInput?.addEventListener('input', () => {
      const parameterName = nameInput.value || 'custom parameter';
      included.setAttribute('aria-label', `Include ${parameterName}`);
      inclusionLabel.textContent = `Include ${parameterName}`;
      value.setAttribute('aria-label', `${nameInput.value || 'Custom'} value`);
      valueLabel.textContent = `Value for ${parameterName}`;
      updatePreview();
    });
    rows.push({ nameValue: name, included, name: nameInput, value });
  }

  function selectedContract(): PajaResolvedPointer['manifest']['archetypes'][number] | null {
    return contracts.find((entry) => entry.convention === convention.control.value) ?? null;
  }

  function resetRows(): void {
    parameterRows.replaceChildren();
    rows = [];
    for (const name of selectedContract()?.params ?? []) addRow(name, false);
  }

  function recommendedUri(uri: string): string {
    if (!target || target.event.kind !== 35129 || !target.manifest.dTag) return uri;
    return `${uri}#${naddrEncode({
      identifier: target.manifest.dTag,
      pubkey: target.event.pubkey,
      kind: 35129,
      relays: [...target.pointer.relays],
    })}`;
  }

  function build(): ParsedPajaIntentLink {
    const contract = selectedContract();
    if (!target || !contract) throw new TypeError('Choose one advertised convention first.');
    const mode = payloadMode.control.value;
    let uri = contract.convention;
    let payload: unknown;
    let hasPayload = false;
    if (mode === 'text') {
      const fields: string[] = [];
      for (const row of rows) {
        if (!row.included.checked) continue;
        const name = row.name?.value ?? row.nameValue;
        if (!name) throw new TypeError('Included custom parameters need a name.');
        fields.push(`${encodeURIComponent(name)}=${encodeURIComponent(row.value.value)}`);
      }
      if (fields.length > 0) uri = `${uri}?${fields.join('&')}`;
    } else {
      if (!json.value.trim()) throw new TypeError('JSON payload is required in JSON mode.');
      try {
        payload = JSON.parse(json.value);
      } catch {
        throw new TypeError('JSON payload must be valid JSON.');
      }
      hasPayload = true;
    }
    if (routing.control.value === 'recommend') uri = recommendedUri(uri);
    const hrefValue = createPajaIntentLink({
      uri,
      ...(routing.control.value === 'exact' ? { pointer: target.pointer.value } : {}),
      ...(hasPayload ? { payload } : {}),
    }, href());
    const parsed = parsePajaIntentLink(hrefValue);
    if (!parsed) throw new TypeError('Intent link could not be parsed.');
    return parsed;
  }

  function updatePreview(): void {
    const jsonMode = payloadMode.control.value === 'json';
    parameterGroup.hidden = jsonMode;
    jsonField.hidden = !jsonMode;
    try {
      const parsed = build();
      const payload = Object.hasOwn(parsed.request, 'payload')
        ? JSON.stringify(parsed.request.payload)
        : 'none';
      const targetDescription = parsed.pointer
        ? 'exact verified target pointer'
        : parsed.request.handlerHint
          ? 'recommended named app'
          : 'recipient default';
      preview.textContent = `Convention: ${parsed.request.convention}\nPayload: ${payload}\nRouting: ${targetDescription}`;
      link.value = createPajaIntentLink({
        uri: parsed.uri,
        ...(parsed.pointer === undefined ? {} : { pointer: parsed.pointer }),
        ...(Object.hasOwn(parsed, 'payload') ? { payload: parsed.payload } : {}),
      }, href());
      status.textContent = '';
    } catch (error) {
      preview.textContent = '';
      link.value = '';
      status.textContent = message(error);
    }
  }

  function populate(nextTarget: PajaResolvedPointer): void {
    target = nextTarget;
    contracts = [...nextTarget.manifest.archetypes];
    convention.control.replaceChildren();
    routing.control.replaceChildren();
    payloadMode.control.replaceChildren();
    for (const contract of contracts) addOption(convention.control, contract.convention, contract.convention);
    addOption(routing.control, 'default', 'Recipient default');
    addOption(routing.control, 'recommend', 'Recommend this app', nextTarget.event.kind !== 35129 || !nextTarget.manifest.dTag);
    addOption(routing.control, 'exact', 'Exact target pointer');
    addOption(payloadMode.control, 'text', 'Text fields');
    addOption(payloadMode.control, 'json', 'JSON payload');
    json.value = '';
    resetRows();
    updatePreview();
  }

  const onConvention = () => { resetRows(); updatePreview(); };
  const onChange = () => updatePreview();
  const onAddParameter = () => { addRow('', true); updatePreview(); };
  const onCancel = () => close();
  const onCopy = async () => {
    updatePreview();
    if (!link.value) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(link.value);
      status.textContent = 'Link copied.';
    } catch {
      link.focus();
      link.select();
      status.textContent = 'Copy the selected link.';
    }
  };
  const onTest = () => {
    try {
      const parsed = build();
      close();
      void Promise.resolve().then(() => options.onTest(parsed)).catch((error) => {
        status.textContent = message(error);
        if (!dialog.open) dialog.showModal();
      });
    } catch (error) {
      status.textContent = message(error);
    }
  };
  const onCancelEvent = (event: Event) => { event.preventDefault(); close(); };
  convention.control.addEventListener('change', onConvention);
  routing.control.addEventListener('change', onChange);
  payloadMode.control.addEventListener('change', onChange);
  parameterRows.addEventListener('change', onChange);
  json.addEventListener('input', onChange);
  addParameter.addEventListener('click', onAddParameter);
  cancel.addEventListener('click', onCancel);
  const onCopyClick = () => { void onCopy(); };
  copy.addEventListener('click', onCopyClick);
  test.addEventListener('click', onTest);
  dialog.addEventListener('cancel', onCancelEvent);

  return {
    open(nextTarget) {
      if (disposed || nextTarget.manifest.archetypes.length === 0) return;
      if (dialog.open) close(false);
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      populate(nextTarget);
      dialog.showModal();
      convention.control.focus();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      convention.control.removeEventListener('change', onConvention);
      routing.control.removeEventListener('change', onChange);
      payloadMode.control.removeEventListener('change', onChange);
      parameterRows.removeEventListener('change', onChange);
      json.removeEventListener('input', onChange);
      addParameter.removeEventListener('click', onAddParameter);
      cancel.removeEventListener('click', onCancel);
      copy.removeEventListener('click', onCopyClick);
      test.removeEventListener('click', onTest);
      dialog.removeEventListener('cancel', onCancelEvent);
      close(false);
      dialog.remove();
    },
  };
}
