/** Verified-manifest NAP-INTENT catalog resolution. */

import type { IntentResolver, IntentResolverContext } from './intent-service.js';
import type {
  IntentAvailability,
  IntentBehavior,
  IntentCandidate,
  IntentContract,
  IntentHandlerHint,
  IntentRequest,
  IntentResult,
} from './intent-types.js';

/** Exact contracts fulfilled by a catalog entry for one role. */
export interface IntentArchetypeSupport {
  readonly contracts: readonly IntentContract[];
}

/** A verified installed napplet, keyed by a runtime-assigned opaque catalog ID. */
export interface IntentCatalogEntry {
  readonly id: string;
  readonly title?: string;
  readonly archetypes: Readonly<Record<string, IntentArchetypeSupport>>;
}

/** Immutable delivery values retained by the target controller after acceptance. */
export interface IntentDispatchParams {
  readonly handler: string;
  readonly sender: string;
  readonly archetype: string;
  readonly action: string;
  readonly convention: string;
  readonly payload?: unknown;
  readonly behavior?: Readonly<IntentBehavior>;
}

/** Retained work observable by the host without a second source result. */
export interface IntentTargetAcceptance {
  readonly completion: Promise<void>;
}

/** Owns target lifecycle and retains delivery before returning to the source. */
export interface IntentTargetController {
  accept(params: IntentDispatchParams): IntentTargetAcceptance;
}

/** Catalog, user-policy, and lifecycle hooks for the reference resolver. */
export interface CatalogIntentResolverOptions {
  loadCatalog(): readonly IntentCatalogEntry[] | Promise<readonly IntentCatalogEntry[]>;
  targets: IntentTargetController;
  getDefaultHandler?(archetype: string): string | undefined;
  chooseHandler?(
    archetype: string,
    candidates: readonly IntentCandidate[],
    sender: string,
  ): string | undefined | Promise<string | undefined>;
  authorizeExplicitHandler?(
    sender: string,
    handler: string,
    request: IntentRequest,
    candidate: IntentCandidate,
  ): boolean | Promise<boolean>;
  /** Resolve a valid recommendation only to an already compatible verified entry. */
  resolveHandlerHint?(
    hint: IntentHandlerHint,
    candidates: readonly IntentCandidate[],
  ): string | undefined | Promise<string | undefined>;
}

export interface CatalogIntentResolver extends IntentResolver {
  notifyChanged(archetype: string): void;
}

const CONVENTION = /^napplet:([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*)$/;

function rejected(error: string): IntentResult {
  return { ok: false, error };
}

function candidateFor(entry: IntentCatalogEntry, archetype: string, defaultId?: string): IntentCandidate | undefined {
  const support = entry.archetypes[archetype];
  if (!support || support.contracts.length === 0) return undefined;
  const contracts = support.contracts.map((contract) => Object.freeze({
    convention: contract.convention,
    params: Object.freeze([...contract.params]),
  }));
  const conventions = [...new Set(contracts.map((contract) => contract.convention))];
  const actions = [...new Set(conventions.map((convention) => CONVENTION.exec(convention)?.[2]).filter((value): value is string => value !== undefined))];
  if (actions.length === 0) return undefined;
  return Object.freeze({
    id: entry.id,
    ...(entry.title === undefined ? {} : { title: entry.title }),
    actions: Object.freeze(actions),
    conventions: Object.freeze(conventions),
    contracts: Object.freeze(contracts),
    ...(entry.id === defaultId ? { isDefault: true } : {}),
  });
}

function candidatesFor(catalog: readonly IntentCatalogEntry[], archetype: string, defaultId?: string): IntentCandidate[] {
  return catalog.map((entry) => candidateFor(entry, archetype, defaultId)).filter((candidate): candidate is IntentCandidate => candidate !== undefined);
}

function compatibleFor(request: IntentRequest, candidates: readonly IntentCandidate[]): IntentCandidate[] {
  return candidates.filter((candidate) => candidate.contracts.some((contract) => contract.convention === request.convention));
}

async function choose(options: CatalogIntentResolverOptions, request: IntentRequest, candidates: readonly IntentCandidate[], sender: string): Promise<IntentCandidate | IntentResult> {
  if (!options.chooseHandler) return rejected(request.handler === 'choose' ? 'user cancelled' : 'invoke rejected');
  const id = await options.chooseHandler(request.archetype, candidates, sender);
  if (id === undefined) return rejected('user cancelled');
  return candidates.find((candidate) => candidate.id === id) ?? rejected('invoke rejected');
}

async function select(options: CatalogIntentResolverOptions, request: IntentRequest, candidates: readonly IntentCandidate[], sender: string): Promise<IntentCandidate | IntentResult> {
  if (request.handler && request.handler !== 'default' && request.handler !== 'choose') {
    const candidate = candidates.find((item) => item.id === request.handler);
    if (!candidate || !options.authorizeExplicitHandler) return rejected('invoke rejected');
    try {
      return await options.authorizeExplicitHandler(sender, request.handler, request, candidate)
        ? candidate : rejected('invoke rejected');
    } catch { return rejected('invoke rejected'); }
  }
  if (request.handler === 'choose') return choose(options, request, candidates, sender);
  const defaultCandidate = candidates.find((candidate) => candidate.isDefault);
  if (defaultCandidate) return defaultCandidate;
  if (request.handlerHint && options.resolveHandlerHint) {
    try {
      const id = await options.resolveHandlerHint(request.handlerHint, candidates);
      const candidate = candidates.find((item) => item.id === id);
      if (candidate) return candidate;
    } catch { /* recommendation failure falls through to compatible policy */ }
  }
  if (candidates.length === 1) return candidates[0];
  return choose(options, request, candidates, sender);
}

async function availabilityFor(options: CatalogIntentResolverOptions, archetype: string): Promise<IntentAvailability> {
  const catalog = await options.loadCatalog();
  const defaultId = options.getDefaultHandler?.(archetype);
  const candidates = candidatesFor(catalog, archetype, defaultId);
  return Object.freeze({
    archetype,
    available: candidates.length > 0,
    candidates: Object.freeze(candidates),
    hasDefault: candidates.some((candidate) => candidate.isDefault),
  });
}

async function invoke(options: CatalogIntentResolverOptions, request: IntentRequest, context: IntentResolverContext): Promise<IntentResult> {
  const match = CONVENTION.exec(request.convention);
  if (!match || match[1] !== request.archetype || match[2] !== request.action) return rejected('invalid convention');
  if (!context.sender) return rejected('invoke rejected');
  const catalog = await options.loadCatalog();
  const candidates = candidatesFor(catalog, request.archetype, options.getDefaultHandler?.(request.archetype));
  if (candidates.length === 0) return rejected('no handler');
  const compatible = compatibleFor(request, candidates);
  if (compatible.length === 0) return rejected(candidates.some((candidate) => candidate.actions.includes(request.action)) ? 'unsupported convention' : 'unsupported action');
  const selected = await select(options, request, compatible, context.sender);
  if ('ok' in selected) return selected;
  const behavior = request.behavior === undefined ? undefined : Object.freeze({
    ...(request.behavior.focus === undefined ? {} : { focus: request.behavior.focus }),
    ...(request.behavior.reuse === undefined ? {} : { reuse: request.behavior.reuse }),
  });
  const params = Object.freeze({
    handler: selected.id,
    sender: context.sender,
    archetype: request.archetype,
    action: request.action,
    convention: request.convention,
    ...(request.payload === undefined ? {} : { payload: request.payload }),
    ...(behavior === undefined ? {} : { behavior }),
  }) satisfies IntentDispatchParams;
  try {
    const accepted = options.targets.accept(params);
    if (!accepted || !(accepted.completion instanceof Promise)) return rejected('invoke rejected');
    // Completion is host-visible and never produces another source result.
    void accepted.completion.catch(() => {});
  } catch { return rejected('invoke rejected'); }
  return { ok: true, archetype: request.archetype, action: request.action, convention: request.convention, handler: selected.id };
}

/**
 * Create a catalog-backed resolver from verified manifest contracts.
 *
 * @param options - Verified catalog, selection policy, and target lifecycle hooks.
 * @returns A resolver suitable for {@link createIntentService}.
 *
 * @example
 * ```ts
 * const resolver = createCatalogIntentResolver({
 *   loadCatalog: () => installedCatalog,
 *   targets: { accept: (params) => ({ completion: deliverToTarget(params) }) },
 * });
 * ```
 */
export function createCatalogIntentResolver(options: CatalogIntentResolverOptions): CatalogIntentResolver {
  if (!options || typeof options.loadCatalog !== 'function') throw new Error('createCatalogIntentResolver: options.loadCatalog is required');
  if (!options.targets || typeof options.targets.accept !== 'function') throw new Error('createCatalogIntentResolver: options.targets is required');
  const listeners = new Set<(availability: IntentAvailability) => void>();
  return {
    invoke: (request, context) => invoke(options, request, context),
    available: (archetype) => availabilityFor(options, archetype),
    async handlers() {
      const catalog = await options.loadCatalog();
      const roles = new Set<string>();
      for (const entry of catalog) for (const role of Object.keys(entry.archetypes)) roles.add(role);
      return Promise.all([...roles].map((role) => availabilityFor(options, role)));
    },
    onChanged(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    notifyChanged(archetype) {
      void availabilityFor(options, archetype).then((availability) => {
        for (const listener of listeners) listener(availability);
      });
    },
  };
}
