import type { NappletMessage } from '@napplet/core';
import { ALL_CAPABILITIES } from '@kehto/acl/capabilities';
import type { AclStateContainer } from './acl-state.js';
import type { SessionRegistry } from './session-registry.js';
import type { RuntimeAdapter, ServiceInfo, ServiceRegistry } from './types.js';
import type { createNapEnforceGate } from './enforce.js';
import type { createPermissionRuntime } from './permission-runtime.js';
import { snapshotApprovalEnvelope } from './approval-envelope.js';

interface ExtensionContext {
  hooks: RuntimeAdapter;
  services: ServiceRegistry;
  registrations: Map<string, ServiceInfo>;
  sessions: SessionRegistry;
  acl: AclStateContainer;
  enforce: ReturnType<typeof createNapEnforceGate>;
  firewall: (windowId: string, message: NappletMessage, capability: string | null, respond?: boolean) => 'dispatch' | 'drop';
  permissions?: ReturnType<typeof createPermissionRuntime>;
}

/** Internal route for host-defined contracts outside the built-in NAP domains. */
export function createServiceExtensionRouter(context: ExtensionContext) {
  const { hooks, services, registrations, sessions, acl, enforce, firewall } = context;
  const windowLifetimes = new Map<string, object>();
  const replay = new Map<string, Set<string>>();

  function handleMessage(windowId: string, message: NappletMessage): void {
    if (context.permissions) {
      const captured = snapshotApprovalEnvelope(message);
      if (!captured) return;
      message = captured;
    }
    const dot = message.type.indexOf('.');
    const domain = message.type.slice(0, dot);
    if (dot <= 0 || dot === message.type.length - 1 || !/^[a-z][a-z0-9-]*$/.test(domain)
      || !Object.hasOwn(services, domain)) return;
    const handler = services[domain];
    const policies = handler.messageCapabilities;
    if (!policies || !Object.hasOwn(policies, message.type)) return;
    const capability = policies[message.type];
    // Undefined, inherited values, and noncanonical capability strings never
    // mean permission-free. Only an explicit null opts out of the extra ACL.
    if (capability !== null && !ALL_CAPABILITIES.includes(capability)) return;
    const session = sessions.getEntryByWindowId(windowId);
    const registration = registrations.get(domain);
    if (!session || !registration) return;
    const allowed = () => hooks.isDomainAllowed?.(windowId, domain) === true
      && !acl.isBlocked('', session.dTag, session.aggregateHash)
      && (capability === null || enforce(windowId, capability, message).allowed);
    if (!allowed()) return;
    if (!context.permissions && firewall(windowId, message, capability, false) === 'drop') return;

    let lifetime = windowLifetimes.get(windowId);
    if (!lifetime) {
      lifetime = {};
      windowLifetimes.set(windowId, lifetime);
    }
    const sourceCurrent = () => registrations.get(domain) === registration && services[domain] === handler
      && sessions.getEntryByWindowId(windowId) === session && allowed();
    const current = () => sourceCurrent() && windowLifetimes.get(windowId) === lifetime;
    const sender = (active: () => boolean, eligible = current) => (response: NappletMessage) => {
      if (!eligible() || !active()) return;
      if (!response || typeof response.type !== 'string' || !response.type.startsWith(`${domain}.`)
        || response.type.length <= dot + 1) return;
      hooks.sendToNapplet(windowId, response);
    };
    let dispatched = false;
    const dispatch = (active: () => boolean) => { dispatched = true; handler.handleMessage(windowId, message, sender(active)); };
    if (!context.permissions) { dispatch(() => true); return; }
    const id = (message as NappletMessage & { id?: unknown }).id;
    if (id !== undefined) {
      if (typeof id !== 'string' || id.length === 0 || id.length > 256) return;
      let seen = replay.get(windowId);
      if (!seen) { seen = new Set(); replay.set(windowId, seen); }
      const key = JSON.stringify([message.type, id]);
      if (seen.has(key) || seen.size >= 4096) return;
      seen.add(key);
    }
    // The host owns extension error contracts, including whether a reply exists.
    void context.permissions.run(windowId, message.type, [{ category: 'interface', domain,
      operation: 'access', scope: { kind: 'exact', value: domain } }], current,
    (signal) => dispatch(() => !signal.aborted)).then((outcome) => {
      if (!dispatched && outcome.status !== 'executed' && sourceCurrent()) {
        handler.onPermissionDenied?.(windowId, message, outcome.status, sender(() => true, sourceCurrent));
      }
    }).catch(() => {});
  }

  return {
    handleMessage,
    destroyWindow(windowId: string): void { windowLifetimes.delete(windowId); replay.delete(windowId); },
    revokeWindow(windowId: string): void { windowLifetimes.delete(windowId); },
    destroy(): void { windowLifetimes.clear(); replay.clear(); },
  };
}
