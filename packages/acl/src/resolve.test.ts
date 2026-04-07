import { describe, it, expect } from 'vitest';
import { resolveCapabilitiesNub } from './resolve.js';
import type { CapabilityResolution } from './resolve.js';

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
  });

  describe('signer domain', () => {
    it('signer.getPublicKey -> null/null (no ACL gate)', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'signer.getPublicKey' });
      expect(result).toEqual({ senderCap: null, recipientCap: null });
    });

    it('signer.getRelays -> null/null (no ACL gate)', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'signer.getRelays' });
      expect(result).toEqual({ senderCap: null, recipientCap: null });
    });

    it('signer.signEvent -> sign:event', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'signer.signEvent' });
      expect(result).toEqual({ senderCap: 'sign:event', recipientCap: null });
    });

    it('signer.nip04.encrypt -> sign:nip04', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'signer.nip04.encrypt' });
      expect(result).toEqual({ senderCap: 'sign:nip04', recipientCap: null });
    });

    it('signer.nip04.decrypt -> sign:nip04', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'signer.nip04.decrypt' });
      expect(result).toEqual({ senderCap: 'sign:nip04', recipientCap: null });
    });

    it('signer.nip44.encrypt -> sign:nip44', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'signer.nip44.encrypt' });
      expect(result).toEqual({ senderCap: 'sign:nip44', recipientCap: null });
    });

    it('signer.nip44.decrypt -> sign:nip44', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'signer.nip44.decrypt' });
      expect(result).toEqual({ senderCap: 'sign:nip44', recipientCap: null });
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

    it('storage.clear -> state:write', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'storage.clear' });
      expect(result).toEqual({ senderCap: 'state:write', recipientCap: null });
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

    it('ifc.listen -> relay:read only', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'ifc.listen' });
      expect(result).toEqual({ senderCap: 'relay:read', recipientCap: null });
    });
  });

  describe('theme domain', () => {
    it('theme.get -> null/null (read-only, no user data)', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'theme.get' });
      expect(result).toEqual({ senderCap: null, recipientCap: null });
    });

    it('theme.subscribe -> null/null (read-only, no user data)', () => {
      const result: CapabilityResolution = resolveCapabilitiesNub({ type: 'theme.subscribe' });
      expect(result).toEqual({ senderCap: null, recipientCap: null });
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
});
