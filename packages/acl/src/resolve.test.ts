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
      // storage.clear is not in the canonical @napplet/nub-storage union; the
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

  describe('ALL_CAPABILITIES content', () => {
    it('contains the 7 v1.2 capability strings', () => {
      expect(ALL_CAPABILITIES).toContain('identity:read');
      expect(ALL_CAPABILITIES).toContain('keys:bind');
      expect(ALL_CAPABILITIES).toContain('keys:forward');
      expect(ALL_CAPABILITIES).toContain('media:control');
      expect(ALL_CAPABILITIES).toContain('notify:send');
      expect(ALL_CAPABILITIES).toContain('notify:channel');
      expect(ALL_CAPABILITIES).toContain('theme:read');
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
