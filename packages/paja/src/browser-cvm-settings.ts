import { discoverCvmFamilies, type CvmDiscoveryCandidate, type CvmDiscoveryDependencies } from './cvm-discovery.js';
import { readCvmFamilies, saveCvmFamilies, type SavedCvmFamily } from './cvm-family-store.js';
import { normalizePajaCvmFamily } from './multiplayer-config.js';
import { getPajaSetting } from './settings.js';

/** Host-owned discovery UI. Saving reloads the host so existing iframe scopes are torn down. */
export function installPajaCvmSettings(deps: CvmDiscoveryDependencies): () => void {
  const form = document.getElementById('paja-cvm-form') as HTMLFormElement | null;
  if (!form) return () => undefined;
  const input = form.querySelector<HTMLInputElement>('#paja-cvm-discovery')!;
  const find = form.querySelector<HTMLButtonElement>('#paja-cvm-find')!;
  const results = form.querySelector<HTMLSelectElement>('#paja-cvm-results')!;
  const label = form.querySelector<HTMLInputElement>('#paja-cvm-label')!;
  const tools = form.querySelector<HTMLFieldSetElement>('#paja-cvm-tools')!;
  const json = form.querySelector<HTMLTextAreaElement>('#paja-cvm-json')!;
  const origin = form.querySelector<HTMLElement>('#paja-cvm-origin')!;
  const status = form.querySelector<HTMLElement>('#paja-cvm-status')!;
  const savedList = form.querySelector<HTMLElement>('#paja-cvm-saved')!;
  const manual = form.querySelector<HTMLButtonElement>('#paja-cvm-manual')!;
  const create = form.querySelector<HTMLButtonElement>('#paja-cvm-new')!;
  const save = form.querySelector<HTMLButtonElement>('#paja-cvm-save')!;
  const saved = readCvmFamilies();
  const listeners = new AbortController();
  let request: AbortController | undefined;
  let candidates: CvmDiscoveryCandidate[] = [];
  let selected: SavedCvmFamily | undefined;
  let editingIndex: number | undefined;
  let manualMode = true;
  const on = (element: EventTarget, type: string, listener: EventListener) => element.addEventListener(type, listener, { signal: listeners.signal });
  const showError = (error: unknown) => { status.textContent = error instanceof Error ? error.message : 'Unable to save this family.'; };

  function preview(): void {
    if (!selected || manualMode) return;
    const checked = Array.from(tools.querySelectorAll<HTMLInputElement>('input:checked')).map(item => Number(item.value));
    json.value = JSON.stringify({ ...selected.config, family: label.value, tools: selected.config.tools.filter((_tool, index) => checked.includes(index)) }, null, 2);
    save.disabled = !label.value.trim() || !checked.length;
  }
  function choose(entry: SavedCvmFamily): void {
    selected = entry;
    manualMode = entry.manual;
    json.readOnly = !entry.manual;
    origin.textContent = entry.manual ? 'Source: manual JSON' : `Source: ${entry.source}`;
    label.value = entry.config.family;
    label.disabled = entry.manual;
    tools.replaceChildren();
    tools.hidden = entry.manual;
    const legend = document.createElement('legend'); legend.textContent = 'Tools in this local family'; tools.append(legend);
    entry.config.tools.forEach((tool, index) => {
      const row = document.createElement('label');
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = String(index); checkbox.checked = true;
      row.append(checkbox, document.createTextNode(` ${tool.name}`)); tools.append(row);
    });
    json.value = JSON.stringify(entry.config, null, 2);
    save.disabled = false;
    status.textContent = 'Review the provider, local label, and tool pins before saving.';
  }
  function cancel(): void { request?.abort(); request = undefined; find.disabled = false; }
  on(find, 'click', () => {
    cancel();
    const controller = new AbortController(); request = controller;
    const timeout = setTimeout(() => controller.abort(new Error('Discovery timed out. Check the website and relay connections.')), getPajaSetting('cvm.discoveryTimeoutMs'));
    find.disabled = true; save.disabled = true; manualMode = false; results.disabled = true; results.replaceChildren(); candidates = []; selected = undefined; editingIndex = undefined;
    json.value = ''; json.readOnly = true; label.disabled = true; tools.hidden = true;
    origin.textContent = 'Source: discovery pending'; status.textContent = 'Looking for verified tool announcements…';
    void discoverCvmFamilies(input.value, deps, controller.signal).then(found => {
      if (request !== controller || listeners.signal.aborted) return;
      candidates = found;
      const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Choose a provider'; results.append(placeholder);
      found.forEach((candidate, index) => {
        const option = document.createElement('option'); option.value = String(index);
        const pubkey = candidate.config.server.pubkey;
        option.textContent = `${candidate.config.tools.length} tools · ${pubkey.slice(0, 12)}…${pubkey.slice(-12)}`;
        option.title = pubkey;
        results.append(option);
      });
      results.disabled = false;
      status.textContent = `${found.length} verified provider${found.length === 1 ? '' : 's'} found. Choose one to review.`;
      if (found.length === 1) { results.value = '0'; choose({ config: found[0].config, source: found[0].source, manual: false }); }
    }).catch(error => {
      if (request === controller && !listeners.signal.aborted) showError(controller.signal.aborted ? controller.signal.reason : error);
    }).finally(() => {
      clearTimeout(timeout);
      if (request === controller) { request = undefined; find.disabled = false; }
    });
  });
  on(input, 'input', () => {
    cancel(); results.disabled = true; candidates = []; selected = undefined;
    if (!manualMode) { json.value = ''; save.disabled = true; origin.textContent = 'Source: no selection'; }
    status.textContent = '';
  });
  on(input, 'keydown', event => { if ((event as KeyboardEvent).key === 'Enter') { event.preventDefault(); find.click(); } });
  on(results, 'change', () => {
    const candidate = results.value === '' ? undefined : candidates[Number(results.value)];
    if (candidate) { editingIndex = undefined; choose({ config: candidate.config, source: candidate.source, manual: false }); }
    else { selected = undefined; json.value = ''; save.disabled = true; origin.textContent = 'Source: no selection'; }
  });
  on(label, 'input', preview);
  on(tools, 'change', preview);
  on(manual, 'click', () => {
    cancel(); manualMode = true; selected = undefined; json.readOnly = false; label.disabled = true; tools.hidden = true; results.disabled = true;
    origin.textContent = 'Source: manual JSON'; status.textContent = 'Enter or edit a family object, then save.'; save.disabled = false; json.focus();
  });
  on(create, 'click', () => { editingIndex = undefined; json.value = ''; manual.click(); });
  on(form, 'submit', event => {
    event.preventDefault();
    try {
      if (request || (!manualMode && !selected)) throw new Error('Choose a provider before saving.');
      const config = normalizePajaCvmFamily(JSON.parse(json.value));
      const entry: SavedCvmFamily = { config, source: manualMode ? 'Manual JSON' : selected!.source, manual: manualMode };
      const next = [...saved];
      const index = editingIndex ?? next.findIndex(item => item.config.family === config.family && item.config.server.pubkey === config.server.pubkey);
      if (index >= 0) next[index] = entry; else next.push(entry);
      saveCvmFamilies(next); location.reload();
    } catch (error) { showError(error); }
  });
  for (const [index, entry] of saved.entries()) {
    const row = document.createElement('div');
    const view = document.createElement('button'); view.type = 'button'; view.textContent = `${entry.config.family} · ${entry.config.server.pubkey.slice(0, 12)}`;
    on(view, 'click', () => { cancel(); editingIndex = index; choose(entry); });
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove ${entry.config.family}`);
    on(remove, 'click', () => { try { saveCvmFamilies(saved.filter((_item, i) => i !== index)); location.reload(); } catch (error) { showError(error); } });
    row.append(view, remove); savedList.append(row);
  }
  if (!saved.length) savedList.textContent = 'No saved families.';
  if (saved[0]) { editingIndex = 0; choose(saved[0]); }
  return () => { cancel(); listeners.abort(); };
}
