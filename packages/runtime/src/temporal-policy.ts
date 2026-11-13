/** Host-supplied temporal observation. Identity and time come from the runtime. */
export interface TemporalObservation {
  readonly subject: string;
  readonly operation: string;
  readonly lifecycle: string;
  readonly elapsedSinceStartMs: number;
  readonly focused: boolean;
  readonly now: number;
}

/** A temporal decision never grants access to an operation. */
export interface TemporalDecision {
  readonly allowed: boolean;
  readonly action: 'flag' | 'block' | 'ignore';
  readonly reason: 'within-budget' | 'rate-exceeded' | 'burst-exceeded';
}

/** Optional host-owned limiter. Runtime never constructs counters or defaults. */
export interface TemporalPolicy {
  evaluate(observation: TemporalObservation, mode?: 'enforce' | 'observe'): TemporalDecision;
  retire(subject: string, lifecycle: string): void;
}
