/** Legacy behavioral observation, supplied only to a host-installed adapter. */
export interface LegacyFirewallObservation {
  readonly napplet: string;
  readonly opClass: string;
  readonly kind?: number;
  readonly size?: number;
  readonly initElapsedMs?: number;
  readonly initKey?: string;
  readonly focused: boolean;
  readonly msSinceFocusGain?: number;
  readonly now: number;
}

/** Optional compatibility hook; cannot replace scoped permission approvals. */
export interface LegacyFirewallAdapter {
  evaluate(observation: LegacyFirewallObservation): {
    readonly decision: 'pass' | 'reject' | 'prompt';
    readonly action: 'flag' | 'block' | 'ignore';
    readonly ruleId: string;
    readonly reason: string;
  };
  resetInitBudget(initKey: string): void;
  setPolicy(napplet: string, policy: 'allow' | 'deny' | 'ask'): void;
  persist(): void;
  load(): void;
}
