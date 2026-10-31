import type { NappletMessage } from '@napplet/core';
import { ALL_CAPABILITIES, type Capability } from '@kehto/acl/capabilities';
import { isExtensionDomain, validateExtensionCapability, type ExtensionCapability } from '@kehto/acl';
import type { AclStateContainer } from './acl-state.js';
import type { SessionRegistry } from './session-registry.js';
import type { RuntimeAdapter, ServiceHandler, ServiceInfo, ServiceRegistry } from './types.js';
import type { createNapEnforceGate } from './enforce.js';

interface ExtensionContext {
  hooks: RuntimeAdapter;
  services: ServiceRegistry;
  registrations: Map<string, ServiceInfo>;
  sessions: SessionRegistry;
  acl: AclStateContainer;
  enforce: ReturnType<typeof createNapEnforceGate>;
  firewall: (windowId: string, message: NappletMessage, capability: string | null, respond?: boolean) => 'dispatch' | 'drop';
}

type ExtensionPolicy = Capability | ExtensionCapability | null;

function domainOf(type: string): string | null {
  const dot = type.indexOf('.');
  if (dot <= 0 || dot === type.length - 1) return null;
  const domain = type.slice(0, dot);
  return /^[a-z][a-z0-9-]*$/.test(domain) ? domain : null;
}

/**
 * Resolve an own declared policy for one exact type.
 *
 * Undefined, inherited values, and unknown capability strings never mean
 * permission-free; only an explicit `null` opts out of the extra ACL. Extension
 * capabilities (`x-<domain>:<action>`) are accepted only for their own `x-`
 * domain, so an extension cannot borrow another domain's grant.
 */
function declaredPolicy(
  policies: Readonly<Record<string, ExtensionPolicy>> | undefined,
  type: string,
  domain: string,
): { readonly capability: ExtensionPolicy } | null {
  if (!policies || !Object.hasOwn(policies, type)) return null;
  const capability = policies[type];
  if (capability === null) return { capability };
  if (typeof capability !== 'string') return null;
  if ((ALL_CAPABILITIES as readonly string[]).includes(capability)) return { capability };
  if (isExtensionDomain(domain) && validateExtensionCapability(capability, domain) === null) return { capability };
  return null;
}

/** Internal route for host-defined contracts outside the built-in NAP domains. */
export function createServiceExtensionRouter(context: ExtensionContext) {
  const { hooks, services, registrations, sessions, acl, enforce, firewall } = context;
  const windowLifetimes = new Map<string, object>();

  function handlerFor(domain: string): ServiceHandler | null {
    return Object.hasOwn(services, domain) ? services[domain] : null;
  }

  function handleMessage(windowId: string, message: NappletMessage): void {
    const domain = domainOf(message.type);
    if (!domain) return;
    const handler = handlerFor(domain);
    if (!handler) return;
    const policy = declaredPolicy(handler.messageCapabilities, message.type, domain);
    if (!policy) return;
    const { capability } = policy;
    const session = sessions.getEntryByWindowId(windowId);
    const registration = registrations.get(domain);
    if (!session || !registration) return;
    const allowed = () => hooks.isDomainAllowed?.(windowId, domain) === true
      && !acl.isBlocked('', session.dTag, session.aggregateHash)
      && (capability === null || enforce(windowId, capability, message).allowed);
    if (!allowed() || firewall(windowId, message, capability, false) === 'drop') return;

    let lifetime = windowLifetimes.get(windowId);
    if (!lifetime) {
      lifetime = {};
      windowLifetimes.set(windowId, lifetime);
    }
    handler.handleMessage(windowId, message, (response) => {
      if (registrations.get(domain) !== registration || services[domain] !== handler
        || windowLifetimes.get(windowId) !== lifetime
        || sessions.getEntryByWindowId(windowId) !== session) return;
      if (!response || typeof response.type !== 'string'
        || !response.type.startsWith(`${domain}.`) || response.type.length <= domain.length + 1) return;
      if (allowed()) hooks.sendToNapplet(windowId, response);
    });
  }

  /**
   * Deliver one host-initiated message for an `x-` extension domain.
   *
   * The pushing handler must be the live registration for the message's own
   * domain and must declare the exact type in `pushCapabilities`. Delivery then
   * requires the same live session, domain grant, block, ACL and firewall
   * admission as an inbound request. Denials are silent: no envelope is invented.
   */
  function push(owner: string, handler: ServiceHandler, windowId: string, message: NappletMessage): boolean {
    if (!message || typeof message.type !== 'string') return false;
    const domain = domainOf(message.type);
    if (!domain || domain !== owner || !isExtensionDomain(domain)) return false;
    if (handlerFor(domain) !== handler || !registrations.has(domain)) return false;
    const policy = declaredPolicy(handler.pushCapabilities, message.type, domain);
    if (!policy) return false;
    const session = sessions.getEntryByWindowId(windowId);
    if (!session) return false;
    if (hooks.isDomainAllowed?.(windowId, domain) !== true) return false;
    if (acl.isBlocked('', session.dTag, session.aggregateHash)) return false;
    if (policy.capability !== null && !enforce(windowId, policy.capability, message).allowed) return false;
    if (firewall(windowId, message, policy.capability, false) === 'drop') return false;
    hooks.sendToNapplet(windowId, message);
    return true;
  }

  return {
    handleMessage,
    push,
    destroyWindow(windowId: string): void { windowLifetimes.delete(windowId); },
    destroy(): void { windowLifetimes.clear(); },
  };
}
