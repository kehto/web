interface IntentBuilderSelect {
  readonly field: HTMLLabelElement;
  readonly control: HTMLSelectElement;
}

/** DOM controls used exclusively by the native intent-link builder. */
export interface IntentLinkBuilderElements {
  readonly dialog: HTMLDialogElement;
  readonly fields: HTMLElement;
  readonly status: HTMLElement;
  readonly cancel: HTMLButtonElement;
  readonly copy: HTMLButtonElement;
  readonly test: HTMLButtonElement;
  readonly convention: IntentBuilderSelect;
  readonly routing: IntentBuilderSelect;
  readonly payloadMode: IntentBuilderSelect;
  readonly parameterGroup: HTMLFieldSetElement;
  readonly parameterRows: HTMLElement;
  readonly addParameter: HTMLButtonElement;
  readonly jsonField: HTMLLabelElement;
  readonly json: HTMLTextAreaElement;
  readonly preview: HTMLOutputElement;
  readonly link: HTMLTextAreaElement;
}

function element<K extends keyof HTMLElementTagNameMap>(name: K, className?: string): HTMLElementTagNameMap[K] {
  const result = document.createElement(name);
  if (className) result.className = className;
  return result;
}

function createSelect(label: string, controlId: string): IntentBuilderSelect {
  const field = element('label', 'config-field') as HTMLLabelElement;
  const labelText = element('span', 'config-field-label');
  labelText.textContent = label;
  const control = element('select') as HTMLSelectElement;
  control.id = controlId;
  field.htmlFor = control.id;
  field.append(labelText, control);
  return { field, control };
}

function createTextAreaField(
  label: string,
  controlId: string,
  readOnly = false,
): { field: HTMLLabelElement; control: HTMLTextAreaElement } {
  const field = element('label', 'config-field') as HTMLLabelElement;
  const labelText = element('span', 'config-field-label');
  labelText.textContent = label;
  const control = element('textarea') as HTMLTextAreaElement;
  control.id = controlId;
  control.rows = readOnly ? 3 : 5;
  control.readOnly = readOnly;
  control.spellcheck = false;
  field.htmlFor = control.id;
  field.append(labelText, control);
  return { field, control };
}

/** Create the stable DOM skeleton shared by each native builder instance. */
export function createIntentLinkBuilderElements(id: string): IntentLinkBuilderElements {
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
  const { field: jsonField, control: json } = createTextAreaField('JSON payload', `${id}-json-payload`);
  const previewField = element('label', 'config-field');
  const previewLabel = element('span', 'config-field-label');
  previewLabel.textContent = 'Decoded preview';
  const preview = element('output') as HTMLOutputElement;
  preview.id = `${id}-preview`;
  previewField.append(previewLabel, preview);
  const { field: linkField, control: link } = createTextAreaField('Copyable URL', `${id}-url`, true);
  fields.append(
    convention.field,
    routing.field,
    payloadMode.field,
    parameterGroup,
    jsonField,
    previewField,
    linkField,
  );
  return {
    dialog,
    fields,
    status,
    cancel,
    copy,
    test,
    convention,
    routing,
    payloadMode,
    parameterGroup,
    parameterRows,
    addParameter,
    jsonField,
    json,
    preview,
    link,
  };
}

/** Add an option to one builder select while preserving its manifest order. */
export function appendIntentLinkBuilderOption(
  select: HTMLSelectElement,
  value: string,
  label: string,
  disabled = false,
): void {
  const option = element('option') as HTMLOptionElement;
  option.value = value;
  option.textContent = label;
  option.disabled = disabled;
  select.append(option);
}
