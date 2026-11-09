/**
 * service-context.ts — the narrow per-handler `ServiceRuntimeContext` the
 * runtime hands each attached service. Split from runtime.ts (kept separate
 * for size). Internal; not exported from the package entry point.
 */

import type { NappletMessage } from '@napplet/core';
import { ALL_CAPABILITIES, type Capability } from '@kehto/acl/capabilities';
import { isExtensionDomain } from '@kehto/acl';
import type { RuntimeAdapter, ServiceHandler, ServiceInfo, ServiceRegistry, ServiceRuntimeContext } from './types.js';
import type { AclCapability, AclStateContainer } from './acl-state.js';
import type { SessionRegistry } from './session-registry.js';
import type { createServiceExtensionRouter } from './service-extensions.js';
import { resolveCapabilitiesNap } from './enforce.js';

/** Runtime state a service context reads; a subset of the runtime instance context. */
export type ServiceContextSources = {
  aclState: AclStateContainer;
  builtInDomains: ReadonlySet<string>;
  extensions: ReturnType<typeof createServiceExtensionRouter>;
  hooks: RuntimeAdapter;
  registeredServices: Map<string, ServiceInfo>;
  serviceRegistry: ServiceRegistry;
  sessionRegistry: SessionRegistry;
};

/**
 * Recipient capability for a shell -> napplet push into a custom domain, or
 * `undefined` when no authorized push route exists. Mirrors the inbound
 * extension router: the domain must be a registered service whose handler
 * declares the exact type in `pushCapabilities` with an existing capability
 * or an explicit `null`.
 */
function resolveExtensionPushCapability(
  domain: string,
  type: string,
  serviceRegistry: ServiceRegistry,
  registeredServices: Map<string, ServiceInfo>,
): Capability | null | undefined {
  if (!/^[a-z][a-z0-9-]*$/.test(domain) || !Object.hasOwn(serviceRegistry, domain) || !registeredServices.has(domain)) {
    return undefined;
  }
  const policies = serviceRegistry[domain].pushCapabilities;
  if (!policies || !Object.hasOwn(policies, type)) return undefined;
  const capability = policies[type];
  if (capability === null) return null;
  // Non-x custom domains map only to built-in capabilities; x- domains push
  // through their own scoped extension context instead.
  return (ALL_CAPABILITIES as readonly string[]).includes(capability) ? capability as Capability : undefined;
}

/**
 * Build the runtime context for one attached handler. Each handler gets its own
 * context so extension pushes stay scoped to the handler's own `x-` domain.
 */
export function createServiceRuntimeContext(
  context: ServiceContextSources,
  name: string,
  handler: ServiceHandler,
): ServiceRuntimeContext {
  const { aclState, builtInDomains, extensions, hooks, registeredServices, serviceRegistry, sessionRegistry } = context;
  const isDomainAllowed = hooks.isDomainAllowed;
  const sendToNapplet = hooks.sendToNapplet;
  // An x- handler sees only windows granted its domain and only its own capabilities.
  const scoped = name.startsWith('x-');
  const visible = (windowId: string): boolean => !scoped
    || (isExtensionDomain(name) && isDomainAllowed?.(windowId, name) === true);
  return Object.freeze({
    resolveDTag(windowId: string): string | undefined {
      return visible(windowId) ? sessionRegistry.getEntryByWindowId(windowId)?.dTag : undefined;
    },
    listWindowIds(): readonly string[] {
      return Object.freeze(
        sessionRegistry.getAllEntries().map((entry) => entry.windowId).filter(visible),
      );
    },
    hasCapability(windowId: string, capability: AclCapability): boolean {
      if (scoped && !capability.startsWith(`${name}:`)) return false;
      const entry = visible(windowId) ? sessionRegistry.getEntryByWindowId(windowId) : undefined;
      return !!entry && aclState.check('', entry.dTag, entry.aggregateHash, capability);
    },
    sendToEligibleNapplet(windowId: string, message: NappletMessage): boolean {
      const entry = sessionRegistry.getEntryByWindowId(windowId);
      if (!entry || typeof message.type !== 'string') return false;
      const dotIndex = message.type.indexOf('.');
      if (dotIndex <= 0) return false;
      const domain = message.type.slice(0, dotIndex);
      // An x- handler may push only its own declared x- types; it never reaches
      // the built-in push path (no theme/identity/llm/gamepad impersonation).
      if (scoped || domain.startsWith('x-')) return extensions.push(name, handler, windowId, message);
      try {
        if (!builtInDomains.has(domain)) {
          // Custom-domain pushes need the same explicit host grant as inbound
          // extension routing; an absent hook never means permission-free.
          if (hooks.isDomainAllowed?.(windowId, domain) !== true) return false;
          const capability = resolveExtensionPushCapability(domain, message.type, serviceRegistry, registeredServices);
          if (capability === undefined || aclState.isBlocked('', entry.dTag, entry.aggregateHash)) return false;
          if (capability !== null && !aclState.check('', entry.dTag, entry.aggregateHash, capability)) return false;
          sendToNapplet(windowId, message);
          return true;
        }
        if (isDomainAllowed && !isDomainAllowed(windowId, domain)) return false;
        const { recipientCap } = resolveCapabilitiesNap(message);
        // NAP-GAMEPAD requires source/domain isolation; its ACL checks are optional.
        // Do not fabricate a gamepad:read capability absent from the proposal.
        if (!recipientCap && message.type !== 'gamepad.state') return false;
        if (recipientCap && !aclState.check('', entry.dTag, entry.aggregateHash, recipientCap as Capability)) {
          return false;
        }
        sendToNapplet(windowId, message);
        return true;
      } catch {
        return false;
      }
    },
  });
}
