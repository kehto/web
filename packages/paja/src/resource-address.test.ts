import { describe, expect, it } from 'vitest';
import { isPajaPublicResourceAddress, isPajaPublicResourceHost } from './resource-address.js';

describe('isPajaPublicResourceHost', () => {
  it.each(['image.nostr.build', 'blossom.primal.net', '93.184.215.14', '[2606:4700::1111]', 'cdn.example.'])('treats %s as public', (host) => {
    expect(isPajaPublicResourceHost(host)).toBe(true);
  });

  it.each([
    'localhost', 'app.localhost', 'printer.local', 'db.internal', 'nas.home.arpa', 'router.lan', 'router',
    '127.0.0.1', '10.1.2.3', '192.168.0.10', '172.20.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0',
    '[::1]', '[fe80::1]', '[fc00::1]', '[::ffff:127.0.0.1]', '0x7f000001', '2130706433',
  ])('drops %s', (host) => {
    expect(isPajaPublicResourceHost(host)).toBe(false);
  });
});

describe('isPajaPublicResourceAddress', () => {
  it('matches the server proxy ranges for literals', () => {
    expect(isPajaPublicResourceAddress('93.184.215.14')).toBe(true);
    expect(isPajaPublicResourceAddress('203.0.113.7')).toBe(false);
    expect(isPajaPublicResourceAddress('2001:db8::1')).toBe(false);
    expect(isPajaPublicResourceAddress('2606:4700::1111')).toBe(true);
    expect(isPajaPublicResourceAddress('not-an-ip')).toBe(false);
  });
});
