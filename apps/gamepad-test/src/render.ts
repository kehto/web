import type { ControllerState } from './state.js';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text: string, className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className;
  return node;
}

function renderPad(pad: NonNullable<ControllerState['pads'][number]>): HTMLElement {
  const panel = element('section', '', 'pad');
  panel.dataset.index = String(pad.index);
  panel.append(element('h2', `Controller ${pad.index}`), element('p', pad.id, 'device-id'));
  panel.append(element('p', `${pad.mapping || 'Unmapped'} · ${pad.timestamp.toFixed(1)} ms`, 'metadata'));
  const axes = element('div', '', 'axes');
  pad.axes.forEach((value, index) => {
    const row = element('div', '', 'axis');
    const meter = element('meter', '');
    meter.min = -1; meter.max = 1; meter.value = value;
    meter.setAttribute('aria-label', `Axis ${index}`);
    const output = element('span', value.toFixed(3));
    output.dataset.axis = String(index);
    row.append(element('span', `Axis ${index}`), meter, output);
    axes.append(row);
  });
  const buttons = element('div', '', 'buttons');
  pad.buttons.forEach((button, index) => {
    const cell = element('div', '', 'button-value');
    cell.dataset.button = String(index);
    cell.dataset.pressed = String(button.pressed);
    cell.style.setProperty('--value', `${button.value * 100}%`);
    cell.append(element('span', `B${index}`), element('strong', button.value.toFixed(2)),
      element('small', button.pressed ? 'pressed' : button.touched ? 'touched' : 'released'));
    buttons.append(cell);
  });
  panel.append(element('h3', `Axes (${pad.axes.length})`), axes, element('h3', `Buttons (${pad.buttons.length})`), buttons);
  return panel;
}

export function renderPads(root: HTMLElement, pads: ControllerState['pads']): void {
  const controllers = element('div', '', 'controller-grid');
  const empty = pads.flatMap((pad, slot) => pad ? [] : [element('p', `Slot ${slot} · empty`, 'empty-slot')]);
  controllers.append(...pads.flatMap(pad => pad ? [renderPad(pad)] : []));
  root.replaceChildren(...empty, controllers);
  if (!pads.length) root.append(element('p', 'No controller slots reported.', 'empty-slot'));
}
