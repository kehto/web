/**
 * @kehto/firewall — Pure config mutation functions and serialization.
 *
 * Every mutation function takes a FirewallConfig and returns a NEW FirewallConfig.
 * The original config is never modified. No side effects, no I/O.
 *
 * Mirrors the role of @kehto/acl's mutations.ts: immutable spread-return mutations
 * (grant/revoke pattern), plain JSON.stringify serialize, and defensive deserialize
 * with shape validation and defaultConfig() fallback (V5 input validation — T-80-01).
 */

import type {
  FirewallConfig,
  NappletRules,
  RateLimit,
  ContentMatcher,
  NappletPolicy,
  Action,
} from './types.js';
import { defaultConfig } from './defaults.js';

/**
 * Return the existing NappletRules for `napplet`, or a fresh empty entry.
 * Internal helper — not exported. Mirrors acl's `getEntry` (mutations.ts:33-42).
 */
function getNapplet(config: FirewallConfig, napplet: string): NappletRules {
  const existing = config.napplets[napplet];
  if (existing) return existing;
  return { rateLimits: {} };
}

/**
 * Set the hard policy posture for a specific napplet (dTag).
 *
 * Returns a new FirewallConfig with `napplets[napplet].policy` set to `policy`.
 * If the napplet has no existing entry, a fresh entry is created.
 * The original config is never modified.
 *
 * @param config  - Current firewall config
 * @param napplet - Napplet dTag to configure
 * @param policy  - Policy posture ('allow' | 'deny' | 'ask')
 * @returns New FirewallConfig with the policy set
 *
 * @example
 * ```ts
 * const cfg2 = setPolicy(cfg, 'chat', 'deny');
 * // cfg2.napplets['chat'].policy === 'deny'
 * // cfg is unchanged
 * ```
 */
export function setPolicy(
  config: FirewallConfig,
  napplet: string,
  policy: NappletPolicy,
): FirewallConfig {
  const entry = getNapplet(config, napplet);
  return {
    ...config,
    napplets: {
      ...config.napplets,
      [napplet]: { ...entry, policy },
    },
  };
}

/**
 * Set a per-napplet, per-opClass token-bucket rate limit.
 *
 * Returns a new FirewallConfig with `napplets[napplet].rateLimits[opClass]`
 * set to `limit`. If the napplet has no existing entry, a fresh entry is created.
 * The original config is never modified.
 *
 * @param config  - Current firewall config
 * @param napplet - Napplet dTag to configure
 * @param opClass - Operation class string (e.g. 'relay:write', 'outbox:write')
 * @param limit   - Token-bucket rate limit to apply
 * @returns New FirewallConfig with the rate limit set
 *
 * @example
 * ```ts
 * const cfg2 = setRateLimit(cfg, 'chat', 'relay:write', { capacity: 10, windowMs: 5000, action: 'block' });
 * // cfg2.napplets['chat'].rateLimits['relay:write'].capacity === 10
 * ```
 */
export function setRateLimit(
  config: FirewallConfig,
  napplet: string,
  opClass: string,
  limit: RateLimit,
): FirewallConfig {
  const entry = getNapplet(config, napplet);
  return {
    ...config,
    napplets: {
      ...config.napplets,
      [napplet]: {
        ...entry,
        rateLimits: { ...entry.rateLimits, [opClass]: limit },
      },
    },
  };
}

/**
 * Set a per-napplet global fallback rate limit (RATE-03).
 *
 * The global rate is applied to all op-classes for this napplet that lack a
 * specific `rateLimits` entry. This provides a single budget covering all
 * unlisted operations rather than relying solely on the config-wide `defaultRate`.
 *
 * Returns a new FirewallConfig with `napplets[napplet].globalRate` set.
 * The original config is never modified.
 *
 * @param config  - Current firewall config
 * @param napplet - Napplet dTag to configure
 * @param limit   - Global fallback rate limit for this napplet
 * @returns New FirewallConfig with the global rate set
 *
 * @example
 * ```ts
 * const cfg2 = setGlobalRate(cfg, 'chat', { capacity: 30, windowMs: 30000, action: 'flag' });
 * // cfg2.napplets['chat'].globalRate is set; other napplets unaffected
 * ```
 */
export function setGlobalRate(
  config: FirewallConfig,
  napplet: string,
  limit: RateLimit,
): FirewallConfig {
  const entry = getNapplet(config, napplet);
  return {
    ...config,
    napplets: {
      ...config.napplets,
      [napplet]: { ...entry, globalRate: limit },
    },
  };
}

/**
 * Append a content matcher to the firewall config.
 *
 * Matchers are evaluated in order; the first match wins (POLICY-03). Returns a
 * new FirewallConfig with `matcher` appended to the end of `config.matchers`.
 * The original config is never modified.
 *
 * @param config  - Current firewall config
 * @param matcher - Content matcher to append
 * @returns New FirewallConfig with the matcher appended
 *
 * @example
 * ```ts
 * const cfg2 = addMatcher(cfg, { id: 'delete-spam', opClass: 'relay:write', kinds: [5], action: 'block' });
 * // cfg2.matchers.length === cfg.matchers.length + 1
 * ```
 */
export function addMatcher(config: FirewallConfig, matcher: ContentMatcher): FirewallConfig {
  return { ...config, matchers: [...config.matchers, matcher] };
}

/**
 * Serialize a FirewallConfig to a JSON string.
 *
 * Pure function — no I/O. The persistence adapter in @kehto/shell (Phase 81)
 * uses this to write config to localStorage or other backends.
 *
 * @param config - Firewall config to serialize
 * @returns JSON string representation
 *
 * @example
 * ```ts
 * const json = serialize(config);
 * localStorage.setItem('kehto:firewall', json);
 * ```
 */
export function serialize(config: FirewallConfig): string {
  return JSON.stringify(config);
}

const VALID_ACTIONS: Action[] = ['flag', 'block', 'ignore'];

function isValidAction(v: unknown): v is Action {
  return VALID_ACTIONS.includes(v as Action);
}

function isValidRateLimit(v: unknown): v is RateLimit {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r['capacity'] === 'number' &&
    isFinite(r['capacity'] as number) &&
    typeof r['windowMs'] === 'number' &&
    isFinite(r['windowMs'] as number) &&
    isValidAction(r['action'])
  );
}

function isValidBurstGuard(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false;
  const b = v as Record<string, unknown>;
  return (
    typeof b['windowMs'] === 'number' &&
    isFinite(b['windowMs'] as number) &&
    typeof b['maxOps'] === 'number' &&
    isFinite(b['maxOps'] as number) &&
    isValidAction(b['action'])
  );
}

function isValidContentMatcher(v: unknown): v is ContentMatcher {
  if (typeof v !== 'object' || v === null) return false;
  const m = v as Record<string, unknown>;
  if (typeof m['id'] !== 'string') return false;
  if (!isValidAction(m['action'])) return false;
  // Optional fields — if present, validate types
  if ('opClass' in m && typeof m['opClass'] !== 'string') return false;
  if ('minSize' in m && typeof m['minSize'] !== 'number') return false;
  if ('focused' in m && typeof m['focused'] !== 'boolean') return false;
  if ('maxMsSinceFocusGain' in m && typeof m['maxMsSinceFocusGain'] !== 'number') return false;
  if ('kinds' in m) {
    if (!Array.isArray(m['kinds'])) return false;
    if (!(m['kinds'] as unknown[]).every((k) => typeof k === 'number')) return false;
  }
  return true;
}

function isValidNappletRules(v: unknown): v is NappletRules {
  if (typeof v !== 'object' || v === null) return false;
  const n = v as Record<string, unknown>;
  // rateLimits must be an object
  if (typeof n['rateLimits'] !== 'object' || n['rateLimits'] === null) return false;
  for (const limit of Object.values(n['rateLimits'] as Record<string, unknown>)) {
    if (!isValidRateLimit(limit)) return false;
  }
  // Optional policy
  if ('policy' in n) {
    const p = n['policy'];
    if (p !== 'allow' && p !== 'deny' && p !== 'ask') return false;
  }
  // Optional globalRate
  if ('globalRate' in n && !isValidRateLimit(n['globalRate'])) return false;
  return true;
}

/**
 * Deserialize a FirewallConfig from a JSON string.
 *
 * Defensive parse: tries JSON.parse, then shape-validates every top-level and
 * nested field (napplets map, matchers array, burstGuard, defaultRate, and
 * unfocusedMultiplier). Rebuilds a validated config from the parsed data.
 *
 * On ANY failure (invalid JSON, missing fields, wrong types, invalid action
 * values, malformed nested structures) falls through to `defaultConfig()`.
 * This function NEVER throws.
 *
 * Security control for T-80-01 (Tampering — persisted config string):
 * the config string is the only untrusted input to @kehto/firewall. Poisoned
 * or malformed strings always produce a safe, valid default config.
 *
 * @param json - JSON string to parse (may be untrusted)
 * @returns Parsed and validated FirewallConfig, or defaultConfig() on any failure
 *
 * @example
 * ```ts
 * const json = localStorage.getItem('kehto:firewall') ?? '';
 * const config = deserialize(json);
 * // config is always a valid FirewallConfig — never throws
 * ```
 */
export function deserialize(json: string): FirewallConfig {
  try {
    const parsed = JSON.parse(json);

    // Top-level shape check
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.napplets !== 'object' ||
      parsed.napplets === null ||
      !Array.isArray(parsed.matchers) ||
      !isValidBurstGuard(parsed.burstGuard) ||
      !isValidRateLimit(parsed.defaultRate) ||
      typeof parsed.unfocusedMultiplier !== 'number' ||
      !isFinite(parsed.unfocusedMultiplier)
    ) {
      return defaultConfig();
    }

    const napplets: Record<string, NappletRules> = {};
    for (const [key, value] of Object.entries(parsed.napplets as Record<string, unknown>)) {
      if (!isValidNappletRules(value)) return defaultConfig();
      // The type guard above narrows `value` to NappletRules.
      const raw = value;
      const rateLimits: Record<string, RateLimit> = {};
      for (const [opClass, limit] of Object.entries(raw.rateLimits)) {
        rateLimits[opClass] = limit;
      }
      const entry: NappletRules = { rateLimits };
      const withPolicy: NappletRules = raw.policy !== undefined
        ? { ...entry, policy: raw.policy }
        : entry;
      const withGlobalRate: NappletRules = raw.globalRate !== undefined
        ? { ...withPolicy, globalRate: raw.globalRate }
        : withPolicy;
      napplets[key] = withGlobalRate;
    }

    const matchers: ContentMatcher[] = [];
    for (const item of parsed.matchers as unknown[]) {
      if (!isValidContentMatcher(item)) return defaultConfig();
      matchers.push(item as ContentMatcher);
    }

    // Rebuild burstGuard and defaultRate from validated parsed data
    const bg = parsed.burstGuard as Record<string, unknown>;
    const dr = parsed.defaultRate as Record<string, unknown>;

    return {
      napplets,
      matchers,
      burstGuard: {
        windowMs: bg['windowMs'] as number,
        maxOps: bg['maxOps'] as number,
        action: bg['action'] as Action,
      },
      defaultRate: {
        capacity: dr['capacity'] as number,
        windowMs: dr['windowMs'] as number,
        action: dr['action'] as Action,
      },
      unfocusedMultiplier: parsed.unfocusedMultiplier as number,
    };
  } catch {
    // Invalid JSON — fall through to default
  }
  return defaultConfig();
}
