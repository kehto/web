/**
 * catalog-intent-resolver.ts — NAP-INTENT concrete {@link IntentResolver}.
 *
 * A reference resolver backed by installed, verified NIP-5A manifest
 * archetype/convention tags plus host-supplied user policy. Catalog order and
 * payload contents never select a handler.
 *
 * Selection policy:
 *   1. Filter installed candidates by declared action and convention support.
 *   2. Require positive host authorization for an explicit handler dTag.
 *   3. Otherwise use an explicit chooser, a compatible user default, the sole
 *      compatible candidate, or an injected chooser.
 *   4. Reject ambiguity when no chooser policy exists.
 *
 * The catalog, defaults, chooser, authorization hook, and target controller are
 * injected, so this resolver has no shell, manifest, or DOM dependency.
 *
 * @packageDocumentation
 */

import type {
  IntentAvailability,
  IntentBehavior,
  IntentCandidate,
  IntentRequest,
  IntentResult,
} from '@napplet/core';
import type {
  IntentResolver,
  IntentResolverContext,
} from './intent-service.js';

/** The exact manifest-derived conventions a napplet fulfills for one archetype. */
export interface IntentArchetypeSupport {
  /** Verbs derived from this napplet's accepted conventions. */
  actions: string[];
  /** Stable queryless convention identities declared by the manifest. */
  conventions: string[];
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
  /** Archetype slug to exact manifest-derived support. */
  archetypes: Record<string, IntentArchetypeSupport>;
}

/** Exact values dispatched to one selected intent target. */
export interface IntentDispatchParams {
  /** Selected target napplet dTag. */
  readonly handler: string;
  /** Runtime-attested source napplet dTag. */
  readonly sender: string;
  /** Requested target archetype. */
  readonly archetype: string;
  /** Requested action. */
  readonly action: string;
  /** Selected stable convention used to deliver the payload. */
  readonly convention: string;
  /** Opaque convention payload. */
  readonly payload?: unknown;
  /** Copied target lifecycle hints. */
  readonly behavior?: Readonly<IntentBehavior>;
}

/** Result returned by a host after creating/focusing and dispatching to a target. */
export interface IntentTargetDispatch {
  /** Shell-assigned target window identifier. */
  readonly windowId: string;
}

/** Host controller that owns target lifecycle and convention delivery policy. */
export interface IntentTargetController {
  /**
   * Create or focus the selected target, wait until it can receive the
   * convention, then enqueue delivery through the host's ordinary carrier.
   *
   * @param params - Immutable selected target and dispatch values.
   * @returns The created/focused target identity.
   */
  dispatch(
    params: IntentDispatchParams,
  ): IntentTargetDispatch | Promise<IntentTargetDispatch>;
}

/** Options for {@link createCatalogIntentResolver}. */
export interface CatalogIntentResolverOptions {
  /** Return the installed-napplet catalog sourced from signed manifests. */
  loadCatalog(): IntentCatalogEntry[] | Promise<IntentCatalogEntry[]>;
  /** Target controller that creates/readies the selected target and dispatches its convention. */
  targets: IntentTargetController;
  /**
   * Return the user's default handler dTag for an archetype.
   *
   * @param archetype - Normalized archetype slug.
   * @returns The user-selected default dTag, or `undefined`.
   */
  getDefaultHandler?(archetype: string): string | undefined;
  /**
   * Ask user policy to select one exact-compatible candidate.
   *
   * @param archetype - Normalized archetype slug.
   * @param candidates - Only candidates with an exact matching contract.
   * @param sender - Runtime-attested source napplet dTag.
   * @returns A candidate dTag, or `undefined` when the user cancels.
   */
  chooseHandler?(
    archetype: string,
    candidates: IntentCandidate[],
    sender: string,
  ): string | undefined | Promise<string | undefined>;
  /**
   * Authorize a caller's explicit handler dTag preference.
   *
   * @param sender - Runtime-attested source napplet dTag.
   * @param handler - Explicit requested handler dTag.
   * @param request - Normalized intent request.
   * @param candidate - Installed exact-compatible candidate.
   * @returns `true` only when explicit targeting is user-authorized.
   */
  authorizeExplicitHandler?(
    sender: string,
    handler: string,
    request: IntentRequest,
    candidate: IntentCandidate,
  ): boolean | Promise<boolean>;
}

/**
 * A {@link IntentResolver} backed by a catalog, with a host hook to announce
 * catalog/default changes.
 */
export interface CatalogIntentResolver extends IntentResolver {
  /**
   * Announce that the catalog or default handler for `archetype` changed.
   *
   * @param archetype - Changed archetype slug.
   * @returns Nothing.
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
      actions: [...support.actions],
      conventions: [...support.conventions],
      ...(entry.dTag === defaultHandler ? { isDefault: true } : {}),
    });
  }
  return candidates;
}

function reject(request: IntentRequest, error: string): IntentResult {
  return {
    ok: false,
    archetype: request.archetype,
    action: request.action ?? 'open',
    handled: false,
    error,
  };
}

type HandlerSelection =
  | { candidate: IntentCandidate }
  | { error: 'invoke rejected' | 'user cancelled' };

async function availabilityForCatalog(
  options: CatalogIntentResolverOptions,
  archetype: string,
): Promise<IntentAvailability> {
  const catalog = await options.loadCatalog();
  const defaultHandler = options.getDefaultHandler?.(archetype);
  const candidates = candidatesFor(catalog, archetype, defaultHandler);
  return {
    archetype,
    available: candidates.length > 0,
    candidates,
    hasDefault: defaultHandler !== undefined
      && candidates.some((candidate) => candidate.dTag === defaultHandler),
  };
}

async function chooseCompatible(
  options: CatalogIntentResolverOptions,
  request: IntentRequest,
  candidates: IntentCandidate[],
  sender: string,
): Promise<HandlerSelection> {
  if (!options.chooseHandler) {
    return request.handler === 'choose'
      ? { error: 'user cancelled' }
      : { error: 'invoke rejected' };
  }
  const picked = await options.chooseHandler(request.archetype, candidates, sender);
  if (picked === undefined) return { error: 'user cancelled' };
  const candidate = candidates.find((item) => item.dTag === picked);
  return candidate ? { candidate } : { error: 'invoke rejected' };
}

async function pickHandler(
  options: CatalogIntentResolverOptions,
  request: IntentRequest,
  compatible: IntentCandidate[],
  sender: string,
): Promise<HandlerSelection> {
  const preference = request.handler;
  if (typeof preference === 'string' && preference !== 'default' && preference !== 'choose') {
    const candidate = compatible.find((item) => item.dTag === preference);
    if (!candidate || !options.authorizeExplicitHandler) return { error: 'invoke rejected' };
    let authorized = false;
    try {
      authorized = await options.authorizeExplicitHandler(
        sender,
        preference,
        request,
        candidate,
      );
    } catch {
      return { error: 'invoke rejected' };
    }
    return authorized ? { candidate } : { error: 'invoke rejected' };
  }

  if (preference === 'choose') {
    return chooseCompatible(options, request, compatible, sender);
  }

  const defaultCandidate = compatible.find((candidate) => candidate.isDefault === true);
  if (preference === 'default') {
    return defaultCandidate ? { candidate: defaultCandidate } : { error: 'invoke rejected' };
  }
  if (defaultCandidate) return { candidate: defaultCandidate };
  if (compatible.length === 1) return { candidate: compatible[0] };
  return chooseCompatible(options, request, compatible, sender);
}

async function invokeFromCatalog(
  options: CatalogIntentResolverOptions,
  request: IntentRequest,
  context: IntentResolverContext,
): Promise<IntentResult> {
  const catalog = await options.loadCatalog();
  const defaultHandler = options.getDefaultHandler?.(request.archetype);
  const candidates = candidatesFor(catalog, request.archetype, defaultHandler);
  if (candidates.length === 0) return reject(request, 'no handler');

  const action = request.action ?? 'open';
  const actionCompatible = candidates.filter((candidate) =>
    candidate.actions.includes(action));
  if (actionCompatible.length === 0) return reject(request, 'unsupported action');
  const compatible = request.convention === undefined
    ? actionCompatible
    : actionCompatible.filter((candidate) =>
        candidate.conventions.includes(request.convention as string));
  if (compatible.length === 0) return reject(request, 'unsupported convention');

  const sender = context.sender;
  if (typeof sender !== 'string' || sender.length === 0) {
    return reject(request, 'invoke rejected');
  }
  const selected = await pickHandler(options, request, compatible, sender);
  if ('error' in selected) return reject(request, selected.error);

  const convention = request.convention
    ?? selected.candidate.conventions.find((value) => {
      const match = /^napplet:[^/?#\s]+\/([^/?#\s]+)$/.exec(value);
      return match?.[1] === action;
    });
  if (!convention) return reject(request, 'unsupported convention');
  const behavior = request.behavior === undefined
    ? undefined
    : Object.freeze({
        ...(request.behavior.focus === undefined ? {} : { focus: request.behavior.focus }),
        ...(request.behavior.newWindow === undefined
          ? {}
          : { newWindow: request.behavior.newWindow }),
        ...(request.behavior.reuse === undefined ? {} : { reuse: request.behavior.reuse }),
      });
  const params = Object.freeze({
    handler: selected.candidate.dTag,
    sender,
    archetype: request.archetype,
    action,
    convention,
    ...(request.payload === undefined ? {} : { payload: request.payload }),
    ...(behavior === undefined ? {} : { behavior }),
  }) satisfies IntentDispatchParams;

  let target: IntentTargetDispatch;
  try {
    target = await options.targets.dispatch(params);
  } catch {
    return reject(request, 'invoke failed');
  }
  if (!target || typeof target.windowId !== 'string' || target.windowId.length === 0) {
    return reject(request, 'invoke failed');
  }

  return {
    ok: true,
    archetype: request.archetype,
    action,
    handled: true,
    handler: selected.candidate.dTag,
    windowId: target.windowId,
    convention,
  };
}

/**
 * Create a catalog-backed NAP-INTENT resolver.
 *
 * @param options - Catalog loader and target controller plus optional user
 *   default, chooser, and explicit-handler authorization hooks.
 * @returns A catalog-backed resolver.
 * @throws If required catalog or target-controller options are missing.
 *
 * @example
 * ```ts
 * const resolver = createCatalogIntentResolver({
 *   loadCatalog: () => installedNapplets,
 *   targets: { dispatch: (params) => openAndDispatch(params) },
 *   getDefaultHandler: (archetype) => userDefaults[archetype],
 * });
 * ```
 */
export function createCatalogIntentResolver(options: CatalogIntentResolverOptions): CatalogIntentResolver {
  if (!options || typeof options.loadCatalog !== 'function') {
    throw new Error('createCatalogIntentResolver: options.loadCatalog is required');
  }
  if (!options.targets || typeof options.targets.dispatch !== 'function') {
    throw new Error('createCatalogIntentResolver: options.targets is required');
  }
  const listeners = new Set<(availability: IntentAvailability) => void>();
  const availabilityFor = (archetype: string): Promise<IntentAvailability> =>
    availabilityForCatalog(options, archetype);

  async function handlers(): Promise<IntentAvailability[]> {
    const catalog = await options.loadCatalog();
    const archetypes = new Set<string>();
    for (const entry of catalog) {
      for (const slug of Object.keys(entry.archetypes)) archetypes.add(slug);
    }
    return Promise.all([...archetypes].map((archetype) => availabilityFor(archetype)));
  }

  return {
    invoke: (request, context) => invokeFromCatalog(options, request, context),
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
