import {
  createPermissionRules, deserializePermissionRules, resolvePermissionRule, serializePermissionRules,
} from '@kehto/firewall';
import type { PermissionRequest, PermissionRequirement, PermissionRules } from '@kehto/firewall';

/** Versioned durable store for Paja's default Firewall rules. */
export const PAJA_PERMISSION_RULES_STORAGE_KEY = 'kehto:paja:firewall-rules:v1';

/** Paja's default rules, read and replaced by the Firewall UI. */
export interface PajaPermissionRuleStore {
  /** Rules in force now. */
  get(): PermissionRules;
  /** Replace the rules. Throws, leaving them unchanged, when the browser refuses the write. */
  set(rules: PermissionRules): void;
  /** The rules Paja ships with. */
  defaults(): PermissionRules;
  /** What the rules say about the scopes a request still needs. */
  decide(request: PermissionRequest, missing: readonly PermissionRequirement[]): 'allow' | 'ask' | 'deny';
}

/**
 * Paja's shipped rules: a napplet may use every interface the host offers and
 * every operation on it, except that opening an external link always asks.
 * Signing, publishing and device choosers keep their own confirmations.
 *
 * @returns Fresh immutable default rules.
 * @example
 * ```ts
 * pajaDefaultPermissionRules().operations['link.open']; // 'ask'
 * ```
 */
export function pajaDefaultPermissionRules(): PermissionRules {
  return createPermissionRules({ default: 'allow', operations: { 'link.open': 'ask' } });
}

/**
 * Load Paja's default rules from browser storage and keep them there. A missing
 * or damaged document falls back to the shipped defaults; without storage the
 * rules last for the page.
 *
 * @param storage - Browser storage, or null when it cannot be opened.
 * @returns Rule store for the Firewall UI and the runtime permission adapter.
 * @example
 * ```ts
 * const rules = createPajaPermissionRuleStore(window.localStorage);
 * adapter.defaultDecision = rules.decide;
 * ```
 */
export function createPajaPermissionRuleStore(storage: Storage | null): PajaPermissionRuleStore {
  let rules = pajaDefaultPermissionRules();
  try {
    const raw = storage?.getItem(PAJA_PERMISSION_RULES_STORAGE_KEY);
    const loaded = raw ? deserializePermissionRules(raw) : undefined;
    if (loaded?.ok) rules = loaded.rules;
  } catch { /* Unreadable storage keeps the shipped defaults. */ }
  return {
    get: () => rules,
    set(next) {
      const validated = createPermissionRules(next);
      storage?.setItem(PAJA_PERMISSION_RULES_STORAGE_KEY, serializePermissionRules(validated));
      rules = validated;
    },
    defaults: pajaDefaultPermissionRules,
    decide(request, missing) {
      const actions = missing.map((requirement) => resolvePermissionRule(rules, request.principal, requirement));
      if (actions.includes('deny')) return 'deny';
      return actions.every((action) => action === 'allow') ? 'allow' : 'ask';
    },
  };
}
