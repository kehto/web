import { permissionPrincipalKey } from '@kehto/firewall';
import type { PermissionGrant, PermissionPrincipal } from '@kehto/runtime';
import { getTargetOriginIdentity } from './browser-target-frame.js';
import type { PajaRuntimeTab } from './browser-runtime-tabs.js';
import type { PajaHostConfig } from './options.js';

/** Select only runtime tabs whose exact verified/development principal lost a grant. */
export function revokedPajaTabIds(
  config: PajaHostConfig,
  tabs: readonly PajaRuntimeTab[],
  grant: PermissionGrant,
): string[] {
  const revoked = permissionPrincipalKey(grant.principal);
  return tabs.filter((tab) => {
    const principal = getTargetOriginIdentity(config, tab.resolvedTarget).permissionPrincipal;
    return principal && permissionPrincipalKey(principal) === revoked;
  }).map((tab) => tab.id);
}

/**
 * Name a principal the way the user already sees it: the title of the open
 * tab running it. A principal with no open tab falls back to its development
 * target, or to a generic label; the technical identity is always shown too.
 *
 * @param config - Serialized Paja host configuration.
 * @param tabs - Runtime tabs currently open.
 * @param principal - Trusted identity to name.
 * @returns Display label only; it carries no authority.
 * @example
 * ```ts
 * pajaPrincipalLabel(config, state.tabs, grant.principal); // 'photohop'
 * ```
 */
export function pajaPrincipalLabel(
  config: PajaHostConfig,
  tabs: readonly PajaRuntimeTab[],
  principal: PermissionPrincipal,
): string {
  const key = permissionPrincipalKey(principal);
  const tab = tabs.find((candidate) => {
    const open = getTargetOriginIdentity(config, candidate.resolvedTarget).permissionPrincipal;
    return open && permissionPrincipalKey(open) === key;
  });
  if (tab?.title) return tab.title;
  return principal.kind === 'verified' ? 'Verified napplet' : principal.target;
}
