import { permissionPrincipalKey } from '@kehto/firewall';
import type { PermissionGrant } from '@kehto/runtime';
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
