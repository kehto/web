/**
 * kehto/domain-backends.ts — Per-domain in-memory backends (phase 1 stub).
 */
import type { ApprovalAnswer, ApprovalPrompt } from '@kehto/runtime';
import type { RelayPoolLike, ShellAdapter, ShellBridge } from '@kehto/shell';
import type { TargetVariant } from '../target.js';
import type { ControlContext } from './backends.js';

/** Everything domain-specific the adapter needs. */
export interface DomainBackends {
  relayPool: RelayPoolLike | null;
  readonly user: { pubkey: string | null; signer: unknown };
  decide(prompt: ApprovalPrompt): ApprovalAnswer;
  readonly focus: { windowId: string | null };
  readonly adapter: Partial<ShellAdapter>;
  readonly controls: Record<string, (payload: unknown, context: ControlContext) => unknown>;
  attach(bridge: ShellBridge): void;
  dispose(): void;
}

/** Build the full backend set. */
export function fullBackends(_variant: TargetVariant): DomainBackends {
  return {
    relayPool: null,
    user: { pubkey: null, signer: null },
    decide: () => ({ effect: 'allow', lifetime: 'session' }),
    focus: { windowId: null },
    adapter: {},
    controls: {},
    attach() {},
    dispose() {},
  };
}

/** Domains the minimal profile deliberately does not expose. */
export function minimalDisabledDomains(_domains: DomainBackends): string[] {
  return ['relay', 'keys', 'media', 'notify'];
}
