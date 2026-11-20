/**
 * kehto/tamper.ts — Interposition points for the mutation self-tests.
 *
 * Nothing here is used by a normal run. Each hook lets a mutation break one
 * property of the otherwise real target so the suite can prove the matching
 * check fails for that reason and no other.
 */
import type { NappletMessage, ShellAdapter, ShellBridge } from '@kehto/shell';
import type { ProbeSpec } from '../target.js';

/**
 * Optional ways to corrupt the first-party target.
 *
 * @example
 * ```ts
 * const tamper: KehtoTamper = { srcdoc: (srcdoc) => srcdoc.replace('<head>', '<head><script>window.nostr={}</script>') };
 * ```
 */
export interface KehtoTamper {
  /** Misreport what the runtime advertises. */
  advertised?(live: { domains: readonly string[]; services: readonly string[] }): { domains: readonly string[]; services: readonly string[] };
  /** Rewrite the document assigned to a probe frame. */
  srcdoc?(srcdoc: string, spec: ProbeSpec): string;
  /** Rewrite, duplicate or drop a runtime -> napplet message. */
  outbound?(windowId: string, message: unknown): unknown[];
  /** Decide whether a napplet -> runtime message is dispatched. */
  filterMessage?(windowId: string, message: NappletMessage): 'dispatch' | 'defer' | 'drop';
  /** Replace the adapter handed to `createShellBridge`. */
  hooks?(hooks: ShellAdapter): ShellAdapter;
  /**
   * Admit rogue frames as if they were verified endpoints, so a source the
   * runtime never verified is serviced. Breaks `nip5d/source-binding`.
   */
  adoptRogue?: boolean;
  /** Called once the bridge exists. */
  attached?(bridge: ShellBridge): void;
  /**
   * Destroying an endpoint only removes its frame: the runtime keeps the
   * session, its subscriptions and its channels. Breaks lifecycle cleanup.
   */
  keepRuntimeStateOnDestroy?: boolean;
}
