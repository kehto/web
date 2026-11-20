/**
 * cli/live.ts — `kehto conformance --ui`: serve the web UI, follow rebuilds.
 *
 * The server watches the served browser bundle. A change (for example a
 * fixture edit rebuilt by `--exec "pnpm build --watch"`) is debounced and
 * announced once on `/events` as a `rerun` server-sent event; the page then
 * reloads and runs its deep-linked selection again.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { watch } from 'node:fs';
import { startHarnessServer, type EventClient, type HarnessServer } from './server.js';

/** Options for {@link startLiveUi}. */
export interface LiveUiOptions {
  readonly bundle: URL;
  readonly port?: number;
  /** Shell command to run alongside, e.g. a watch build. */
  readonly exec?: string;
  /** Open the UI in the default browser. Default `true`. */
  readonly open?: boolean;
  /** Quiet period before a change triggers a re-run. Default 300 ms. */
  readonly debounceMs?: number;
  readonly log?: (line: string) => void;
}

/** A running live UI. */
export interface LiveUi {
  readonly url: string;
  /** `rerun` events sent so far. */
  reruns(): number;
  close(): Promise<void>;
}

function openBrowser(url: string): void {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try { spawn(command, args, { stdio: 'ignore', detached: true }).unref(); } catch { /* The URL is printed; opening is a convenience. */ }
}

/**
 * Start the live UI server.
 *
 * @param options - Bundle, port, companion command and browser opening.
 * @returns The running UI.
 * @example
 * ```ts
 * const ui = await startLiveUi({ bundle, exec: 'pnpm build --watch', open: false });
 * ```
 */
export async function startLiveUi(options: LiveUiOptions): Promise<LiveUi> {
  const log = options.log ?? (() => undefined);
  const clients = new Set<EventClient>();
  let reruns = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const server: HarnessServer = await startHarnessServer(options.bundle, options.port ?? 0, {
    ui: true,
    events(client) {
      clients.add(client);
      return () => { clients.delete(client); };
    },
  });
  const announce = (): void => {
    reruns += 1;
    log(`bundle changed; re-run ${reruns}`);
    for (const client of clients) client.write('event: rerun\ndata: {}\n\n');
  };
  const watcher = watch(options.bundle, () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; announce(); }, options.debounceMs ?? 300);
  });
  let child: ChildProcess | null = null;
  if (options.exec) {
    child = spawn(options.exec, { shell: true, stdio: 'inherit' });
    log(`running: ${options.exec}`);
  }
  if (options.open !== false) openBrowser(server.url);
  return {
    url: server.url,
    reruns: () => reruns,
    async close() {
      if (timer) clearTimeout(timer);
      watcher.close();
      child?.kill();
      for (const client of clients) client.end?.();
      await server.close();
    },
  };
}
