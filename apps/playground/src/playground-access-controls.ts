import type {
  AclCheckEvent,
  Capability,
  ServiceHandler,
  ShellBridge,
} from '@kehto/shell';

import type { NappletInfo } from './shell-host.js';

const SERVICE_STATE_STORAGE_KEY = 'kehto.playground.disabledServices.v1';
const NOTIFICATION_SERVICE_TARGETS = Object.freeze(['notifications', 'notify'] as const);

export interface DemoAclAdapter {
  /** Grant a capability on a napplet by windowId. */
  grant(windowId: string, capability: Capability): void;
  /** Revoke a capability on a napplet by windowId. */
  revoke(windowId: string, capability: Capability): void;
  /** Block a napplet by windowId. */
  block(windowId: string): void;
  /** Unblock a napplet by windowId. */
  unblock(windowId: string): void;
  /** Snapshot of all ACL entries for napplets currently identity-bound. */
  snapshot(): Array<{
    windowId: string;
    name: string;
    pubkey: string;
    dTag: string;
    aggregateHash: string;
    blocked: boolean;
    capabilities: Record<Capability, boolean>;
  }>;
  /** Synchronous capability check. */
  check(windowId: string, capability: Capability): boolean;
  /** Subscribe to ACL audit events. */
  onCheck(listener: (event: AclCheckEvent, windowId: string, nappletName: string) => void): () => void;
}

export interface PlaygroundAccessControlHost {
  getRelay(): ShellBridge;
  getNapplets(): Map<string, NappletInfo>;
  registerDemoServiceName(name: string): void;
}

/**
 * Own playground ACL mutation, ACL inspection, and runtime service toggles.
 */
export class PlaygroundAccessControls {
  private readonly serviceHandlerStore = new Map<string, ServiceHandler>();
  private readonly disabledServices = new Set<string>();
  private readonly aclCheckListeners: Array<
    (event: AclCheckEvent, windowId: string, nappletName: string) => void
  > = [];
  private aclAdapter: DemoAclAdapter | undefined;

  constructor(private readonly host: PlaygroundAccessControlHost) {}

  getDisabledDomains(): readonly string[] {
    return [
      ...new Set(
        [...this.disabledServices].flatMap((name) => this.getServiceToggleTargets(name)),
      ),
    ];
  }

  populateServiceHandlerStore(services: Record<string, ServiceHandler> | undefined): void {
    if (!services) return;
    for (const [name, handler] of Object.entries(services)) {
      this.serviceHandlerStore.set(name, handler);
    }
  }

  wrapRuntimeServiceRegistration(): void {
    const runtime = this.host.getRelay().runtime;
    const originalRegisterService = runtime.registerService.bind(runtime);
    runtime.registerService = (name, handler) => {
      this.host.registerDemoServiceName(name);
      this.serviceHandlerStore.set(name, handler);
      originalRegisterService(name, handler);
    };
  }

  applyPersistedServiceState(): void {
    const runtime = this.host.getRelay().runtime;
    for (const name of this.readPersistedDisabledServices()) {
      const stateKey = this.getServiceToggleStateKey(name);
      const targets = this.getServiceToggleTargets(stateKey);
      if (!targets.some((target) => this.serviceHandlerStore.has(target))) continue;
      this.disabledServices.add(stateKey);
      for (const target of targets) runtime.unregisterService(target);
    }
  }

  notifyAclCheckListeners(
    event: AclCheckEvent,
    windowId: string,
    nappletName: string,
  ): void {
    for (const listener of this.aclCheckListeners) {
      try {
        listener(event, windowId, nappletName);
      } catch {
        // One inspector listener must not interrupt protocol dispatch.
      }
    }
  }

  toggleCapability(windowId: string, capability: Capability, enabled: boolean): void {
    const info = this.host.getNapplets().get(windowId);
    if (!info) {
      console.warn('[acl] toggleCapability: no info for', windowId);
      return;
    }
    if (!info.identityBound) {
      console.warn('[acl] toggleCapability: napplet not yet identity-bound', windowId);
      return;
    }
    const pubkey = info.pubkey ?? '';
    const dTag = info.dTag || '';
    const hash = info.aggregateHash || '';
    const aclState = this.host.getRelay().runtime.aclState;
    if (enabled) aclState.grant(pubkey, dTag, hash, capability);
    else aclState.revoke(pubkey, dTag, hash, capability);
    aclState.persist();
  }

  toggleService(name: string, enabled: boolean): void {
    const stateKey = this.getServiceToggleStateKey(name);
    const targets = this.getServiceToggleTargets(stateKey);
    const runtime = this.host.getRelay().runtime;
    if (enabled) {
      const handlers = targets
        .map((target) => [target, this.serviceHandlerStore.get(target)] as const)
        .filter((entry): entry is readonly [string, ServiceHandler] => entry[1] !== undefined);
      if (handlers.length === 0) {
        console.warn('[service] toggleService: no stored handler for', name);
        return;
      }
      this.disabledServices.delete(stateKey);
      for (const [target, handler] of handlers) runtime.registerService(target, handler);
    } else {
      this.disabledServices.add(stateKey);
      for (const target of targets) runtime.unregisterService(target);
    }
    this.persistDisabledServices();
  }

  isServiceEnabled(name: string): boolean {
    return !this.disabledServices.has(this.getServiceToggleStateKey(name));
  }

  toggleBlock(windowId: string, blocked: boolean): void {
    const info = this.host.getNapplets().get(windowId);
    if (!info?.identityBound) return;
    const aclState = this.host.getRelay().runtime.aclState;
    if (blocked) {
      aclState.block(info.pubkey ?? '', info.dTag || '', info.aggregateHash || '');
    } else {
      aclState.unblock(info.pubkey ?? '', info.dTag || '', info.aggregateHash || '');
    }
    aclState.persist();
  }

  /**
   * Return the stable adapter consumed by playground UI surfaces.
   *
   * @returns The playground ACL adapter.
   */
  getAclAdapter(): DemoAclAdapter {
    if (!this.aclAdapter) {
      this.aclAdapter = {
        grant: (windowId, capability) => this.toggleCapability(windowId, capability, true),
        revoke: (windowId, capability) => this.toggleCapability(windowId, capability, false),
        block: (windowId) => this.toggleBlock(windowId, true),
        unblock: (windowId) => this.toggleBlock(windowId, false),
        snapshot: () => this.snapshot(),
        check: (windowId, capability) => this.check(windowId, capability),
        onCheck: (listener) => this.onCheck(listener),
      };
    }
    return this.aclAdapter;
  }

  private snapshot(): ReturnType<DemoAclAdapter['snapshot']> {
    const out: ReturnType<DemoAclAdapter['snapshot']> = [];
    const aclState = this.host.getRelay().runtime.aclState;
    for (const [windowId, info] of this.host.getNapplets()) {
      if (!info.identityBound) continue;
      const pubkey = info.pubkey ?? '';
      const dTag = info.dTag ?? '';
      const aggregateHash = info.aggregateHash ?? '';
      const entry = aclState.getEntry(pubkey, dTag, aggregateHash);
      const hasCapability = (capability: Capability): boolean =>
        entry
          ? entry.capabilities.includes(capability)
          : aclState.check(pubkey, dTag, aggregateHash, capability);
      const capabilities: Record<Capability, boolean> = {
        'dm:read': hasCapability('dm:read'),
        'dm:write': hasCapability('dm:write'),
        'fs:read': hasCapability('fs:read'),
        'fs:write': hasCapability('fs:write'),
        'relay:read': hasCapability('relay:read'),
        'relay:write': hasCapability('relay:write'),
        'cache:read': hasCapability('cache:read'),
        'cache:write': hasCapability('cache:write'),
        'hotkey:forward': hasCapability('hotkey:forward'),
        'state:read': hasCapability('state:read'),
        'state:write': hasCapability('state:write'),
        'identity:read': hasCapability('identity:read'),
        'config:read': hasCapability('config:read'),
        'resource:fetch': hasCapability('resource:fetch'),
        'cvm:call': hasCapability('cvm:call'),
        'keys:bind': hasCapability('keys:bind'),
        'keys:forward': hasCapability('keys:forward'),
        'media:control': hasCapability('media:control'),
        'notify:send': hasCapability('notify:send'),
        'notify:channel': hasCapability('notify:channel'),
        'theme:read': hasCapability('theme:read'),
        'outbox:read': hasCapability('outbox:read'),
        'outbox:write': hasCapability('outbox:write'),
        'upload:write': hasCapability('upload:write'),
        'intent:read': hasCapability('intent:read'),
        'intent:write': hasCapability('intent:write'),
      };
      out.push({
        windowId,
        name: info.name,
        pubkey,
        dTag,
        aggregateHash,
        blocked: entry?.blocked ?? false,
        capabilities,
      });
    }
    return out;
  }

  private check(windowId: string, capability: Capability): boolean {
    const info = this.host.getNapplets().get(windowId);
    if (!info?.identityBound) return false;
    return this.host.getRelay().runtime.aclState.check(
      info.pubkey ?? '',
      info.dTag ?? '',
      info.aggregateHash ?? '',
      capability,
    );
  }

  private onCheck(
    listener: (event: AclCheckEvent, windowId: string, nappletName: string) => void,
  ): () => void {
    this.aclCheckListeners.push(listener);
    return () => {
      const index = this.aclCheckListeners.indexOf(listener);
      if (index !== -1) this.aclCheckListeners.splice(index, 1);
    };
  }

  private getServiceToggleTargets(name: string): readonly string[] {
    return NOTIFICATION_SERVICE_TARGETS.includes(
      name as typeof NOTIFICATION_SERVICE_TARGETS[number],
    )
      ? NOTIFICATION_SERVICE_TARGETS
      : [name];
  }

  private getServiceToggleStateKey(name: string): string {
    return NOTIFICATION_SERVICE_TARGETS.includes(
      name as typeof NOTIFICATION_SERVICE_TARGETS[number],
    )
      ? 'notifications'
      : name;
  }

  private readPersistedDisabledServices(): string[] {
    try {
      const raw = localStorage.getItem(SERVICE_STATE_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (name): name is string => typeof name === 'string' && name.length > 0,
      );
    } catch {
      return [];
    }
  }

  private persistDisabledServices(): void {
    try {
      localStorage.setItem(
        SERVICE_STATE_STORAGE_KEY,
        JSON.stringify([...this.disabledServices].sort()),
      );
    } catch {
      // Storage can be unavailable; service toggles still apply for this session.
    }
  }
}
