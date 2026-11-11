/** Compatibility evaluator for explicitly installed behavioral controls. */
import type { Observation, FirewallConfig, FirewallState, EvaluateResult, Action } from './types.js';
import { evaluateRateLimit } from '../rate-limit.js';

/**
 * Retain the legacy public bucket-key spelling for persisted consumer diagnostics.
 * @param napplet - Host-owned application key.
 * @param opClass - Operation class.
 * @returns Legacy map key.
 * @example toKey('chat', 'relay:write');
 */
export function toKey(napplet: string, opClass: string): string { return `${napplet}:${opClass}`; }
function actionToDecision(action: Action): 'pass' | 'reject' { return action === 'block' ? 'reject' : 'pass'; }

function evaluateTemporal(config: FirewallConfig, state: FirewallState, observation: Observation, ruleId: string): EvaluateResult {
  const { napplet, opClass, now } = observation;
  const rules = config.napplets[napplet];
  const limit = rules?.rateLimits[opClass] ?? rules?.globalRate ?? config.defaultRate;
  const bucketKey = toKey(napplet, opClass);
  const burstKey = observation.initKey ?? napplet;
  const bucket = state.buckets[bucketKey];
  const burst = state.bursts[burstKey];
  const canonicalBucket = JSON.stringify([napplet, opClass]);
  const canonicalBurst = JSON.stringify([napplet, burstKey]);
  const result = evaluateRateLimit({ ...limit, unfocusedMultiplier: config.unfocusedMultiplier,
    burst: { windowMs: config.burstGuard.windowMs, maxOperations: config.burstGuard.maxOps, action: config.burstGuard.action },
  }, {
    buckets: bucket ? { [canonicalBucket]: { tokens: bucket.tokens, updatedAt: bucket.lastRefill } } : {},
    bursts: burst ? { [canonicalBurst]: { count: burst.count, startedAt: burst.windowStart } } : {},
  }, { subject: napplet, operation: opClass, lifecycle: burstKey, now, focused: observation.focused,
    elapsedSinceStartMs: Math.max(0, observation.initElapsedMs ?? config.burstGuard.windowMs),
  });
  const nextBucket = result.state.buckets[canonicalBucket];
  const nextBurst = result.state.bursts[canonicalBurst];
  return {
    decision: actionToDecision(result.action), action: result.action,
    ruleId: result.reason === 'burst-exceeded' ? 'burst' : ruleId,
    reason: result.reason === 'within-budget' ? `within budget (${ruleId})`
      : result.reason === 'burst-exceeded' ? 'init-burst limit exceeded' : 'rate limit exceeded',
    newState: {
      buckets: nextBucket ? { ...state.buckets, [bucketKey]: { tokens: nextBucket.tokens, lastRefill: nextBucket.updatedAt } } : state.buckets,
      bursts: nextBurst ? { ...state.bursts, [burstKey]: { count: nextBurst.count, windowStart: nextBurst.startedAt } } : state.bursts,
    },
  };
}

/**
 * Evaluate explicitly configured legacy access/content rules and temporal limits.
 * Allow policies bypass content matching, never an installed temporal limit.
 * @param config - Host-selected configuration.
 * @param state - Existing counters.
 * @param observation - Host-authenticated observation.
 * @returns Decision and next counters.
 * @example evaluate(defaultConfig(), createState(), observation);
 */
export function evaluate(
  config: FirewallConfig,
  state: FirewallState,
  observation: Observation,
): EvaluateResult {
  const { napplet, opClass } = observation;

  const nappletRules = config.napplets[napplet];
  const policy = nappletRules?.policy;

  if (policy === 'deny') {
    return {
      decision: 'reject',
      action: 'block',
      ruleId: 'policy:deny',
      reason: `napplet ${napplet} has deny policy — always rejected`,
      newState: state,
    };
  }

  if (policy === 'ask') {
    return {
      decision: 'prompt',
      action: 'block',
      ruleId: 'policy:ask',
      reason: `napplet ${napplet} has ask policy — prompting for consent`,
      newState: state,
    };
  }

  const temporal = evaluateTemporal(config, state, observation, nappletRules?.rateLimits[opClass] ? 'rate:opclass'
    : nappletRules?.globalRate ? 'rate:global' : 'rate:default');
  if (temporal.ruleId === 'burst') return temporal;
  state = { ...state, bursts: temporal.newState.bursts };

  for (const matcher of policy === 'allow' ? [] : config.matchers) {
    if (matcher.opClass !== undefined && matcher.opClass !== opClass) continue;

    // Check kinds condition (observation.kind must be in the set)
    if (matcher.kinds !== undefined) {
      if (observation.kind === undefined) continue;
      if (!matcher.kinds.includes(observation.kind)) continue;
    }

    if (matcher.minSize !== undefined) {
      if (observation.size === undefined) continue;
      if (observation.size < matcher.minSize) continue;
    }

    if (matcher.focused !== undefined && matcher.focused !== observation.focused) continue;

    if (matcher.maxMsSinceFocusGain !== undefined) {
      if (observation.msSinceFocusGain === undefined) continue;
      if (observation.msSinceFocusGain > matcher.maxMsSinceFocusGain) continue;
    }

    // All conditions satisfied — this matcher fires
    const matcherAction = matcher.action;
    return {
      decision: actionToDecision(matcherAction),
      action: matcherAction,
      ruleId: `matcher:${matcher.id}`,
      reason: `content matcher '${matcher.id}' fired`,
      newState: state,
    };
  }

  return temporal;
}
