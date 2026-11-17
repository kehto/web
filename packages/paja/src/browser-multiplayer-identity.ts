import type { PajaRuntimeTarget } from './local-target.js';
import { isPajaLocalTarget } from './local-target.js';

/** Derive soy-rtc/1 identity only after the runtime resolver verified the manifest and artifact. */
export function pajaMultiplayerNamespace(target: PajaRuntimeTarget | null | undefined): string | undefined {
  if (!target || isPajaLocalTarget(target)) return undefined;
  const event = target.event;
  const address = event.kind === 5129 ? event.tags.find(tag => tag[0] === 'a')?.[1] : `${event.kind}:${event.pubkey}:${target.dTag}`;
  if (!address) return '';
  const [kind, author, ...identifier] = address.split(':');
  return author === event.pubkey ? `${event.pubkey}:${kind}:${identifier.join(':')}` : `${event.pubkey}:5129:${address}`;
}
