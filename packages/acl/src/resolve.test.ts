import { describe, it, expect } from 'vitest';
import { resolveCapabilitiesNub } from './resolve.js';
import type { CapabilityResolution } from './resolve.js';
import { ALL_CAPABILITIES } from './capabilities.js';

describe('resolveCapabilitiesNub', () => {

  describe('relay domain', () => {
    it('relay.subscribe -> relay:read only', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'relay.subscribe' });
      expect(result).toEqual({ senderCap: 'relay:read', recipientCap: null });
    });

    it('relay.query -> relay:read only', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'relay.query' });
      expect(result).toEqual({ senderCap: 'relay:read', recipientCap: null });
    });

    it('relay.close -> relay:read only', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'relay.close' });
      expect(result).toEqual({ senderCap: 'relay:read', recipientCap: null });
    });

    it('relay.publish -> relay:write (sender) + relay:read (recipient)', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'relay.publish' });
      expect(result).toEqual({ senderCap: 'relay:write', recipientCap: 'relay:read' });
    });

    it('relay.publishEncrypted -> relay:write (sender), null recipient (shell encrypts internally)', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'relay.publishEncrypted' });
      expect(result).toEqual({ senderCap: 'relay:write', recipientCap: null });
    });
  });

  describe('identity domain', () => {
    it('identity.getPublicKey -> null/null (shell-public info)', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'identity.getPublicKey' });
      expect(result).toEqual({ senderCap: null, recipientCap: null });
    });

    it('identity.getRelays -> null/null (shell-public info)', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'identity.getRelays' });
      expect(result).toEqual({ senderCap: null, recipientCap: null });
    });

    it('identity.getProfile -> identity:read', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'identity.getProfile' });
      expect(result).toEqual({ senderCap: 'identity:read', recipientCap: null });
    });

    it('identity.getFollows -> identity:read', () => {
      expect(resolveCapabilitiesNub({ type: 'identity.getFollows' })).toEqual({ senderCap: 'identity:read', recipientCap: null });
    });

    it('identity.getList -> identity:read', () => {
      expect(resolveCapabilitiesNub({ type: 'identity.getList' })).toEqual({ senderCap: 'identity:read', recipientCap: null });
    });

    it('identity.getZaps -> identity:read', () => {
      expect(resolveCapabilitiesNub({ type: 'identity.getZaps' })).toEqual({ senderCap: 'identity:read', recipientCap: null });
    });

    it('identity.getMutes -> identity:read', () => {
      expect(resolveCapabilitiesNub({ type: 'identity.getMutes' })).toEqual({ senderCap: 'identity:read', recipientCap: null });
    });

    it('identity.getBlocked -> identity:read', () => {
      expect(resolveCapabilitiesNub({ type: 'identity.getBlocked' })).toEqual({ senderCap: 'identity:read', recipientCap: null });
    });

    it('identity.getBadges -> identity:read', () => {
      expect(resolveCapabilitiesNub({ type: 'identity.getBadges' })).toEqual({ senderCap: 'identity:read', recipientCap: null });
    });

    it('identity.decrypt -> identity:decrypt', () => {
      expect(resolveCapabilitiesNub({ type: 'identity.decrypt' })).toEqual({ senderCap: 'identity:decrypt', recipientCap: null });
    });
  });

  describe('keys domain', () => {
    it('keys.forward -> keys:forward', () => {
      expect(resolveCapabilitiesNub({ type: 'keys.forward' })).toEqual({ senderCap: 'keys:forward', recipientCap: null });
    });

    it('keys.action -> keys:forward', () => {
      expect(resolveCapabilitiesNub({ type: 'keys.action' })).toEqual({ senderCap: 'keys:forward', recipientCap: null });
    });

    it('keys.registerAction -> keys:bind', () => {
      expect(resolveCapabilitiesNub({ type: 'keys.registerAction' })).toEqual({ senderCap: 'keys:bind', recipientCap: null });
    });

    it('keys.unregisterAction -> keys:bind', () => {
      expect(resolveCapabilitiesNub({ type: 'keys.unregisterAction' })).toEqual({ senderCap: 'keys:bind', recipientCap: null });
    });

    it('keys.bindings -> keys:bind', () => {
      expect(resolveCapabilitiesNub({ type: 'keys.bindings' })).toEqual({ senderCap: 'keys:bind', recipientCap: null });
    });
  });

  describe('media domain', () => {
    it('media.session.create -> media:control', () => {
      expect(resolveCapabilitiesNub({ type: 'media.session.create' })).toEqual({ senderCap: 'media:control', recipientCap: null });
    });

    it('media.command -> media:control', () => {
      expect(resolveCapabilitiesNub({ type: 'media.command' })).toEqual({ senderCap: 'media:control', recipientCap: null });
    });

    it('media.state -> media:control', () => {
      expect(resolveCapabilitiesNub({ type: 'media.state' })).toEqual({ senderCap: 'media:control', recipientCap: null });
    });

    it('media.capabilities -> media:control', () => {
      expect(resolveCapabilitiesNub({ type: 'media.capabilities' })).toEqual({ senderCap: 'media:control', recipientCap: null });
    });
  });

  describe('notify domain', () => {
    it('notify.send -> notify:send', () => {
      expect(resolveCapabilitiesNub({ type: 'notify.send' })).toEqual({ senderCap: 'notify:send', recipientCap: null });
    });

    it('notify.dismiss -> notify:send', () => {
      expect(resolveCapabilitiesNub({ type: 'notify.dismiss' })).toEqual({ senderCap: 'notify:send', recipientCap: null });
    });

    it('notify.badge -> notify:send', () => {
      expect(resolveCapabilitiesNub({ type: 'notify.badge' })).toEqual({ senderCap: 'notify:send', recipientCap: null });
    });

    it('notify.clicked -> notify:send (shell-initiated push)', () => {
      expect(resolveCapabilitiesNub({ type: 'notify.clicked' })).toEqual({ senderCap: 'notify:send', recipientCap: null });
    });

    it('notify.channel.register -> notify:channel', () => {
      expect(resolveCapabilitiesNub({ type: 'notify.channel.register' })).toEqual({ senderCap: 'notify:channel', recipientCap: null });
    });

    it('notify.permission.request -> notify:channel', () => {
      expect(resolveCapabilitiesNub({ type: 'notify.permission.request' })).toEqual({ senderCap: 'notify:channel', recipientCap: null });
    });

    it('notify.permission.result -> notify:channel', () => {
      expect(resolveCapabilitiesNub({ type: 'notify.permission.result' })).toEqual({ senderCap: 'notify:channel', recipientCap: null });
    });
  });

  describe('storage domain', () => {
    it('storage.get -> state:read', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'storage.get' });
      expect(result).toEqual({ senderCap: 'state:read', recipientCap: null });
    });

    it('storage.keys -> state:read', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'storage.keys' });
      expect(result).toEqual({ senderCap: 'state:read', recipientCap: null });
    });

    it('storage.set -> state:write', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'storage.set' });
      expect(result).toEqual({ senderCap: 'state:write', recipientCap: null });
    });

    it('storage.remove -> state:write', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'storage.remove' });
      expect(result).toEqual({ senderCap: 'state:write', recipientCap: null });
    });

    it('storage.clear (removed from canonical surface) -> null/null (runtime rejects before ACL)', () => {
      // storage.clear is not in the canonical @napplet/nub/storage union; the
      // runtime rejects the action before ACL resolution anyway. The ACL
      // layer returns null/null so the runtime's rejection surfaces cleanly.
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'storage.clear' });
      expect(result).toEqual({ senderCap: null, recipientCap: null });
    });
  });

  describe('ifc domain', () => {
    it('ifc.emit -> relay:write (sender) + relay:read (recipient)', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'ifc.emit' });
      expect(result).toEqual({ senderCap: 'relay:write', recipientCap: 'relay:read' });
    });

    it('ifc.subscribe -> relay:read only', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'ifc.subscribe' });
      expect(result).toEqual({ senderCap: 'relay:read', recipientCap: null });
    });

    it('ifc.unsubscribe -> relay:read only', () => {
      expect(resolveCapabilitiesNub({ type: 'ifc.unsubscribe' })).toEqual({ senderCap: 'relay:read', recipientCap: null });
    });

    it('ifc.channel.open -> relay:read only (open-time ACL semantics)', () => {
      expect(resolveCapabilitiesNub({ type: 'ifc.channel.open' })).toEqual({ senderCap: 'relay:read', recipientCap: null });
    });

    it('ifc.channel.emit -> relay:write + relay:read (point-to-point write)', () => {
      expect(resolveCapabilitiesNub({ type: 'ifc.channel.emit' })).toEqual({ senderCap: 'relay:write', recipientCap: 'relay:read' });
    });

    it('ifc.channel.broadcast -> relay:write + relay:read (fan-out write)', () => {
      expect(resolveCapabilitiesNub({ type: 'ifc.channel.broadcast' })).toEqual({ senderCap: 'relay:write', recipientCap: 'relay:read' });
    });

    it('ifc.channel.list -> relay:read only', () => {
      expect(resolveCapabilitiesNub({ type: 'ifc.channel.list' })).toEqual({ senderCap: 'relay:read', recipientCap: null });
    });

    it('ifc.channel.close -> relay:read only', () => {
      expect(resolveCapabilitiesNub({ type: 'ifc.channel.close' })).toEqual({ senderCap: 'relay:read', recipientCap: null });
    });
  });

  describe('theme domain', () => {
    it('theme.get -> theme:read (napplet-originated query)', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'theme.get' });
      expect(result).toEqual({ senderCap: 'theme:read', recipientCap: null });
    });

    it('theme.get.result -> theme:read', () => {
      expect(resolveCapabilitiesNub({ type: 'theme.get.result' })).toEqual({ senderCap: 'theme:read', recipientCap: null });
    });

    it('theme.changed -> recipient theme:read (shell -> napplet push)', () => {
      expect(resolveCapabilitiesNub({ type: 'theme.changed' })).toEqual({ senderCap: null, recipientCap: 'theme:read' });
    });
  });

  describe('signer domain (REMOVED in Phase 12)', () => {
    it('signer.signEvent -> null/null (signer domain no longer exists)', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'signer.signEvent' });
      expect(result).toEqual({ senderCap: null, recipientCap: null });
    });

    it('signer.getPublicKey -> null/null (migrated to identity.getPublicKey)', () => {
      expect(resolveCapabilitiesNub({ type: 'signer.getPublicKey' })).toEqual({ senderCap: null, recipientCap: null });
    });

    it('signer.nip04.encrypt -> null/null (no napplet-visible encryption surface)', () => {
      expect(resolveCapabilitiesNub({ type: 'signer.nip04.encrypt' })).toEqual({ senderCap: null, recipientCap: null });
    });

    it('signer.nip44.decrypt -> null/null (no napplet-visible encryption surface)', () => {
      expect(resolveCapabilitiesNub({ type: 'signer.nip44.decrypt' })).toEqual({ senderCap: null, recipientCap: null });
    });
  });

  describe('unknown domain and edge cases', () => {
    it('unknown.action -> null/null (silently ignore)', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'unknown.action' });
      expect(result).toEqual({ senderCap: null, recipientCap: null });
    });

    it('completely.unknown -> null/null', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'completely.unknown' });
      expect(result).toEqual({ senderCap: null, recipientCap: null });
    });

    it('no dot in type (nodot) -> null/null (falls to default)', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'nodot' });
      expect(result).toEqual({ senderCap: null, recipientCap: null });
    });
  });

  describe('config domain', () => {
    it('config.get -> config:read (napplet-originated query)', () => {
      expect(resolveCapabilitiesNub({ type: 'config.get' })).toEqual({ senderCap: 'config:read', recipientCap: null });
    });

    it('config.subscribe -> config:read (napplet sender gate)', () => {
      expect(resolveCapabilitiesNub({ type: 'config.subscribe' })).toEqual({ senderCap: 'config:read', recipientCap: null });
    });

    it('config.values -> recipient config:read (shell -> napplet push)', () => {
      expect(resolveCapabilitiesNub({ type: 'config.values' })).toEqual({ senderCap: null, recipientCap: 'config:read' });
    });

    it('config.registerSchema.result -> recipient config:read (shell -> napplet push)', () => {
      expect(resolveCapabilitiesNub({ type: 'config.registerSchema.result' })).toEqual({ senderCap: null, recipientCap: 'config:read' });
    });
  });

  describe('resource domain (v1.7 Phase 40 / NUB-RESOURCE 10th domain)', () => {
    it('resource.bytes -> sender resource:fetch (napplet-originated request)', () => {
      expect(resolveCapabilitiesNub({ type: 'resource.bytes' })).toEqual({ senderCap: 'resource:fetch', recipientCap: null });
    });

    it('resource.cancel -> sender resource:fetch (napplet-originated cancel)', () => {
      expect(resolveCapabilitiesNub({ type: 'resource.cancel' })).toEqual({ senderCap: 'resource:fetch', recipientCap: null });
    });

    it('resource.bytes.result -> recipient resource:fetch (shell -> napplet push)', () => {
      expect(resolveCapabilitiesNub({ type: 'resource.bytes.result' })).toEqual({ senderCap: null, recipientCap: 'resource:fetch' });
    });

    it('resource.bytes.error -> recipient resource:fetch (shell -> napplet push)', () => {
      expect(resolveCapabilitiesNub({ type: 'resource.bytes.error' })).toEqual({ senderCap: null, recipientCap: 'resource:fetch' });
    });

    it('resource.unknown -> sender resource:fetch (default sender gate fallthrough)', () => {
      expect(resolveCapabilitiesNub({ type: 'resource.unknown' })).toEqual({ senderCap: 'resource:fetch', recipientCap: null });
    });
  });

  describe('cvm domain (NAP-CVM ContextVM bridge)', () => {
    it('cvm.discover -> sender cvm:call (napplet-originated request)', () => {
      expect(resolveCapabilitiesNub({ type: 'cvm.discover' })).toEqual({ senderCap: 'cvm:call', recipientCap: null });
    });

    it('cvm.request -> sender cvm:call (napplet-originated request)', () => {
      expect(resolveCapabilitiesNub({ type: 'cvm.request' })).toEqual({ senderCap: 'cvm:call', recipientCap: null });
    });

    it('cvm.close -> sender cvm:call (napplet-originated request)', () => {
      expect(resolveCapabilitiesNub({ type: 'cvm.close' })).toEqual({ senderCap: 'cvm:call', recipientCap: null });
    });

    it('cvm.discover.result -> recipient cvm:call (shell -> napplet push)', () => {
      expect(resolveCapabilitiesNub({ type: 'cvm.discover.result' })).toEqual({ senderCap: null, recipientCap: 'cvm:call' });
    });

    it('cvm.request.result -> recipient cvm:call (shell -> napplet push)', () => {
      expect(resolveCapabilitiesNub({ type: 'cvm.request.result' })).toEqual({ senderCap: null, recipientCap: 'cvm:call' });
    });

    it('cvm.close.result -> recipient cvm:call (shell -> napplet push)', () => {
      expect(resolveCapabilitiesNub({ type: 'cvm.close.result' })).toEqual({ senderCap: null, recipientCap: 'cvm:call' });
    });

    it('cvm.event -> recipient cvm:call (shell -> napplet push, no envelope id)', () => {
      expect(resolveCapabilitiesNub({ type: 'cvm.event' })).toEqual({ senderCap: null, recipientCap: 'cvm:call' });
    });

    it('cvm.unknown -> sender cvm:call (default sender gate fallthrough)', () => {
      expect(resolveCapabilitiesNub({ type: 'cvm.unknown' })).toEqual({ senderCap: 'cvm:call', recipientCap: null });
    });
  });

  describe('outbox domain (NAP-OUTBOX outbox-aware relay routing)', () => {
    it('outbox.query -> sender outbox:read (napplet-originated request)', () => {
      expect(resolveCapabilitiesNub({ type: 'outbox.query' })).toEqual({ senderCap: 'outbox:read', recipientCap: null });
    });

    it('outbox.subscribe -> sender outbox:read (napplet-originated request)', () => {
      expect(resolveCapabilitiesNub({ type: 'outbox.subscribe' })).toEqual({ senderCap: 'outbox:read', recipientCap: null });
    });

    it('outbox.close -> sender outbox:read (napplet-originated request)', () => {
      expect(resolveCapabilitiesNub({ type: 'outbox.close' })).toEqual({ senderCap: 'outbox:read', recipientCap: null });
    });

    it('outbox.resolveRelays -> sender outbox:read (napplet-originated request)', () => {
      expect(resolveCapabilitiesNub({ type: 'outbox.resolveRelays' })).toEqual({ senderCap: 'outbox:read', recipientCap: null });
    });

    it('outbox.publish -> sender outbox:write (shell-signed publish fanout)', () => {
      expect(resolveCapabilitiesNub({ type: 'outbox.publish' })).toEqual({ senderCap: 'outbox:write', recipientCap: null });
    });

    it('outbox.query.result -> recipient outbox:read (shell -> napplet push)', () => {
      expect(resolveCapabilitiesNub({ type: 'outbox.query.result' })).toEqual({ senderCap: null, recipientCap: 'outbox:read' });
    });

    it('outbox.publish.result -> recipient outbox:read (shell -> napplet push)', () => {
      expect(resolveCapabilitiesNub({ type: 'outbox.publish.result' })).toEqual({ senderCap: null, recipientCap: 'outbox:read' });
    });

    it('outbox.resolveRelays.result -> recipient outbox:read (shell -> napplet push)', () => {
      expect(resolveCapabilitiesNub({ type: 'outbox.resolveRelays.result' })).toEqual({ senderCap: null, recipientCap: 'outbox:read' });
    });

    it('outbox.event -> recipient outbox:read (shell -> napplet push, no envelope id)', () => {
      expect(resolveCapabilitiesNub({ type: 'outbox.event' })).toEqual({ senderCap: null, recipientCap: 'outbox:read' });
    });

    it('outbox.eose -> recipient outbox:read (shell -> napplet push)', () => {
      expect(resolveCapabilitiesNub({ type: 'outbox.eose' })).toEqual({ senderCap: null, recipientCap: 'outbox:read' });
    });

    it('outbox.closed -> recipient outbox:read (shell -> napplet push)', () => {
      expect(resolveCapabilitiesNub({ type: 'outbox.closed' })).toEqual({ senderCap: null, recipientCap: 'outbox:read' });
    });

    it('outbox.unknown -> sender outbox:read (default sender gate fallthrough)', () => {
      expect(resolveCapabilitiesNub({ type: 'outbox.unknown' })).toEqual({ senderCap: 'outbox:read', recipientCap: null });
    });
  });

  describe('ALL_CAPABILITIES content', () => {
    it('contains the 7 v1.2 capability strings', () => {
      expect(ALL_CAPABILITIES).toContain('identity:read');
      expect(ALL_CAPABILITIES).toContain('identity:decrypt');
      expect(ALL_CAPABILITIES).toContain('keys:bind');
      expect(ALL_CAPABILITIES).toContain('keys:forward');
      expect(ALL_CAPABILITIES).toContain('media:control');
      expect(ALL_CAPABILITIES).toContain('notify:send');
      expect(ALL_CAPABILITIES).toContain('notify:channel');
      expect(ALL_CAPABILITIES).toContain('theme:read');
    });

    it('contains config:read (v1.7 Phase 39 9th domain)', () => {
      expect(ALL_CAPABILITIES).toContain('config:read');
    });

    it('contains resource:fetch (v1.7 Phase 40 10th domain)', () => {
      expect(ALL_CAPABILITIES).toContain('resource:fetch');
    });

    it('contains cvm:call (NAP-CVM ContextVM bridge)', () => {
      expect(ALL_CAPABILITIES).toContain('cvm:call');
    });

    it('contains outbox:read and outbox:write (NAP-OUTBOX)', () => {
      expect(ALL_CAPABILITIES).toContain('outbox:read');
      expect(ALL_CAPABILITIES).toContain('outbox:write');
    });

    it('does NOT contain the removed signer capability strings', () => {
      const caps = ALL_CAPABILITIES as readonly string[];
      expect(caps).not.toContain('sign:event');
      expect(caps).not.toContain('sign:nip04');
      expect(caps).not.toContain('sign:nip44');
    });

    it('preserves v1.1 capability strings that remain in scope', () => {
      expect(ALL_CAPABILITIES).toContain('relay:read');
      expect(ALL_CAPABILITIES).toContain('relay:write');
      expect(ALL_CAPABILITIES).toContain('cache:read');
      expect(ALL_CAPABILITIES).toContain('cache:write');
      expect(ALL_CAPABILITIES).toContain('hotkey:forward');
      expect(ALL_CAPABILITIES).toContain('state:read');
      expect(ALL_CAPABILITIES).toContain('state:write');
    });
  });
});
