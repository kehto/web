import type { WorkerRelayInterface as SnortWorkerRelayInterface } from '@snort/worker-relay';
import type { NostrEvent, NostrFilter, WorkerRelayHooks, WorkerRelayLike } from '@kehto/shell';
import { filterEvents } from './playground-relay-selection.js';

export interface PlaygroundRelayCache {
  query(filters: readonly NostrFilter[]): Promise<NostrEvent[]>;
  store(event: NostrEvent): Promise<void>;
  isAvailable(): boolean;
}

export interface PlaygroundWorkerRelayBundle {
  cache: PlaygroundRelayCache;
  workerRelayHooks: WorkerRelayHooks;
}

export function createPlaygroundWorkerRelayBundle(): PlaygroundWorkerRelayBundle {
  const overlay = new Map<string, NostrEvent>();

  let workerRelay: SnortWorkerRelayInterface | null = null;
  let ready: Promise<SnortWorkerRelayInterface | null> | null = null;

  async function ensureWorkerRelay(): Promise<SnortWorkerRelayInterface | null> {
    if (workerRelay) return workerRelay;
    if (ready) return ready;
    if (typeof Worker === 'undefined') return null;

    ready = (async () => {
      try {
        const { WorkerRelayInterface } = await import('@snort/worker-relay');
        const worker = new WorkerRelayInterface(new URL('@snort/worker-relay/dist/esm/worker.mjs', import.meta.url));
        worker.timeout = 3_000;
        const ok = await worker.init({ databasePath: 'kehto-playground-relay-live.db' });
        if (!ok) return null;
        workerRelay = worker;
        return workerRelay;
      } catch {
        return null;
      }
    })();
    return ready;
  }

  async function query(filters: readonly NostrFilter[]): Promise<NostrEvent[]> {
    const overlayEvents = filterEvents([...overlay.values()], filters);
    const worker = await ensureWorkerRelay();
    if (!worker) return overlayEvents;

    try {
      const req = ['REQ', requestId(), ...filters] as Parameters<SnortWorkerRelayInterface['query']>[0];
      const workerEvents = await worker.query(req);
      return mergeEvents([...overlayEvents, ...workerEvents as NostrEvent[]], filters);
    } catch {
      return overlayEvents;
    }
  }

  async function store(event: NostrEvent): Promise<void> {
    overlay.set(event.id, event);
    const worker = await ensureWorkerRelay();
    if (!worker) return;
    try {
      await worker.event(event as Parameters<SnortWorkerRelayInterface['event']>[0]);
    } catch {
      return;
    }
  }

  const cache: PlaygroundRelayCache = {
    query,
    store,
    isAvailable: () => true,
  };

  return {
    cache,
    workerRelayHooks: {
      getWorkerRelay(): WorkerRelayLike | null {
        void ensureWorkerRelay();
        return workerRelay ? toWorkerRelayLike(workerRelay) : null;
      },
    },
  };
}

function toWorkerRelayLike(worker: SnortWorkerRelayInterface): WorkerRelayLike {
  return {
    event: (event) => worker.event(event as Parameters<SnortWorkerRelayInterface['event']>[0]),
    query: async (req) => worker.query(req) as Promise<NostrEvent[]>,
    count: (req) => worker.count(req),
  };
}

function mergeEvents(events: readonly NostrEvent[], filters: readonly NostrFilter[]): NostrEvent[] {
  const deduped = new Map<string, NostrEvent>();
  for (const event of events) deduped.set(event.id, event);
  return filterEvents([...deduped.values()], filters);
}

function requestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
