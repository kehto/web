/**
 * catalog/domains.ts — Which packaged NAP domains Kehto supports.
 *
 * `SUPPORTED_DOMAINS` mirrors the shell's runtime-native and service-only
 * domain lists (`packages/shell/src/shell-init.ts`). `UNROUTED_PACKAGE_DOMAINS`
 * are domains `@napplet/nap` ships that Kehto does not route. The drift test
 * fails when the installed package gains a domain that is in neither list.
 */

/** Every NAP domain Kehto can advertise, checked baseline of kehto/web#187 plus `llm`. */
export const SUPPORTED_DOMAINS: readonly string[] = Object.freeze([
  'shell', 'relay', 'identity', 'storage', 'inc', 'theme', 'keys', 'media', 'notify',
  'outbox', 'config', 'resource', 'cvm', 'upload', 'intent', 'link', 'common',
  'lists', 'serial', 'ble', 'webrtc', 'dm', 'count', 'fs', 'gamepad', 'llm',
]);

/** Packaged domains Kehto does not route, with the reason. */
export const UNROUTED_PACKAGE_DOMAINS: Readonly<Record<string, string>> = Object.freeze({
  blossom: 'No Kehto handler; Blossom servers stay shell-owned behind NAP-UPLOAD.',
  catalog: 'No Kehto handler.',
  ifc: 'Retired name kept by the package for compatibility; ships no message types.',
  navigation: 'Not a built-in domain; only routable as a registered service extension.',
  soulseek: 'No Kehto handler.',
  torrent: 'No Kehto handler.',
});
