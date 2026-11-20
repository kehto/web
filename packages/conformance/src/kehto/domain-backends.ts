/**
 * kehto/domain-backends.ts — Compose the per-domain backend modules for one variant.
 */
import type { ApprovalAnswer, ApprovalPrompt, ServiceHandler } from '@kehto/runtime';
import type { ShellAdapter, ShellBridge } from '@kehto/shell';
import type { TargetVariant } from '../target.js';
import { DOMAIN_BACKENDS } from './domains/index.js';
import type { DomainBackendInstance, HostControl } from './domains/types.js';
import { createFixtureUser, type FixtureUser } from './user.js';

/** Everything domain-specific the adapter needs. */
export interface DomainBackends {
  readonly user: FixtureUser;
  decide(prompt: ApprovalPrompt): ApprovalAnswer;
  readonly focus: { windowId: string | null };
  readonly services: Readonly<Record<string, ServiceHandler>>;
  readonly adapter: Partial<ShellAdapter>;
  readonly controls: Readonly<Record<string, HostControl>>;
  /** Domains with an installed backend. */
  readonly installed: readonly string[];
  attach(bridge: ShellBridge): void;
  dispose(): void;
}

/** Runtime-native domains that have no backend in the minimal profile and are therefore disabled. */
const MINIMAL_DISABLED = ['relay', 'keys', 'media', 'notify'];

/**
 * Build the backends for a variant: every module in the full profile, none in minimal.
 *
 * @param variant - Profile and shell mode.
 * @returns The composed backends.
 */
export function composeBackends(variant: TargetVariant): DomainBackends {
  const user = createFixtureUser();
  const instances: { domain: string; instance: DomainBackendInstance }[] = variant.profile === 'full'
    ? DOMAIN_BACKENDS.map((module) => ({ domain: module.domain, instance: module.create({ variant, user }) }))
    : [];
  const services: Record<string, ServiceHandler> = {};
  const controls: Record<string, HostControl> = {};
  let adapter: Partial<ShellAdapter> = {};
  for (const { instance } of instances) {
    Object.assign(services, instance.services ?? {});
    Object.assign(controls, instance.controls ?? {});
    adapter = { ...adapter, ...instance.adapter };
  }
  return {
    user,
    decide: () => ({ effect: 'allow', lifetime: 'session' }),
    focus: { windowId: null },
    services, adapter, controls,
    installed: instances.map((item) => item.domain),
    attach(bridge) { for (const { instance } of instances) instance.attach?.(bridge); },
    dispose() { for (const { instance } of instances) instance.dispose?.(); },
  };
}

/** Domains the variant deliberately does not expose. */
export function disabledDomains(variant: TargetVariant, backends: DomainBackends): string[] {
  const disabled = variant.shell === 'shell-absent' ? ['shell'] : [];
  if (variant.profile === 'minimal') return [...disabled, ...MINIMAL_DISABLED];
  // Full profile: a runtime-native domain without a backend is not advertised.
  return [...disabled, ...MINIMAL_DISABLED.filter((domain) => !backends.installed.includes(domain))];
}
