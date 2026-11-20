/**
 * Guard for "every tunable Paja number is a setting".
 *
 * Every numeric literal in Paja's shipped source (other than 0, 1 and 2) must
 * either live in the settings registry, be a named Nostr kind, or be listed
 * below with the reason it is not user-tunable. Adding a new timeout, cap or
 * interval as a bare number fails this test: register it in
 * `settings-registry.ts` and read it with `getPajaSetting` instead.
 */
import { readdirSync, readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SRC = new URL('./', import.meta.url);
const OWNERS = new Set(['settings-registry.ts', 'nostr-kinds.ts']);
const TRIVIAL = new Set([0, 1, 2]);

/** Reasons a literal is not a setting; each entry names the file's allowed values. */
const NOT_SETTINGS: Readonly<Record<string, { readonly values: readonly number[]; readonly reason: string }>> = {
  'browser-adapter-support.ts': { values: [1000], reason: 'ms-to-seconds conversion for created_at' },
  'browser-common.ts': { values: [1000], reason: 'ms-to-seconds conversion for created_at' },
  'browser-dev-runtime.ts': { values: [1000], reason: 'ms-to-seconds conversion for created_at' },
  'browser-lists.ts': { values: [1000, 3], reason: 'created_at conversion; NIP-51 tag index' },
  'browser-llm-models.ts': { values: [1000], reason: 'ms-to-seconds conversion in a message' },
  'browser-webrtc.ts': { values: [1000, 16], reason: 'created_at conversion; hex radix' },
  'browser-webrtc-profile.ts': { values: [1000, 16], reason: 'created_at conversion; hex radix' },
  'browser-nip46-client.ts': { values: [1000, 32, 64, 8], reason: 'created_at conversion; secp256k1 key and pubkey sizes; subscription id prefix' },
  'browser-blossom-uri.ts': { values: [3], reason: 'regex capture group index' },
  'target-network.ts': { values: [3], reason: 'regex capture group index' },
  'local-target.ts': { values: [16, 3, 4], reason: 'hex radix; regex capture group indexes' },
  'browser-fs-support.ts': { values: [16, 3, 4], reason: 'hex radix; base64 length arithmetic (RFC 4648)' },
  'browser-fs.ts': { values: [16], reason: 'hex radix' },
  'browser-target-frame.ts': { values: [16], reason: 'hex radix' },
  'browser-operation-scope.ts': { values: [16], reason: '128-bit random id size and hex radix' },
  'browser-llm-panel.ts': { values: [10, 16, 8], reason: 'random connection id format' },
  'browser-llm-vault.ts': { values: [12, 16, 256], reason: 'AES-GCM IV, PBKDF2 salt and AES key sizes; persisted vault format' },
  'browser-host-signer.ts': { values: [65_535], reason: 'NIP-01 kind range' },
  'browser-signer-consent.ts': { values: [65_535], reason: 'NIP-01 kind range' },
  'browser-relay-policy.ts': {
    values: [10, 100, 127, 16, 168, 169, 172, 18, 19, 192, 198, 224, 254, 255, 31, 4, 64],
    reason: 'RFC 1918/6598/3927/2544 private and reserved IPv4 ranges',
  },
  'server-resource-transport.ts': {
    values: [10, 100, 113, 127, 16, 16_383, 168, 169, 172, 18, 19, 192, 198, 203, 224, 254, 31, 3512, 4, 4096, 502, 51, 512, 6, 64, 8192, 8193, 8194, 88, 99],
    reason: 'reserved IPv4/IPv6 ranges, IP families, hex radix and HTTP 502',
  },
  'browser-resource.ts': {
    values: [10, 100, 102, 1024, 103, 11, 110, 115, 12, 127, 13, 131, 136, 137, 14, 153, 159, 16, 163, 168, 169, 17, 172, 18, 185, 187, 19,
      192, 198, 204, 206, 216, 217, 220, 221, 223, 224, 230, 236, 237, 251, 254, 255, 26, 260, 3, 308, 31, 332, 333, 336, 4, 404, 410, 51, 6,
      60, 62, 64, 69, 71, 78, 8, 80, 99],
    reason: 'MIME magic bytes, Game Boy header offsets, data-URL header slack, reserved IPv4 ranges, HTTP 404/410',
  },
  'server.ts': { values: [200, 301, 302, 303, 307, 308, 32, 400, 403, 404, 502], reason: 'HTTP status codes; 256-bit capability token size' },
  'readiness.ts': { values: [500], reason: 'HTTP 5xx boundary' },
  'options.ts': { values: [30_000, 5197, 65_535], reason: 'port and ready timeout are already --port/--ready-timeout options; TCP port range' },
  'intent-launcher.ts': { values: [1_760_054_400], reason: 'fixed created_at of a deterministic built-in event' },
  'browser-config.ts': { values: [3], reason: 'presentation: textarea rows' },
  'browser-intent-builder-controls.ts': { values: [3, 5], reason: 'presentation: textarea rows' },
  'browser-cvm-settings.ts': { values: [12], reason: 'presentation: pubkey abbreviation' },
  'cvm-discovery.ts': { values: [12], reason: 'derived family id format' },
  'browser-host.ts': { values: [12], reason: 'presentation: hash abbreviation' },
  'browser-local-loader.ts': { values: [12], reason: 'presentation: hash abbreviation' },
  'browser-runtime-tabs.ts': { values: [12], reason: 'presentation: hash abbreviation' },
  'browser-relay-panel.ts': { values: [100, 12, 4, 8], reason: 'presentation: percentage and pubkey abbreviation' },
  'browser-gamepad-indicators.ts': { values: [137.508, 155, 360, 4, 480, 6, 85], reason: 'presentation: per-controller icon colour and animation' },
};

function literals(file: string): number[] {
  const text = readFileSync(new URL(file, SRC), 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const found: number[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isNumericLiteral(node)) found.push(Number(node.text.replaceAll('_', '')));
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found.filter((value) => !TRIVIAL.has(value));
}

const files = readdirSync(SRC).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts'));

describe('Paja numeric-literal guard', () => {
  it('finds no unregistered tunable numbers in shipped source', () => {
    const unexplained: string[] = [];
    for (const file of files) {
      if (OWNERS.has(file)) continue;
      const allowed = new Set(NOT_SETTINGS[file]?.values ?? []);
      for (const value of literals(file)) {
        if (!allowed.has(value)) unexplained.push(`${file}: ${String(value)}`);
      }
    }
    expect(unexplained).toEqual([]);
  });

  it('keeps the allowlist tight so stale exemptions are removed', () => {
    const stale: string[] = [];
    for (const [file, entry] of Object.entries(NOT_SETTINGS)) {
      const present = files.includes(file) ? new Set(literals(file)) : new Set<number>();
      for (const value of entry.values) if (!present.has(value)) stale.push(`${file}: ${String(value)}`);
    }
    expect(stale).toEqual([]);
  });
});
