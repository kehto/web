/**
 * catalog-intent-resolver.ts — NAP-INTENT concrete {@link IntentResolver}.
 *
 * A reference resolver that satisfies {@link IntentResolver} from an
 * installed-napplet catalog plus host-supplied policy: the user's
 * default-handler preference, an optional "open with…" chooser, the archetype's
 * recommended default protocol, and a window controller that creates or focuses
 * the handler window and delivers the payload.
 *
 * Resolution policy (mirrors an OS implicit-intent + default-app model):
 *   1. Gather candidates for the archetype from the catalog.
 *   2. Pick the handler — an explicit `handler` dTag, a user choice
 *      (`handler: "choose"`), the user's default, the sole candidate, or a
 *      deterministic first-candidate fallback.
 *   3. Validate the resolved handler supports the requested `action` and
 *      `protocol` (or fall back to the archetype's recommended default protocol,
 *      then the candidate's first accepted protocol).
 *   4. Open or focus the handler window and return its id.
 *
 * The catalog, defaults, chooser, and window controller are all injected, so
 * this resolver carries no shell, manifest, or DOM dependency and is fully
 * unit-testable.
 *
 * @packageDocumentation
 */

import type {
  IntentAvailability,
  IntentBehavior,
  IntentCandidate,
  IntentRequest,
  IntentResult,
  IntentContract,
} from './intent-types.js';
import type { IntentResolver, IntentResolverContext } from './intent-service.js';

/** The actions/protocols a napplet fulfills for a single archetype. */
export interface IntentArchetypeSupport {
  /** Verbs this napplet supports for the archetype (e.g. `["open", "edit"]`). */
  actions: string[];
  /** NAP-N protocol ids this napplet accepts for the archetype. */
  protocols: string[];
  /** Stable queryless convention contracts from the manifest. */
  conventions?: string[];
  contracts?: IntentContract[];
}

/**
 * One installed napplet's intent surface, derived from its signed NIP-5A
 * manifest. Keyed by archetype slug so a single napplet can fulfill several
 * roles.
 */
export interface IntentCatalogEntry {
  /** The napplet's dTag. */
  dTag: string;
  /** Human-readable title from the manifest. */
  title?: string;
  /** Archetype slug → the actions/protocols this napplet fulfills for it. */
  archetypes: Record<string, IntentArchetypeSupport>;
}

/** Parameters handed to {@link IntentWindowController.open}. */
export interface IntentOpenParams {
  /** dTag of the resolved handler napplet. */
  dTag: string;
  /** The archetype being dispatched. */
  archetype: string;
  /** The resolved action (e.g. `"open"`). */
  action: string;
  /** The wire format the payload is delivered with, when one was resolved. */
  protocol?: string;
  /** The opaque payload to deliver. */
  payload?: unknown;
  /** Window-behavior hints from the request. */
  behavior?: IntentBehavior;
  /** Window id of the napplet that issued the intent. */
  callerWindowId: string;
}

/** Creates or focuses the handler window and delivers the intent payload. */
export interface IntentWindowController {
  /**
   * Create or focus the handler window and deliver `payload` via `protocol`.
   * Returns the window id the handler was created or focused in.
   */
  open(params: IntentOpenParams): { windowId: string } | Promise<{ windowId: string }>;
}

/** Options for {@link createCatalogIntentResolver}. */
export interface CatalogIntentResolverOptions {
  /** Return the installed-napplet catalog (signed NIP-5A manifests). Required. */
  loadCatalog(): IntentCatalogEntry[] | Promise<IntentCatalogEntry[]>;
  /** Window controller used to create/focus the resolved handler's window. Required. */
  windows: IntentWindowController;
  /**
   * The user's default handler dTag for an archetype, or `undefined` when none
   * is set. Default-handler settings are user state — never set by napplets.
   */
  getDefaultHandler?(archetype: string): string | undefined;
  /**
   * Resolve a `handler: "choose"` prompt (or a no-default ambiguity) to a dTag.
   * Returning `undefined` means the user cancelled. When omitted, ambiguous
   * resolution falls back to the first candidate.
   */
  chooseHandler?(
    archetype: string,
    candidates: IntentCandidate[],
    callerWindowId: string,
  ): string | undefined | Promise<string | undefined>;
  /** The archetype's recommended default protocol when the caller omits one. */
  defaultProtocol?(archetype: string): string | undefined;
}

/**
 * A {@link IntentResolver} backed by a catalog, with a host hook to announce
 * catalog/default changes.
 */
export interface CatalogIntentResolver extends IntentResolver {
  /**
   * Announce that the catalog or default handler for `archetype` changed. The
   * resolver recomputes availability and notifies `onChanged` listeners, which
   * the intent service forwards to napplets as `intent.changed` pushes.
   */
  notifyChanged(archetype: string): void;
}

/** Build the candidate list for an archetype, marking the user's default. */
function candidatesFor(
  catalog: IntentCatalogEntry[],
  archetype: string,
  defaultHandler: string | undefined,
): IntentCandidate[] {
  const candidates: IntentCandidate[] = [];
  for (const entry of catalog) {
    const support = entry.archetypes[archetype];
    if (!support) continue;
    candidates.push({
      dTag: entry.dTag,
      ...(entry.title === undefined ? {} : { title: entry.title }),
      actions: support.actions,
      protocols: support.protocols,
      conventions: support.conventions ?? [],
      contracts: support.contracts ?? [],
      ...(entry.dTag === defaultHandler ? { isDefault: true } : {}),
    });
  }
  return candidates;
}

function fail(archetype: string, action: string, error: string): IntentResult {
  return { ok: false, archetype, action, handled: false, error };
}

/**
 * Create a catalog-backed NAP-INTENT resolver.
 *
 * @param options - Catalog loader and window controller (required) plus
 *   optional default-handler, chooser, and default-protocol policy hooks.
 * @returns A {@link CatalogIntentResolver} for `createIntentService({ resolver })`.
 * @throws If `options.loadCatalog` or `options.windows` is missing.
 *
 * @example
 * ```ts
 * const resolver = createCatalogIntentResolver({
 *   loadCatalog: () => installedNapplets,
 *   windows: { open: ({ dTag }) => ({ windowId: openWindow(dTag) }) },
 *   getDefaultHandler: (a) => userDefaults[a],
 * });
 * ```
 */
export function createCatalogIntentResolver(options: CatalogIntentResolverOptions): CatalogIntentResolver {
  if (!options || typeof options.loadCatalog !== 'function') {
    throw new Error('createCatalogIntentResolver: options.loadCatalog is required');
  }
  if (!options.windows || typeof options.windows.open !== 'function') {
    throw new Error('createCatalogIntentResolver: options.windows is required');
  }
  const { loadCatalog, windows, getDefaultHandler, chooseHandler, defaultProtocol } = options;
  const listeners = new Set<(availability: IntentAvailability) => void>();

  async function availabilityFor(archetype: string): Promise<IntentAvailability> {
    const catalog = await loadCatalog();
    const def = getDefaultHandler?.(archetype);
    const candidates = candidatesFor(catalog, archetype, def);
    return {
      archetype,
      available: candidates.length > 0,
      candidates,
      hasDefault: def !== undefined && candidates.some((c) => c.dTag === def),
    };
  }

  /** Decide which candidate dTag should handle the request, or null to cancel. */
  async function pickHandler(
    archetype: string,
    candidates: IntentCandidate[],
    preference: IntentRequest['handler'],
    callerWindowId: string,
  ): Promise<string | null> {
    // Explicit dTag target (anything that isn't the two reserved keywords).
    if (typeof preference === 'string' && preference !== 'default' && preference !== 'choose') {
      return preference;
    }
    if (preference === 'choose') {
      const picked = await chooseHandler?.(archetype, candidates, callerWindowId);
      return picked ?? null;
    }
    // Default path: user's default, then the sole candidate, then chooser, then
    // a deterministic first-candidate fallback.
    const def = getDefaultHandler?.(archetype);
    if (def !== undefined && candidates.some((c) => c.dTag === def)) return def;
    if (candidates.length === 1) return candidates[0].dTag;
    if (chooseHandler) {
      const picked = await chooseHandler(archetype, candidates, callerWindowId);
      return picked ?? null;
    }
    return candidates[0].dTag;
  }

  async function invoke(request: IntentRequest, context: IntentResolverContext): Promise<IntentResult> {
    const archetype = request.archetype;
    const action = request.action ?? 'open';
    const catalog = await loadCatalog();
    const candidates = candidatesFor(catalog, archetype, getDefaultHandler?.(archetype));
    if (candidates.length === 0) return fail(archetype, action, 'no handler');

    const pickedDTag = await pickHandler(archetype, candidates, request.handler, context.windowId);
    if (pickedDTag === null) return fail(archetype, action, 'user cancelled');

    const handler = candidates.find((c) => c.dTag === pickedDTag);
    if (!handler) return fail(archetype, action, 'no handler');

    if (!handler.actions.includes(action)) return fail(archetype, action, 'unsupported action');

    const protocol = request.protocol ?? defaultProtocol?.(archetype) ?? handler.protocols[0];
    if (protocol !== undefined && handler.protocols.length > 0 && !handler.protocols.includes(protocol)) {
      return fail(archetype, action, 'unsupported protocol');
    }

    let windowId: string;
    try {
      const opened = await windows.open({
        dTag: handler.dTag,
        archetype,
        action,
        ...(protocol === undefined ? {} : { protocol }),
        ...(request.payload === undefined ? {} : { payload: request.payload }),
        ...(request.behavior === undefined ? {} : { behavior: request.behavior }),
        callerWindowId: context.windowId,
      });
      windowId = opened.windowId;
    } catch {
      return fail(archetype, action, 'invoke failed');
    }

    return {
      ok: true,
      archetype,
      action,
      handled: true,
      handler: handler.dTag,
      windowId,
      ...(protocol === undefined ? {} : { protocol }),
    };
  }

  async function handlers(): Promise<IntentAvailability[]> {
    const catalog = await loadCatalog();
    const archetypes = new Set<string>();
    for (const entry of catalog) {
      for (const slug of Object.keys(entry.archetypes)) archetypes.add(slug);
    }
    return Promise.all([...archetypes].map((a) => availabilityFor(a)));
  }

  return {
    invoke,
    available: availabilityFor,
    handlers,
    onChanged(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    notifyChanged(archetype) {
      if (listeners.size === 0) return;
      void availabilityFor(archetype).then((availability) => {
        for (const listener of listeners) listener(availability);
      });
    },
  };
}
