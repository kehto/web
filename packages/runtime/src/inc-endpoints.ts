import type { SessionRegistry } from './session-registry.js';
import type { RuntimeAdapter, SessionEntry } from './types.js';

/**
 * Runtime-assigned NAP-INC endpoint identifiers.
 *
 * NAP-INC (napplet/naps master `377bf939c6c906817084b43dd21d424de646dbc2`,
 * Schemas) makes `target`, `sender`, and `peer` opaque text that is unique to a
 * live endpoint, bound to its authenticated registration, and never reused for
 * another endpoint during the runtime session. The identifier is therefore
 * bound to the frozen `SessionEntry` object of one registration, not to a
 * manifest `d` tag, artifact hash, window ID, or host instance ID.
 */
export interface IncEndpoints {
  /** Return the live endpoint's identifier, assigning one on first use. */
  idFor(windowId: string): string | undefined;
  /** Return an identifier that was already assigned to the live endpoint. */
  assignedIdFor(windowId: string): string | undefined;
  /** Resolve an identifier to the window of its live endpoint. */
  resolve(endpointId: unknown): string | undefined;
  /** Forget a retired endpoint. Its identifier stays reserved. */
  retire(windowId: string): void;
  /** Report whether the text is the `d` tag of a live endpoint (diagnostics only). */
  isLiveDTag(target: unknown): boolean;
  /** Drop all bindings at the end of the runtime session. */
  clear(): void;
}

interface Binding {
  readonly id: string;
  readonly entry: SessionEntry;
}

/** Bounded retries for a host UUID source that returns an already-issued value. */
const MAX_MINT_ATTEMPTS = 4;

function mint(hooks: RuntimeAdapter, issued: Set<string>): string | undefined {
  for (let attempt = 0; attempt < MAX_MINT_ATTEMPTS; attempt += 1) {
    const raw: unknown = hooks.crypto.randomUUID();
    const id = typeof raw === 'string' ? raw.replace(/-/g, '').slice(0, 32) : '';
    if (id && !issued.has(id)) return id;
  }
  return undefined;
}

/**
 * Create the endpoint identifier table for one runtime.
 *
 * @param hooks - Runtime adapter; identifiers come from its injected `crypto.randomUUID`
 * @param sessionRegistry - Source of the authenticated registration for a window
 * @returns The identifier table
 *
 * @example
 * ```ts
 * const endpoints = createIncEndpoints(hooks, sessionRegistry);
 * const sender = endpoints.idFor('win-1');
 * ```
 */
export function createIncEndpoints(hooks: RuntimeAdapter, sessionRegistry: SessionRegistry): IncEndpoints {
  const byWindow = new Map<string, Binding>();
  const windowById = new Map<string, string>();
  // Every identifier issued in this runtime session. A retired identifier is
  // never handed to another endpoint, even if the host UUID source repeats.
  const issued = new Set<string>();

  function retire(windowId: string): void {
    const binding = byWindow.get(windowId);
    if (!binding) return;
    byWindow.delete(windowId);
    windowById.delete(binding.id);
  }

  function current(windowId: string): Binding | undefined {
    const binding = byWindow.get(windowId);
    if (!binding) return undefined;
    if (sessionRegistry.getEntryByWindowId(windowId) === binding.entry) return binding;
    retire(windowId);
    return undefined;
  }

  return {
    idFor(windowId: string): string | undefined {
      const existing = current(windowId);
      if (existing) return existing.id;
      const entry = sessionRegistry.getEntryByWindowId(windowId);
      if (!entry) return undefined;
      const id = mint(hooks, issued);
      // Fail closed: an endpoint without a unique identifier stays unaddressable.
      if (!id) return undefined;
      issued.add(id);
      byWindow.set(windowId, { id, entry });
      windowById.set(id, windowId);
      return id;
    },
    assignedIdFor(windowId: string): string | undefined {
      return current(windowId)?.id;
    },
    resolve(endpointId: unknown): string | undefined {
      if (typeof endpointId !== 'string' || !endpointId) return undefined;
      const windowId = windowById.get(endpointId);
      return windowId !== undefined && current(windowId) ? windowId : undefined;
    },
    retire,
    isLiveDTag(target: unknown): boolean {
      return typeof target === 'string' && target !== ''
        && sessionRegistry.getAllEntries().some((entry) => entry.dTag === target);
    },
    clear(): void {
      byWindow.clear();
      windowById.clear();
      issued.clear();
    },
  };
}
