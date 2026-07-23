import type { ShellBridge } from '@kehto/shell';
import type { ThemeChangedMessage } from '@napplet/nap/theme/types';

/**
 * Connect Paja's retained theme service callback to its authenticated shell bridge.
 *
 * The adapter creates the service before the bridge exists, so this deliberately
 * small attachment seam rejects premature callbacks rather than buffering or
 * replaying theme state outside the ThemeService owner.
 */
export function createPajaThemeBroadcastLink(): {
  attach(bridge: Pick<ShellBridge, 'publishTheme'>): void;
  onBroadcast(envelope: ThemeChangedMessage): void;
} {
  let attachedBridge: Pick<ShellBridge, 'publishTheme'> | undefined;

  return {
    attach(bridge): void {
      if (attachedBridge) {
        throw new Error('Paja theme broadcast link is already attached.');
      }
      attachedBridge = bridge;
    },
    onBroadcast(envelope): void {
      if (!attachedBridge) {
        throw new Error('Paja theme broadcast occurred before a ShellBridge is attached.');
      }
      attachedBridge.publishTheme(envelope.theme);
    },
  };
}
