/**
 * ui/app.ts — The conformance web UI controller.
 *
 * Reads the profile and domain filter from the URL (deep links), runs the
 * catalog in this page, renders the result, and, when served live by
 * `kehto conformance --ui`, reloads on the server's debounced `rerun` event.
 */
import type { ConformanceProfile, ConformanceRun, RunOptions } from '../model.js';
import { escapeHtml, renderRun } from './render.js';
import { UI_STYLES } from './styles.js';

/** Options for {@link mountConformanceUi}. */
export interface ConformanceUiOptions {
  /** Run the catalog. */
  run(options: RunOptions): Promise<ConformanceRun>;
  /** Server-sent events URL that emits `rerun`; omit for a static page. */
  readonly eventsUrl?: string;
  /** Page title. */
  readonly title?: string;
}

/** State the UI exposes on `window.__kehtoConformanceUi` for tests and tooling. */
export interface ConformanceUiState {
  /** Completed runs in this page load. */
  runs: number;
  running: boolean;
  last: ConformanceRun | null;
  error: string | null;
}

/** Profile and domains selected by the page URL. */
export function selectionFromUrl(search: string): { profile: ConformanceProfile; domains: string[] } {
  const params = new URLSearchParams(search);
  const profile = params.get('profile') === 'minimal' ? 'minimal' : 'full';
  const domains = params.getAll('domain').flatMap((value) => value.split(',')).map((value) => value.trim()).filter(Boolean);
  return { profile, domains };
}

/** The deep link for a selection, relative to the current page. */
export function selectionToSearch(profile: ConformanceProfile, domains: readonly string[]): string {
  const params = new URLSearchParams({ profile });
  for (const domain of domains) params.append('domain', domain);
  return `?${params.toString()}`;
}

function controls(profile: ConformanceProfile, domains: readonly string[], live: boolean): string {
  const option = (value: ConformanceProfile) => `<option value="${value}"${value === profile ? ' selected' : ''}>${value}</option>`;
  return `<form class="controls" data-controls>
<label>Profile <select name="profile">${option('full')}${option('minimal')}</select></label>
<label>Domains <input name="domains" placeholder="all (comma separated)" value="${escapeHtml(domains.join(', '))}"></label>
<button type="submit">Run</button>
<a class="download" data-download hidden>Download JSON</a>
${live ? '<span class="live" title="Re-runs when the served bundle changes">live</span>' : ''}
</form>`;
}

/**
 * Mount the UI into `root` and start the first run.
 *
 * @param root - Element the UI owns.
 * @param options - How to run the catalog and whether to follow live re-runs.
 * @returns The UI state object (also exposed as `window.__kehtoConformanceUi`).
 * @example
 * ```ts
 * mountConformanceUi(document.getElementById('app')!, { run: runKehtoConformance });
 * ```
 */
export function mountConformanceUi(root: HTMLElement, options: ConformanceUiOptions): ConformanceUiState {
  const doc = root.ownerDocument;
  const state: ConformanceUiState = { runs: 0, running: false, last: null, error: null };
  (doc.defaultView as (Window & { __kehtoConformanceUi?: ConformanceUiState }) | null)!.__kehtoConformanceUi = state;
  if (!doc.querySelector('style[data-kehto-conformance-ui]')) {
    const style = doc.createElement('style');
    style.setAttribute('data-kehto-conformance-ui', '');
    style.textContent = UI_STYLES;
    doc.head.append(style);
  }
  const selection = selectionFromUrl(doc.location.search);
  root.innerHTML = `<header class="top"><h1>${escapeHtml(options.title ?? 'Kehto runtime conformance')}</h1>${controls(selection.profile, selection.domains, Boolean(options.eventsUrl))}</header>
<main data-report><p class="running">Running…</p></main>`;
  const report = root.querySelector('[data-report]') as HTMLElement;
  const form = root.querySelector('[data-controls]') as HTMLFormElement;
  const download = root.querySelector('[data-download]') as HTMLAnchorElement;

  const start = async (profile: ConformanceProfile, domains: string[]): Promise<void> => {
    if (state.running) return;
    state.running = true;
    report.innerHTML = '<p class="running">Running…</p>';
    try {
      const run = await options.run({ profile, domains });
      state.last = run;
      state.error = null;
      report.innerHTML = renderRun(run);
      download.hidden = false;
      download.download = `kehto-conformance-${profile}.json`;
      download.href = URL.createObjectURL(new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' }));
    } catch (error) {
      state.error = error instanceof Error ? error.message : String(error);
      report.innerHTML = `<section class="verdict verdict-fail"><h2>Harness error</h2><p>${escapeHtml(state.error)}</p></section>`;
    } finally {
      state.running = false;
      state.runs += 1;
    }
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const profile = data.get('profile') === 'minimal' ? 'minimal' : 'full';
    const domains = String(data.get('domains') ?? '').split(',').map((value) => value.trim()).filter(Boolean);
    doc.defaultView?.history.replaceState(null, '', selectionToSearch(profile, domains));
    void start(profile, domains);
  });

  if (options.eventsUrl && typeof EventSource === 'function') {
    // The server debounces bundle changes; a reload picks up the rebuilt code
    // and the deep link re-runs the same selection.
    new EventSource(options.eventsUrl).addEventListener('rerun', () => { doc.location.reload(); });
  }
  void start(selection.profile, selection.domains);
  return state;
}
