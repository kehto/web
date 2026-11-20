/**
 * kehto/domains/types.ts — The contract a per-domain backend module implements.
 */
import type { ServiceHandler } from '@kehto/runtime';
import type { ShellAdapter, ShellBridge } from '@kehto/shell';
import type { TargetVariant } from '../../target.js';
import type { FixtureUser } from '../user.js';

/** Context handed to a host control. */
export interface ControlContext {
  readonly bridge: ShellBridge;
  readonly hooks: ShellAdapter;
}

/** A host control: triggers a push or reads backend evidence. */
export type HostControl = (payload: unknown, context: ControlContext) => unknown;

/** What a module receives when the target boots a variant. */
export interface BackendContext {
  readonly variant: TargetVariant;
  readonly user: FixtureUser;
}

/** One booted domain backend. */
export interface DomainBackendInstance {
  /** Entries merged into `ShellAdapter.services`. */
  readonly services?: Readonly<Record<string, ServiceHandler>>;
  /** Other adapter fields this domain needs (`upload`, `intent`, ...). */
  readonly adapter?: Partial<ShellAdapter>;
  /** Named host controls, e.g. `theme.publish`. */
  readonly controls?: Readonly<Record<string, HostControl>>;
  /** Called once the bridge exists. */
  attach?(bridge: ShellBridge): void;
  dispose?(): void;
}

/**
 * A deterministic, in-memory backend for one domain of the full profile.
 *
 * @example
 * ```ts
 * export const THEME_BACKEND: DomainBackendModule = { domain: 'theme', create: () => ({ services: { theme } }) };
 * ```
 */
export interface DomainBackendModule {
  readonly domain: string;
  create(context: BackendContext): DomainBackendInstance;
}
