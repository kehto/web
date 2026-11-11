import type { PermissionPrincipal, PermissionRequirement } from './permission-types.js';

const DOMAIN = /^[a-z][a-z0-9-]*$/;
const OPERATION = /^[a-z][a-z0-9-]*\.[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MAX_RULES = 512;
const MAX_NAPPLETS = 256;
const MAX_SUBJECT_LENGTH = 4096;
const MAX_DOCUMENT_LENGTH = 512 * 1024;

/** What a host does with a request no stored decision covers. */
export type PermissionRuleAction = 'allow' | 'ask' | 'deny';

/** Rules for one napplet. An absent `default` falls through to the global rules. */
export interface PermissionRuleScope {
  readonly default?: PermissionRuleAction;
  /** Whole interfaces, keyed by domain (`link`). Covers interface access too. */
  readonly domains: Readonly<Record<string, PermissionRuleAction>>;
  /** Single operations, keyed by `domain.operation` (`link.open`). */
  readonly operations: Readonly<Record<string, PermissionRuleAction>>;
}

/** Host-owned default policy. Stored decisions always take precedence over it. */
export interface PermissionRules {
  readonly version: 1;
  readonly default: PermissionRuleAction;
  readonly domains: Readonly<Record<string, PermissionRuleAction>>;
  readonly operations: Readonly<Record<string, PermissionRuleAction>>;
  /** Per-napplet overrides, keyed by {@link permissionRuleSubject}. */
  readonly napplets: Readonly<Record<string, PermissionRuleScope>>;
}

/** Which rule to change. Neither `domain` nor `operation` targets the default. */
export interface PermissionRuleTarget {
  /** A {@link permissionRuleSubject}; omitted targets every napplet. */
  readonly napplet?: string;
  readonly domain?: string;
  readonly operation?: string;
}

/** Parsing failure is explicit so a host can fall back to its own defaults. */
export type PermissionRulesLoadResult =
  | { readonly ok: true; readonly rules: PermissionRules }
  | { readonly ok: false; readonly reason: 'invalid-rules' | 'unsupported-version' };

function isAction(value: unknown): value is PermissionRuleAction {
  return value === 'allow' || value === 'ask' || value === 'deny';
}

function actionMap(value: unknown, key: RegExp): Readonly<Record<string, PermissionRuleAction>> {
  if (value === undefined) return Object.freeze({});
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid permission rule map');
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > MAX_RULES) throw new RangeError('Permission rule limit exceeded');
  const result: Record<string, PermissionRuleAction> = {};
  for (const [name, action] of entries) {
    if (!key.test(name) || name.length > 256 || !isAction(action)) throw new TypeError('Invalid permission rule');
    result[name] = action;
  }
  return Object.freeze(result);
}

function scopeSnapshot(value: unknown): PermissionRuleScope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid napplet permission rules');
  const scope = value as { default?: unknown; domains?: unknown; operations?: unknown };
  if (scope.default !== undefined && !isAction(scope.default)) throw new TypeError('Invalid permission rule');
  return Object.freeze({
    ...(scope.default !== undefined ? { default: scope.default } : {}),
    domains: actionMap(scope.domains, DOMAIN),
    operations: actionMap(scope.operations, OPERATION),
  });
}

function subjectText(value: string): boolean {
  return value.length > 0 && value.length <= MAX_SUBJECT_LENGTH && !/[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Build validated, immutable rules. With no argument every request asks, which
 * is the behavior of a host that configures no rules at all.
 *
 * @param init - Partial rules; omitted parts are empty and the default is `ask`.
 * @returns A detached frozen rule set, or throws on a malformed rule.
 * @example
 * ```ts
 * const rules = createPermissionRules({ default: 'allow', operations: { 'link.open': 'ask' } });
 * ```
 */
export function createPermissionRules(init: Partial<Omit<PermissionRules, 'version'>> = {}): PermissionRules {
  if (init.default !== undefined && !isAction(init.default)) throw new TypeError('Invalid permission rule');
  const napplets: Record<string, PermissionRuleScope> = {};
  const entries = Object.entries(init.napplets ?? {});
  if (entries.length > MAX_NAPPLETS) throw new RangeError('Permission rule limit exceeded');
  for (const [subject, scope] of entries) {
    if (!subjectText(subject)) throw new TypeError('Invalid permission rule subject');
    const snapshot = scopeSnapshot(scope);
    const empty = snapshot.default === undefined && !Object.keys(snapshot.domains).length && !Object.keys(snapshot.operations).length;
    if (!empty) napplets[subject] = snapshot;
  }
  return Object.freeze({
    version: 1,
    default: init.default ?? 'ask',
    domains: actionMap(init.domains, DOMAIN),
    operations: actionMap(init.operations, OPERATION),
    napplets: Object.freeze(napplets),
  });
}

/**
 * Name the napplet a rule applies to. Unlike a grant, a rule follows a verified
 * napplet across artifact versions, so an update keeps the user's preferences.
 *
 * @param principal - Verified catalog identity or development target.
 * @returns The key used in `PermissionRules.napplets`.
 * @example
 * ```ts
 * permissionRuleSubject({ kind: 'development', target: 'http://localhost:5173', artifactHash });
 * // 'development:http://localhost:5173'
 * ```
 */
export function permissionRuleSubject(principal: PermissionPrincipal): string {
  return principal.kind === 'verified' ? principal.manifestKey : `development:${principal.target}`;
}

/**
 * Decide what the default rules say about one requirement. The most specific
 * rule wins: napplet operation, napplet domain, napplet default, then the same
 * three globally. Interface access has no operation, so it skips operation rules.
 *
 * @param rules - Host-owned default policy.
 * @param principal - Trusted identity of the requesting napplet.
 * @param requirement - One normalized requirement of the request.
 * @returns Whether to allow, ask or deny when no stored decision applies.
 * @example
 * ```ts
 * resolvePermissionRule(rules, principal, {
 *   category: 'resource', domain: 'link', operation: 'link.open',
 *   scope: { kind: 'exact', value: 'https://example.org/' },
 * }); // 'ask'
 * ```
 */
export function resolvePermissionRule(
  rules: PermissionRules, principal: PermissionPrincipal, requirement: PermissionRequirement,
): PermissionRuleAction {
  const operation = requirement.category === 'interface' ? undefined : requirement.operation;
  const napplet = rules.napplets[permissionRuleSubject(principal)];
  const pick = (scope: PermissionRuleScope | PermissionRules | undefined): PermissionRuleAction | undefined => {
    if (!scope) return undefined;
    const byOperation = operation !== undefined && Object.hasOwn(scope.operations, operation) ? scope.operations[operation] : undefined;
    const byDomain = Object.hasOwn(scope.domains, requirement.domain) ? scope.domains[requirement.domain] : undefined;
    return byOperation ?? byDomain ?? scope.default;
  };
  return pick(napplet) ?? pick(rules) ?? rules.default;
}

function withEntry(
  map: Readonly<Record<string, PermissionRuleAction>>, key: string, action: PermissionRuleAction | undefined,
): Record<string, PermissionRuleAction> {
  const next = { ...map };
  if (action === undefined) delete next[key];
  else next[key] = action;
  return next;
}

/**
 * Set or remove one rule, returning new rules. Removing the global default
 * resets it to `ask`; removing a napplet's last rule removes the napplet.
 *
 * @param rules - Existing rules, left untouched.
 * @param target - The napplet, domain or operation the rule applies to.
 * @param action - New action, or `undefined` to remove the rule.
 * @returns Detached validated rules, or throws on a malformed target.
 * @example
 * ```ts
 * rules = setPermissionRule(rules, { domain: 'fs' }, 'ask');
 * rules = setPermissionRule(rules, { napplet: subject, operation: 'link.open' }, 'allow');
 * ```
 */
export function setPermissionRule(
  rules: PermissionRules, target: PermissionRuleTarget, action: PermissionRuleAction | undefined,
): PermissionRules {
  if (target.domain !== undefined && target.operation !== undefined) throw new TypeError('A rule targets a domain or an operation, not both');
  const apply = <T extends PermissionRuleScope | PermissionRules>(scope: T): T => {
    if (target.operation !== undefined) return { ...scope, operations: withEntry(scope.operations, target.operation, action) };
    if (target.domain !== undefined) return { ...scope, domains: withEntry(scope.domains, target.domain, action) };
    const { default: _removed, ...rest } = scope;
    return (action === undefined ? rest : { ...rest, default: action }) as T;
  };
  if (target.napplet === undefined) return createPermissionRules(apply(rules));
  const current = rules.napplets[target.napplet] ?? { domains: {}, operations: {} };
  return createPermissionRules({ ...rules, napplets: { ...rules.napplets, [target.napplet]: apply(current) } });
}

/**
 * Serialize rules for durable host storage.
 *
 * @param rules - Validated rules.
 * @returns A versioned JSON document.
 * @example
 * ```ts
 * localStorage.setItem('rules', serializePermissionRules(rules));
 * ```
 */
export function serializePermissionRules(rules: PermissionRules): string {
  return JSON.stringify(createPermissionRules(rules));
}

/**
 * Parse stored rules, refusing the whole document if any rule is malformed so
 * a damaged store can never widen what is allowed.
 *
 * @param raw - Stored document, limited to 512 KiB.
 * @returns The rules, or an explicit failure for the host to replace with its defaults.
 * @example
 * ```ts
 * const loaded = deserializePermissionRules(raw);
 * const rules = loaded.ok ? loaded.rules : createPermissionRules();
 * ```
 */
export function deserializePermissionRules(raw: string): PermissionRulesLoadResult {
  try {
    if (raw.length > MAX_DOCUMENT_LENGTH) return { ok: false, reason: 'invalid-rules' };
    const parsed = JSON.parse(raw) as Partial<PermissionRules> | null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, reason: 'invalid-rules' };
    if (parsed.version !== 1) return { ok: false, reason: 'unsupported-version' };
    if (!isAction(parsed.default)) return { ok: false, reason: 'invalid-rules' };
    return { ok: true, rules: createPermissionRules(parsed) };
  } catch {
    return { ok: false, reason: 'invalid-rules' };
  }
}
