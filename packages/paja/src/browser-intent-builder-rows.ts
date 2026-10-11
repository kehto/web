export interface IntentLinkBuilderParameterRow {
  readonly nameValue: string;
  readonly included: HTMLInputElement;
  readonly name: HTMLInputElement | null;
  readonly value: HTMLInputElement;
}

/** Append one advertised or custom parameter row without deciding its payload semantics. */
export function appendIntentLinkBuilderParameterRow(
  container: HTMLElement,
  id: string,
  index: number,
  name: string,
  custom: boolean,
  onChange: () => void,
): IntentLinkBuilderParameterRow {
  const row = document.createElement('div');
  row.className = 'config-field';
  const included = document.createElement('input');
  included.type = 'checkbox';
  included.checked = false;
  included.id = `${id}-include-${index}`;
  included.setAttribute('aria-label', `Include ${name || 'custom parameter'}`);
  const inclusionLabel = document.createElement('label');
  inclusionLabel.htmlFor = included.id;
  inclusionLabel.textContent = `Include ${name || 'custom parameter'}`;
  const nameInput = custom ? document.createElement('input') : null;
  if (nameInput) {
    nameInput.type = 'text';
    nameInput.value = name;
    nameInput.placeholder = 'Parameter name';
    nameInput.setAttribute('aria-label', 'Parameter name');
  } else {
    const fixedName = document.createElement('span');
    fixedName.className = 'config-field-label';
    fixedName.textContent = name;
    row.append(fixedName);
  }
  const value = document.createElement('input');
  value.type = 'text';
  value.id = `${id}-value-${index}`;
  value.placeholder = 'Text value';
  value.setAttribute('aria-label', `${name || 'Custom'} value`);
  const valueLabel = document.createElement('label');
  valueLabel.className = 'config-field-label';
  valueLabel.htmlFor = value.id;
  valueLabel.textContent = `Value for ${name || 'custom parameter'}`;
  row.append(included, inclusionLabel);
  if (nameInput) row.append(nameInput);
  row.append(valueLabel, value);
  container.append(row);
  value.addEventListener('input', () => {
    if (value.value.length > 0) included.checked = true;
    onChange();
  });
  nameInput?.addEventListener('input', () => {
    const parameterName = nameInput.value || 'custom parameter';
    included.setAttribute('aria-label', `Include ${parameterName}`);
    inclusionLabel.textContent = `Include ${parameterName}`;
    value.setAttribute('aria-label', `${nameInput.value || 'Custom'} value`);
    valueLabel.textContent = `Value for ${parameterName}`;
    onChange();
  });
  return { nameValue: name, included, name: nameInput, value };
}
