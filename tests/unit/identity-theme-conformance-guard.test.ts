import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('Phase 103 identity/theme active-surface guard', () => {
  it('keeps the signer probe on the canonical public-key result path', () => {
    const signerModal = source('apps/playground/src/signer-modal.ts');

    expect(signerModal).toContain("reply.type === 'identity.getPublicKey.result'");
    expect(signerModal).not.toContain("identity.getPublicKey.error");
  });

  it('keeps canonical runtime and service results with the complete fixed theme fallback', () => {
    const runtimeResults = source('packages/runtime/src/domain-results.ts');
    const runtime = source('packages/runtime/src/runtime.ts');
    const identityService = source('packages/services/src/identity-service.ts');
    const themeService = source('packages/services/src/theme-service.ts');

    expect(runtimeResults).toContain("'identity.getPublicKey': { pubkey: '' }");
    expect(runtimeResults).toContain("background: '#0a0a0a'");
    expect(runtimeResults).toContain("text: '#e0e0e0'");
    expect(runtimeResults).toContain("primary: '#7aa2f7'");
    expect(runtime).toContain('isIdentityOrThemeMessage(envelope) && !createCanonicalDomainResult(envelope)');
    expect(identityService).toContain("type: 'identity.getPublicKey.result'");
    expect(identityService).toContain("case 'identity.getPublicKey':");
    expect(themeService).toContain('function publishTheme(theme: Theme): ThemeChangedMessage');
    expect(themeService).toContain('currentTheme = normalizeTheme(theme);');
    expect(themeService).toContain('options.onBroadcast?.(envelope);');
    expect(themeService).not.toMatch(/type:\s*['"]theme\.[^'"]+\.error['"]/);
  });

  it('keeps identity/theme delivery session, domain, capability, and parent-source gated', () => {
    const bridge = source('packages/shell/src/shell-bridge.ts');
    const namespace = source('packages/shell/src/napplet-namespace.ts');
    const acl = source('packages/acl/src/resolve.ts');

    expect(bridge).toContain('function publishToEligibleNapplets(');
    expect(bridge).toContain("'identity:read'");
    expect(bridge).toContain("'theme:read'");
    expect(bridge).toContain('environment?.capabilities.domains.includes(domain)');
    expect(namespace).toContain('function makeProtectedIdentity(): Record<string, unknown>');
    expect(namespace).toContain('function makeProtectedTheme(): Record<string, unknown>');
    expect(namespace).toContain('return event.source === target.parent;');
    expect(namespace).toContain("getPublicKey: () => read('identity.getPublicKey', 'pubkey', '')");
    expect(namespace).not.toContain("type: 'theme.subscribe'");
    expect(namespace).not.toContain("type: 'theme.unsubscribe'");
    expect(acl).toContain("if (action === 'changed')");
    expect(acl).toContain("recipientCap: 'identity:read'");
    expect(acl).toContain("recipientCap: 'theme:read'");
  });

  it('keeps Paja and playground on one ThemeService-to-bridge path without raw identity fanout', () => {
    const pajaTheme = source('packages/paja/src/theme-broadcast.ts');
    const pajaHost = source('packages/paja/src/browser-host.ts');
    const playgroundHost = source('apps/playground/src/shell-host.ts');
    const preferences = source('apps/playground/src/main-preferences.ts');

    expect(pajaTheme).toContain('attachedBridge.publishTheme(envelope.theme);');
    expect(pajaHost.match(/themeService\?\.publishTheme/g)).toHaveLength(1);
    expect(pajaHost).not.toContain('bridge.publishTheme');
    expect(playgroundHost).toContain('onThemeBroadcast: (envelope) => relay.publishTheme(envelope.theme),');
    expect(preferences).toContain('getThemeServiceBundle()?.publishTheme(currentTheme);');
    expect(preferences).not.toContain('relay.publishTheme(currentTheme');
    expect(playgroundHost).not.toContain("type: 'identity.changed'");
    expect(playgroundHost).not.toContain("msg.envelopeType === 'identity.getPublicKey'");
  });

  it('keeps current developer guidance on the pinned policy and supported surfaces', () => {
    const policy = source('docs/policies/NIP-5D-CONFORMANCE.md');
    const runtime = source('packages/runtime/README.md');
    const services = source('packages/services/README.md');
    const shell = source('packages/shell/README.md');
    const playground = source('apps/playground/README.md');
    const guidance = [policy, runtime, services, shell, playground].join('\n');

    expect(policy).toContain('896c32c92deee68dc4d10fc1132b62df20cccb6f');
    expect(policy).toContain('fixed non-sensitive complete normal');
    expect(runtime).toContain('identity.getPublicKey.result');
    expect(services).toContain('stores that state before it');
    expect(shell).toContain('live authenticated `shell.ready` session');
    expect(playground).toContain('ThemeService.publishTheme()');
    expect(guidance).not.toContain('identity.getPublicKey.error');
    expect(guidance).not.toMatch(/theme\.(?:subscribe|unsubscribe)/);
  });
});
